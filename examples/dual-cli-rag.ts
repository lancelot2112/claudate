/**
 * Example: Using both Claude CLI and Gemini CLI with RAG system
 * 
 * This example demonstrates how to set up a RAG system that can use
 * both Claude CLI and Gemini CLI as providers, with automatic fallbacks.
 */

import { RAGProviderFactory } from '../src/utils/ragProviderFactory';
import { SemanticSearchEngine } from '../src/knowledge/search/SemanticSearch';
import { ChromaVectorStore } from '../src/knowledge/stores/ChromaVectorStore';
import { PostgreSQLRelationalStore } from '../src/knowledge/stores/PostgreSQLRelationalStore';
import { RAGSystem } from '../src/knowledge/rag/RAGSystem';
import logger from '../src/utils/logger';

async function dualCLIRAGExample() {
  try {
    console.log('🚀 Setting up dual CLI RAG system...\n');

    // Option 1: Prefer CLI with automatic detection
    console.log('📋 Option 1: Auto-detect and prefer CLI providers');
    const providers = await RAGProviderFactory.createProviders({
      preferCLI: true,           // Prefer CLI over API
      enableFallbacks: true,     // Enable API fallbacks if CLI fails
      timeout: 60000             // Longer timeout for CLI operations
    });

    console.log(`✅ Created ${providers.length} providers:`);
    providers.forEach(p => {
      console.log(`  - ${p.name} (priority: ${p.priority}, context: ${p.maxContextLength})`);
    });

    // Option 2: CLI-only setup (no API keys needed)
    console.log('\n📋 Option 2: CLI-only setup (no API keys)');
    try {
      const cliProviders = await RAGProviderFactory.createCLIOnlyProviders({
        timeout: 60000,
        preferClaude: true       // Claude CLI as primary, Gemini CLI as fallback
      });

      console.log(`✅ CLI-only providers: ${cliProviders.map(p => p.name).join(', ')}`);
    } catch (error) {
      console.log('⚠️ CLI-only setup failed:', error instanceof Error ? error.message : String(error));
    }

    // Option 3: Specific use case configurations
    console.log('\n📋 Option 3: Use case-specific configurations');
    
    const developmentConfig = RAGProviderFactory.getProviderRecommendations('development');
    console.log('Development config:', developmentConfig);
    
    const productionConfig = RAGProviderFactory.getProviderRecommendations('production');
    console.log('Production config:', productionConfig);
    
    const costSensitiveConfig = RAGProviderFactory.getProviderRecommendations('cost-sensitive');
    console.log('Cost-sensitive config:', costSensitiveConfig);

    // Set up complete RAG system with dual CLI support
    console.log('\n🔧 Setting up complete RAG system...');

    // Initialize stores (you'll need to configure these)
    const vectorStore = new ChromaVectorStore({
      host: 'localhost',
      port: 8000,
      collectionName: 'dual_cli_demo'
    });

    const relationalStore = new PostgreSQLRelationalStore({
      host: 'localhost',
      port: 5432,
      database: 'claudate',
      username: 'claudate',
      password: 'development'
    });

    // Create search engine
    const searchEngine = new SemanticSearchEngine(vectorStore, relationalStore);

    // Create RAG system with dual CLI providers
    const ragSystem = new RAGSystem(searchEngine, providers);

    console.log('✅ RAG system ready with dual CLI support!');

    // Example usage
    console.log('\n🧪 Testing RAG system...');
    try {
      const response = await ragSystem.askQuestion(
        "What are the benefits of using CLI providers over API providers?",
        [],
        3
      );

      console.log('📝 RAG Response:');
      console.log(`Answer: ${response.answer.substring(0, 200)}...`);
      console.log(`Confidence: ${response.confidence}`);
      console.log(`Model used: ${response.metadata?.model}`);
      console.log(`Documents retrieved: ${response.retrievalMetrics?.documentsRetrieved}`);

    } catch (error) {
      console.log('⚠️ RAG query failed (expected without proper setup):', 
        error instanceof Error ? error.message : String(error));
    }

  } catch (error) {
    logger.error('Dual CLI RAG example failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}

// Advanced example: Provider switching based on query type
async function intelligentProviderSelection() {
  console.log('\n🧠 Advanced: Intelligent provider selection...');

  try {
    // Create providers with different strengths
    const providers = await RAGProviderFactory.createProviders({
      preferCLI: true,
      enableFallbacks: true
    });

    // Example: Route different query types to different providers
    const queryTypes = [
      { query: "Write Python code for data processing", preferredProvider: "claude-cli" },
      { query: "Explain the strategic implications of AI adoption", preferredProvider: "gemini-cli" },
      { query: "Debug this TypeScript error", preferredProvider: "claude" },
      { query: "Plan a product roadmap", preferredProvider: "gemini" }
    ];

    for (const { query, preferredProvider } of queryTypes) {
      console.log(`\n📋 Query: "${query.substring(0, 50)}..."`);
      console.log(`   Recommended provider: ${preferredProvider}`);
      
      // In a real implementation, you could reorder providers based on query type
      const orderedProviders = [
        ...providers.filter(p => p.name === preferredProvider),
        ...providers.filter(p => p.name !== preferredProvider)
      ];
      
      console.log(`   Provider order: ${orderedProviders.map(p => p.name).join(' → ')}`);
    }

  } catch (error) {
    console.log('⚠️ Provider selection example failed:', 
      error instanceof Error ? error.message : String(error));
  }
}

// CLI Health Check Example
async function cliHealthDemo() {
  console.log('\n🏥 CLI Health Check Demo...');

  try {
    const cliProviders = await RAGProviderFactory.createCLIOnlyProviders();
    
    for (const provider of cliProviders) {
      console.log(`\n🔍 Checking ${provider.name}...`);
      
      if ('healthCheck' in provider.client && typeof provider.client.healthCheck === 'function') {
        const isHealthy = await provider.client.healthCheck();
        console.log(`   Status: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
        
        if ('getCostSummary' in provider.client && typeof provider.client.getCostSummary === 'function') {
          const costs = provider.client.getCostSummary();
          console.log(`   Cost summary:`, costs);
        }
      }
    }

  } catch (error) {
    console.log('⚠️ Health check failed:', error instanceof Error ? error.message : String(error));
  }
}

// Run the examples
async function main() {
  console.log('🎯 Dual CLI RAG Integration Demo\n');
  console.log('This demo shows how to use both Claude CLI and Gemini CLI together.\n');

  await dualCLIRAGExample();
  await intelligentProviderSelection();
  await cliHealthDemo();

  console.log('\n🏁 Demo completed!');
  console.log('\n📚 Next steps:');
  console.log('1. Install Claude CLI: https://github.com/anthropics/claude-code');
  console.log('2. Install Gemini CLI (gcloud): https://cloud.google.com/sdk/docs/install');
  console.log('3. Authenticate both CLIs');
  console.log('4. Set up ChromaDB and PostgreSQL');
  console.log('5. Run this example with real data');
}

if (require.main === module) {
  main().catch(console.error);
}

export {
  dualCLIRAGExample,
  intelligentProviderSelection,
  cliHealthDemo
};