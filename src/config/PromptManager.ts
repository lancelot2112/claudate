import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

export interface PromptConfig {
  name: string;
  description: string;
  systemPrompt: string;
  parameters?: {
    defaultTemperature?: number;
    maxTokensMultiplier?: number;
    minOutputTokens?: number;
  };
}

export interface CompressorPromptConfig extends PromptConfig {
  compressionPrompt: string;
  summarizationPrompts: {
    [style: string]: {
      prompt: string;
      systemMessage: string;
    };
  };
}

export interface PromptOverride {
  systemPrompt?: string;
  compressionPrompt?: string;
  summarizationPrompts?: {
    [style: string]: {
      prompt?: string;
      systemMessage?: string;
    };
  };
  parameters?: {
    defaultTemperature?: number;
    maxTokensMultiplier?: number;
    minOutputTokens?: number;
  };
}

export class PromptManager {
  private static instance: PromptManager;
  private prompts: Map<string, any> = new Map();
  private overrides: Map<string, PromptOverride> = new Map();
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(__dirname, 'prompts.json');
    this.loadPrompts();
  }

  static getInstance(configPath?: string): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager(configPath);
    }
    return PromptManager.instance;
  }

  private loadPrompts(): void {
    try {
      if (!fs.existsSync(this.configPath)) {
        logger.warn('Prompts configuration file not found', { path: this.configPath });
        return;
      }

      const configData = fs.readFileSync(this.configPath, 'utf-8');
      const config = JSON.parse(configData);

      // Load each prompt configuration
      for (const [key, value] of Object.entries(config)) {
        if (key !== 'system') { // Skip system metadata
          this.prompts.set(key, value);
        }
      }

      logger.info('Prompt configurations loaded', { 
        count: this.prompts.size,
        prompts: Array.from(this.prompts.keys())
      });
    } catch (error) {
      logger.error('Failed to load prompt configurations', {
        error: error instanceof Error ? error.message : String(error),
        path: this.configPath
      });
    }
  }

  public getPromptConfig(agentType: string): PromptConfig | CompressorPromptConfig | null {
    const config = this.prompts.get(agentType);
    if (!config) {
      logger.warn('Prompt configuration not found', { agentType });
      return null;
    }

    // Apply any overrides
    const override = this.overrides.get(agentType);
    if (override) {
      return this.applyOverride(config, override);
    }

    return config;
  }

  public getCompressorConfig(): CompressorPromptConfig | null {
    return this.getPromptConfig('compressor') as CompressorPromptConfig;
  }

  public setOverride(agentType: string, override: PromptOverride): void {
    this.overrides.set(agentType, override);
    logger.info('Prompt override set', { agentType, override });
  }

  public removeOverride(agentType: string): void {
    this.overrides.delete(agentType);
    logger.info('Prompt override removed', { agentType });
  }

  public clearOverrides(): void {
    this.overrides.clear();
    logger.info('All prompt overrides cleared');
  }

  public formatPrompt(
    template: string, 
    variables: Record<string, string | number>
  ): string {
    let formatted = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      formatted = formatted.replace(new RegExp(placeholder, 'g'), String(value));
    }

    return formatted;
  }

  public getCompressionPrompt(
    content: string, 
    targetLength: number,
    customPrompt?: string
  ): string {
    if (customPrompt) {
      return this.formatPrompt(customPrompt, { content, targetLength });
    }

    const config = this.getCompressorConfig();
    if (!config) {
      // Fallback prompt if configuration is not available
      return `Please compress the following text to approximately ${targetLength} characters while preserving all key information and meaning.\n\nOriginal text:\n${content}\n\nCompressed version:`;
    }

    return this.formatPrompt(config.compressionPrompt, { content, targetLength });
  }

  public getSummarizationPrompt(
    content: string,
    style: string = 'paragraph',
    maxLength: number,
    includeActionItems: boolean = false,
    customPrompt?: string
  ): { prompt: string; systemMessage: string } {
    if (customPrompt) {
      return {
        prompt: this.formatPrompt(customPrompt, { content, maxLength }),
        systemMessage: 'Create a clear, informative summary that captures the essential information.'
      };
    }

    const config = this.getCompressorConfig();
    if (!config || !config.summarizationPrompts[style]) {
      // Fallback prompt
      return {
        prompt: `Summarize the following content (max ${maxLength} characters):\n\n${content}\n\nSummary:`,
        systemMessage: 'Create a clear, informative summary that captures the essential information.'
      };
    }

    const styleConfig = config.summarizationPrompts[style];
    let prompt = this.formatPrompt(styleConfig.prompt, { content, maxLength });

    if (includeActionItems) {
      prompt += '\n\nInclude any action items or next steps mentioned.';
    }

    return {
      prompt,
      systemMessage: styleConfig.systemMessage
    };
  }

  public getSystemPrompt(agentType: string): string {
    const config = this.getPromptConfig(agentType);
    if (!config) {
      return 'You are a helpful AI assistant.'; // Default fallback
    }
    return config.systemPrompt;
  }

  public getParameters(agentType: string): {
    defaultTemperature: number;
    maxTokensMultiplier: number;
    minOutputTokens: number;
  } {
    const config = this.getPromptConfig(agentType);
    
    // Default parameters
    const defaults = {
      defaultTemperature: 0.3,
      maxTokensMultiplier: 0.5,
      minOutputTokens: 200
    };

    if (!config || !config.parameters) {
      return defaults;
    }

    return {
      defaultTemperature: config.parameters.defaultTemperature ?? defaults.defaultTemperature,
      maxTokensMultiplier: config.parameters.maxTokensMultiplier ?? defaults.maxTokensMultiplier,
      minOutputTokens: config.parameters.minOutputTokens ?? defaults.minOutputTokens
    };
  }

  private applyOverride(config: any, override: PromptOverride): any {
    const result = { ...config };

    if (override.systemPrompt) {
      result.systemPrompt = override.systemPrompt;
    }

    if (override.compressionPrompt && result.compressionPrompt) {
      result.compressionPrompt = override.compressionPrompt;
    }

    if (override.summarizationPrompts && result.summarizationPrompts) {
      for (const [style, overrideStyle] of Object.entries(override.summarizationPrompts)) {
        if (result.summarizationPrompts[style]) {
          result.summarizationPrompts[style] = {
            ...result.summarizationPrompts[style],
            ...overrideStyle
          };
        }
      }
    }

    if (override.parameters && result.parameters) {
      result.parameters = {
        ...result.parameters,
        ...override.parameters
      };
    }

    return result;
  }

  public reloadConfiguration(): void {
    this.prompts.clear();
    this.loadPrompts();
    logger.info('Prompt configuration reloaded');
  }

  public listAvailablePrompts(): string[] {
    return Array.from(this.prompts.keys());
  }

  public getConfigurationSummary(): Record<string, any> {
    const summary: Record<string, any> = {};
    
    for (const [key, config] of this.prompts.entries()) {
      summary[key] = {
        name: config.name,
        description: config.description,
        hasOverride: this.overrides.has(key),
        parameters: config.parameters || {}
      };
    }

    return summary;
  }
}

export default PromptManager;