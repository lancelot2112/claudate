/**
 * Simple test to verify Claude CLI integration
 * Run this to test if the CLI client works in your environment
 */

const { ClaudeCLIClient } = require('./dist/integrations/ai/ClaudeCLIClient');

async function testCLIIntegration() {
  console.log('🧪 Testing Claude CLI Integration...\n');

  try {
    // Create CLI client
    const cliClient = new ClaudeCLIClient({
      timeout: 10000, // 10 second timeout for quick test
      maxRetries: 1
    });

    console.log('✅ CLI client created');

    // Test health check
    console.log('🔍 Checking CLI availability...');
    const isHealthy = await cliClient.healthCheck();
    
    if (isHealthy) {
      console.log('✅ Claude CLI is available and working!\n');
      
      // Test a simple request
      console.log('📤 Sending test message...');
      const response = await cliClient.sendMessage({
        messages: [{ 
          role: 'user', 
          content: 'Please respond with exactly "CLI_TEST_SUCCESS" to confirm this integration is working.' 
        }],
        temperature: 0.1,
        max_tokens: 50
      });

      console.log('📥 Response received:');
      console.log(`Content: ${response.content}`);
      console.log(`Model: ${response.model}`);
      console.log(`Estimated tokens: ${response.usage?.input_tokens || 0} input, ${response.usage?.output_tokens || 0} output\n`);

      if (response.content.includes('CLI_TEST_SUCCESS')) {
        console.log('🎉 CLI Integration test PASSED!');
        console.log('✅ You can now use Claude CLI with the RAG system\n');
      } else {
        console.log('⚠️  CLI responded but test phrase not found');
        console.log('✅ Basic integration working, but response format may vary\n');
      }

      // Show cost tracking
      const costs = cliClient.getCostSummary();
      console.log('💰 Cost tracking:', costs);

    } else {
      console.log('❌ Claude CLI health check failed');
      console.log('📋 Possible issues:');
      console.log('   - Claude CLI not installed');
      console.log('   - Not authenticated (run: claude auth login)');
      console.log('   - CLI not in PATH');
      console.log('   - Network connectivity issues\n');
    }

  } catch (error) {
    console.error('❌ CLI Integration test failed:');
    console.error(error.message);
    console.log('\n📋 Troubleshooting:');
    console.log('1. Install Claude CLI: Follow Anthropic\'s installation guide');
    console.log('2. Authenticate: claude auth login');
    console.log('3. Test manually: echo "test" | claude');
    console.log('4. Check PATH: which claude');
  }
}

// Run the test
testCLIIntegration().then(() => {
  console.log('\n🏁 Test completed');
}).catch(error => {
  console.error('Test runner error:', error);
});