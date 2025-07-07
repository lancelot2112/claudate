#!/usr/bin/env npx ts-node

/**
 * Example: Context Compression with Generic Ollama Architecture
 * 
 * This example demonstrates how to use the new ContextCompressor with the
 * generic Ollama architecture for intelligent context management.
 */

import { ContextCompressor } from '../src/knowledge/context/ContextCompressor';
import { OllamaRAGAdapter } from '../src/integrations/ai/OllamaRAGAdapter';
import { OllamaAgent } from '../src/agents/ollama/OllamaAgent';
import { PromptManager } from '../src/config/PromptManager';

async function demonstrateContextCompression() {
  console.log('🤖 Context Compression with Generic Ollama Architecture');
  console.log('====================================================');

  try {
    // 1. Create a generic Ollama agent (supports any model)
    console.log('\n1. Creating Ollama agent...');
    const ollamaAgent = OllamaAgent.createQwen3Agent({
      name: 'compression-agent',
      type: 'execution',
      capabilities: ['text_generation', 'reasoning', 'analysis'],
      enabled: true,
      priority: 1,
      maxConcurrentTasks: 1
    });

    console.log(`✅ Agent created: ${ollamaAgent.getModelInfo().model}`);
    console.log(`📏 Context window: ${ollamaAgent.getMaxContextWindow()} tokens`);

    // 2. Create RAG adapter for unified interface
    console.log('\n2. Creating RAG adapter...');
    const ragAdapter = new OllamaRAGAdapter(ollamaAgent);
    
    console.log(`✅ RAG adapter created: ${ragAdapter.name}`);
    console.log(`🎯 Max context window: ${ragAdapter.getMaxContextWindow()}`);

    // 3. Initialize prompt manager with configurable prompts
    console.log('\n3. Setting up prompt manager...');
    const promptManager = PromptManager.getInstance();
    
    // Optional: Override compression prompt for specific behavior
    promptManager.setOverride('compressor', {
      systemPrompt: 'You are a specialized context compression agent. Focus on preserving technical details and key relationships.',
      compressionPrompt: 'Compress the following technical content to approximately {targetLength} characters. Maintain all important technical details, relationships, and actionable information:\n\n{content}\n\nCompressed version:'
    });

    console.log('✅ Prompt manager configured with custom compression behavior');

    // 4. Create context compressor
    console.log('\n4. Creating context compressor...');
    const contextCompressor = new ContextCompressor(
      ragAdapter,
      {
        targetCompressionRatio: 0.4, // Compress to 40% of original length
        useSemanticCompression: true,
        respectContextWindow: true,
        preserveKeyInformation: true
      },
      promptManager
    );

    const config = contextCompressor.getConfig();
    console.log(`✅ Compressor ready - Target ratio: ${config.targetCompressionRatio}`);
    console.log(`📐 Max input length: ${config.maxInputLength} chars`);

    // 5. Demonstrate context compression
    console.log('\n5. Demonstrating context compression...');
    
    const sampleContext = `
      The Claudate agentic framework represents a significant advancement in AI orchestration technology. 
      Built on a three-layer architecture, it provides seamless integration between personal assistant, 
      strategic planning, and execution layers. The system now supports generic Ollama agents that can work 
      with any model including Qwen3:8b, Llama3.2, and specialized code models.

      Key architectural improvements include:
      - Generic OllamaAgent class supporting runtime model switching
      - Unified AIProvider interface with context window management
      - Configurable prompt management system for sub-agent behavior
      - Advanced context compression with semantic understanding
      - Factory methods for common model configurations
      - Automatic capability inference based on model characteristics

      The context compression system intelligently manages memory by:
      1. Respecting model-specific context windows (8192 tokens for Qwen3, 16384 for CodeLlama)
      2. Using semantic compression when AI providers are available
      3. Falling back to statistical compression for reliability
      4. Chunking large content while preserving semantic boundaries
      5. Providing customizable compression prompts for different use cases

      Implementation benefits include improved cost efficiency, better context utilization, 
      reduced latency, and enhanced scalability across different model types and sizes.
    `.trim();

    console.log(`📄 Original text: ${sampleContext.length} characters`);
    console.log(`🧮 Estimated tokens: ${ragAdapter.estimateTokenCount(sampleContext)}`);

    // Note: This would require an actual Ollama service running
    // For demonstration, we'll show the configuration and setup
    
    console.log('\n6. Compression capabilities:');
    console.log(`🎯 Semantic compression: ${config.useSemanticCompression ? 'Enabled' : 'Disabled'}`);
    console.log(`🔧 Context window respect: ${config.respectContextWindow ? 'Enabled' : 'Disabled'}`);
    console.log(`📦 Chunking support: Available for large content`);
    console.log(`⚙️ Custom prompts: Configurable via PromptManager`);

    // 7. Show different compression options
    console.log('\n7. Available compression options:');
    console.log('   - Semantic compression (AI-powered, preserves meaning)');
    console.log('   - Statistical compression (keyword-based, reliable fallback)');
    console.log('   - Chunked processing (for content exceeding context window)');
    console.log('   - Custom prompt overrides (task-specific compression)');

    // 8. Show summarization capabilities
    console.log('\n8. Summarization styles available:');
    const styles = ['paragraph', 'bullet-points', 'key-insights', 'executive'];
    styles.forEach(style => {
      console.log(`   - ${style}: Optimized for different use cases`);
    });

    // 9. Provider information
    console.log('\n9. Provider information:');
    const providerInfo = contextCompressor.getProviderInfo();
    console.log(`   Provider: ${providerInfo.name}`);
    console.log(`   Max context: ${providerInfo.maxContextWindow} tokens`);
    console.log(`   Capabilities: ${Object.keys(providerInfo.capabilities).filter(k => providerInfo.capabilities[k]).join(', ')}`);

    console.log('\n✨ Context compression system ready!');
    console.log('\n📝 To use with a running Ollama service:');
    console.log('   1. Start Ollama: ollama serve');
    console.log('   2. Pull model: ollama pull qwen3:8b');
    console.log('   3. Run: const result = await contextCompressor.compressContext(text);');

  } catch (error) {
    console.error('❌ Error demonstrating context compression:', error);
    console.log('\n💡 This example shows the configuration and setup.');
    console.log('   For actual compression, ensure Ollama service is running.');
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateContextCompression()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Demo failed:', error);
      process.exit(1);
    });
}

export { demonstrateContextCompression };