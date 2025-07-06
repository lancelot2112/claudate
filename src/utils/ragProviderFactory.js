"use strict";
/**
 * RAG Provider Factory
 *
 * Utility to create RAG providers using the unified AI provider interface.
 * Currently focuses on Ollama local models but designed for future extensibility.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAGProviderFactory = void 0;
const AIProvider_1 = require("../integrations/ai/AIProvider");
const OllamaProvider_1 = require("../integrations/ai/OllamaProvider");
const PyTorchProvider_1 = require("../integrations/ai/PyTorchProvider");
const config_1 = require("./config");
const logger_1 = __importDefault(require("./logger"));
class RAGProviderFactory {
    /**
     * Create RAG providers using the unified AI provider system
     */
    static async createProviders(options = {}) {
        const { 
        // Ollama options
        ollamaHost = config_1.config.ai.ollama.host, ollamaPort = config_1.config.ai.ollama.port, defaultModel = config_1.config.ai.ollama.defaultModel, embeddingModel = config_1.config.ai.ollama.embeddingModel, maxContextLength = 100000, timeout = config_1.config.ai.ollama.timeout, 
        // PyTorch options
        pytorchServiceUrl = config_1.config.ai.pytorch.serviceUrl, pytorchServicePort = config_1.config.ai.pytorch.servicePort, pytorchDefaultModel = config_1.config.ai.pytorch.defaultModel, pytorchEmbeddingModel = config_1.config.ai.pytorch.defaultEmbeddingModel, 
        // Provider selection
        preferredProvider = 'auto', enableFallback = true } = options;
        const providers = [];
        let priority = 1;
        logger_1.default.info('Creating unified RAG providers', {
            preferredProvider,
            enableFallback,
            ollamaHost,
            ollamaPort,
            pytorchServiceUrl,
            pytorchServicePort
        });
        // Determine which providers to try and in what order
        const providersToTry = this.determineProviderOrder(preferredProvider);
        for (const providerType of providersToTry) {
            try {
                if (providerType === 'ollama') {
                    const ollamaProvider = await this.createOllamaProvider({
                        host: ollamaHost,
                        port: ollamaPort,
                        defaultModel,
                        embeddingModel,
                        timeout
                    });
                    providers.push({
                        name: 'ollama',
                        client: ollamaProvider,
                        priority: priority++,
                        maxContextLength
                    });
                    logger_1.default.info('Ollama provider added successfully', { priority: priority - 1 });
                }
                else if (providerType === 'pytorch') {
                    const pytorchProvider = await this.createPyTorchProvider({
                        serviceUrl: pytorchServiceUrl,
                        servicePort: pytorchServicePort,
                        defaultModel: pytorchDefaultModel,
                        defaultEmbeddingModel: pytorchEmbeddingModel
                    });
                    providers.push({
                        name: 'pytorch',
                        client: pytorchProvider,
                        priority: priority++,
                        maxContextLength
                    });
                    logger_1.default.info('PyTorch provider added successfully', { priority: priority - 1 });
                }
                // If we don't want fallback and we got our preferred provider, stop
                if (!enableFallback && providers.length > 0) {
                    break;
                }
            }
            catch (error) {
                logger_1.default.warn(`Failed to initialize ${providerType} provider`, {
                    error: error instanceof Error ? error.message : String(error),
                    providerType
                });
                // If this was the preferred provider and no fallback, throw
                if (!enableFallback && providerType === preferredProvider) {
                    throw error;
                }
            }
        }
        if (providers.length === 0) {
            throw new Error('No AI providers available. Please ensure at least one provider (Ollama or PyTorch service) is running and accessible.');
        }
        logger_1.default.info('RAG providers created', {
            count: providers.length,
            providers: providers.map(p => ({ name: p.name, priority: p.priority }))
        });
        return providers;
    }
    static determineProviderOrder(preferred) {
        switch (preferred) {
            case 'ollama':
                return ['ollama', 'pytorch'];
            case 'pytorch':
                return ['pytorch', 'ollama'];
            case 'auto':
            default:
                return ['ollama', 'pytorch']; // Ollama first by default (faster startup)
        }
    }
    static async createOllamaProvider(options) {
        const ollamaConfig = {
            name: 'ollama',
            host: options.host,
            port: options.port,
            timeout: options.timeout,
            maxRetries: 3,
            defaultModel: options.defaultModel,
            embeddingModel: options.embeddingModel,
            models: {
                text: config_1.config.ai.ollama.availableModels.reasoning.concat(config_1.config.ai.ollama.availableModels.coding),
                embedding: config_1.config.ai.ollama.availableModels.embedding
            }
        };
        return await this.aiProviderFactory.create('ollama', ollamaConfig);
    }
    static async createPyTorchProvider(options) {
        const pytorchConfig = {
            name: 'pytorch',
            serviceUrl: options.serviceUrl,
            servicePort: options.servicePort,
            defaultModel: options.defaultModel,
            defaultEmbeddingModel: options.defaultEmbeddingModel,
            healthCheckInterval: config_1.config.ai.pytorch.healthCheckInterval,
            requestTimeout: config_1.config.ai.pytorch.requestTimeout,
            timeout: config_1.config.ai.pytorch.requestTimeout,
            maxRetries: 3,
            models: {
                text: config_1.config.ai.pytorch.availableModels.reasoning.concat(config_1.config.ai.pytorch.availableModels.coding),
                embedding: config_1.config.ai.pytorch.availableModels.embedding
            }
        };
        return await this.aiProviderFactory.create('pytorch', pytorchConfig);
    }
    /**
     * Create Ollama provider with specific model (legacy method)
     */
    static async createSpecificOllamaProvider(options) {
        const { model, embeddingModel = 'all-minilm', timeout = 120000, host = 'localhost', port = 11434 } = options;
        const ollamaConfig = {
            name: 'ollama',
            host,
            port,
            timeout,
            maxRetries: 3,
            defaultModel: model,
            embeddingModel,
            models: {
                text: [model],
                embedding: [embeddingModel]
            }
        };
        const ollamaProvider = await this.aiProviderFactory.create('ollama', ollamaConfig);
        return [{
                name: 'ollama',
                client: ollamaProvider,
                priority: 1,
                maxContextLength: 100000
            }];
    }
    /**
     * Get provider recommendations based on use case for Ollama
     */
    static getProviderRecommendations(useCase) {
        const baseOptions = {
            ollamaHost: 'localhost',
            ollamaPort: 11434,
            maxContextLength: 100000
        };
        switch (useCase) {
            case 'development':
                return {
                    ...baseOptions,
                    defaultModel: 'qwen3:8b', // Good balance of capability and speed
                    timeout: 180000 // Longer timeout for development
                };
            case 'production':
                return {
                    ...baseOptions,
                    defaultModel: 'qwen3:8b', // Reliable model for production
                    timeout: 120000
                };
            case 'cost-sensitive':
                return {
                    ...baseOptions,
                    defaultModel: 'llama3.2', // Smaller, faster model
                    timeout: 90000
                };
            case 'high-throughput':
                return {
                    ...baseOptions,
                    defaultModel: 'llama3.2', // Faster model for high throughput
                    timeout: 60000 // Shorter timeout
                };
            default:
                return {
                    ...baseOptions,
                    defaultModel: 'qwen3:8b',
                    timeout: 120000
                };
        }
    }
    /**
     * List available models on the Ollama instance
     */
    static async getAvailableModels(options = {}) {
        const { host = 'localhost', port = 11434 } = options;
        try {
            const tempConfig = {
                name: 'temp-ollama',
                host,
                port,
                timeout: 30000,
                maxRetries: 1,
                defaultModel: 'qwen3:8b',
                embeddingModel: 'all-minilm',
                models: {
                    text: [],
                    embedding: []
                }
            };
            const tempProvider = new OllamaProvider_1.OllamaProvider(tempConfig);
            return await tempProvider.listAvailableModels();
        }
        catch (error) {
            logger_1.default.error('Failed to list available models', {
                error: error instanceof Error ? error.message : String(error),
                host,
                port
            });
            return [];
        }
    }
    /**
     * Add a new AI provider type to the factory
     */
    static registerProvider(name, providerClass) {
        this.aiProviderFactory.register(name, providerClass);
    }
    /**
     * List all registered provider types
     */
    static getRegisteredProviders() {
        return this.aiProviderFactory.listProviders();
    }
}
exports.RAGProviderFactory = RAGProviderFactory;
RAGProviderFactory.aiProviderFactory = AIProvider_1.AIProviderFactory.getInstance();
(() => {
    // Register available provider types
    RAGProviderFactory.aiProviderFactory.register('ollama', OllamaProvider_1.OllamaProvider);
    RAGProviderFactory.aiProviderFactory.register('pytorch', PyTorchProvider_1.PyTorchProvider);
})();
exports.default = RAGProviderFactory;
