#!/usr/bin/env node

/**
 * Simple Ollama Service Runner
 * This script provides a working Ollama-based AI service for immediate use
 */

const { OllamaProvider } = require('./dist/integrations/ai/OllamaProvider');

class OllamaService {
  constructor() {
    this.provider = null;
    this.config = null;
  }

  async initialize() {
    console.log('🚀 Initializing Ollama Service...');
    
    try {
      // Create simple config for Ollama
      const ollamaConfig = {
        host: process.env.OLLAMA_HOST || 'localhost',
        port: parseInt(process.env.OLLAMA_PORT || '11434'),
        defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'qwen3:8b',
        embeddingModel: process.env.OLLAMA_EMBEDDING_MODEL || 'mxbai-embed-large',
        timeout: 30000,
        maxRetries: 3
      };
      
      // Create Ollama provider
      this.provider = new OllamaProvider(ollamaConfig);
      console.log('✅ Ollama provider created');
      
      // Test connection
      await this.testConnection();
      console.log('✅ Ollama service ready for use!');
      
    } catch (error) {
      console.error('❌ Failed to initialize Ollama service:', error.message);
      process.exit(1);
    }
  }

  async testConnection() {
    console.log('🔍 Testing Ollama connection...');
    
    try {
      const health = await this.provider.healthCheck();
      console.log('🟢 Health check:', health);
      
      // Simple test to see if we can connect
      console.log('✅ Ollama connection successful');
      
    } catch (error) {
      console.error('❌ Connection test failed:', error.message);
      console.log('💡 Make sure Ollama is running: ollama serve');
      throw error;
    }
  }

  async generateText(prompt, model = 'qwen3:8b') {
    console.log(`🤖 Generating text with ${model}...`);
    
    try {
      const response = await this.provider.generateText({
        model,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1000,
        temperature: 0.7
      });
      
      return response.content;
      
    } catch (error) {
      console.error('❌ Text generation failed:', error.message);
      throw error;
    }
  }

  async generateEmbedding(text, model = 'mxbai-embed-large') {
    console.log(`🔢 Generating embedding with ${model}...`);
    
    try {
      const response = await this.provider.generateEmbedding({
        model,
        texts: [text]
      });
      
      return response.embeddings[0];
      
    } catch (error) {
      console.error('❌ Embedding generation failed:', error.message);
      throw error;
    }
  }

  async runDemo() {
    console.log('\n🎬 Running demo...');
    
    try {
      // Demo 1: Text generation
      console.log('\n--- Demo 1: Text Generation ---');
      const prompt = 'Write a simple hello world function in JavaScript';
      const response = await this.generateText(prompt);
      console.log('Prompt:', prompt);
      console.log('Response:', response);
      
      // Demo 2: Embedding generation (if model available)
      console.log('\n--- Demo 2: Embedding Generation ---');
      const text = 'Hello, this is a test sentence for embedding.';
      try {
        const embedding = await this.generateEmbedding(text);
        console.log('Text:', text);
        console.log('Embedding dimensions:', embedding.length);
        console.log('First 5 values:', embedding.slice(0, 5));
      } catch (error) {
        console.log('⚠️  Embedding demo skipped (model not available)');
        console.log('   To enable: ollama pull mxbai-embed-large');
      }
      
    } catch (error) {
      console.error('❌ Demo failed:', error.message);
    }
  }

  async runInteractive() {
    console.log('\n💬 Interactive mode - type "exit" to quit');
    
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askQuestion = (question) => {
      return new Promise((resolve) => {
        rl.question(question, (answer) => {
          resolve(answer);
        });
      });
    };

    try {
      while (true) {
        const prompt = await askQuestion('\nYou: ');
        
        if (prompt.toLowerCase() === 'exit') {
          console.log('👋 Goodbye!');
          break;
        }
        
        if (prompt.trim() === '') {
          continue;
        }
        
        console.log('🤖 AI: Thinking...');
        const response = await this.generateText(prompt);
        console.log('🤖 AI:', response);
      }
    } catch (error) {
      console.error('❌ Interactive mode error:', error.message);
    } finally {
      rl.close();
    }
  }
}

// Main execution
async function main() {
  const service = new OllamaService();
  
  const mode = process.argv[2] || 'demo';
  
  switch (mode) {
    case 'test':
      await service.initialize();
      break;
      
    case 'demo':
      await service.initialize();
      await service.runDemo();
      break;
      
    case 'interactive':
      await service.initialize();
      await service.runInteractive();
      break;
      
    default:
      console.log('Usage: node run-ollama-service.js [test|demo|interactive]');
      console.log('  test       - Test connection only');
      console.log('  demo       - Run demo examples');
      console.log('  interactive - Start interactive chat');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { OllamaService };