/**
 * Simple Claude CLI test without dependencies
 */

const { spawn } = require('child_process');

async function testClaudeCLI() {
  console.log('🧪 Testing Claude CLI availability...\n');

  try {
    // Test if Claude CLI is available
    const testProcess = spawn('claude', ['--help'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    });

    let stdout = '';
    let stderr = '';

    testProcess.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    testProcess.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    const result = await new Promise((resolve, reject) => {
      testProcess.on('close', (code) => {
        resolve({ code, stdout, stderr });
      });

      testProcess.on('error', (error) => {
        reject(error);
      });

      setTimeout(() => {
        if (!testProcess.killed) {
          testProcess.kill('SIGTERM');
          reject(new Error('Claude CLI test timed out'));
        }
      }, 5000);
    });

    if (result.code === 0) {
      console.log('✅ Claude CLI is installed and accessible!');
      console.log('📋 Help output preview:');
      console.log(stdout.split('\n').slice(0, 5).join('\n'));
      console.log('\n🎉 Your Claude CLI integration should work!');
      
      console.log('\n📝 To use Claude CLI with the RAG system:');
      console.log('1. Make sure you\'re authenticated: claude auth login');
      console.log('2. Use RAGProviderFactory.createProviders({ preferCLI: true })');
      console.log('3. The system will automatically use CLI as primary provider');
      
    } else {
      console.log('⚠️ Claude CLI responded with non-zero exit code:', result.code);
      console.log('stderr:', stderr);
    }

  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('❌ Claude CLI not found in PATH');
      console.log('\n📋 Installation options:');
      console.log('• Install from: https://github.com/anthropics/claude-code');
      console.log('• Or use npm: npm install -g @anthropic-ai/claude-cli');
      console.log('• Or use the API-only mode instead');
    } else {
      console.log('❌ Error testing Claude CLI:', error.message);
    }
    
    console.log('\n🔄 Alternative: Use API-only mode');
    console.log('Set ANTHROPIC_API_KEY and use:');
    console.log('RAGProviderFactory.createAPIOnlyProviders()');
  }
}

// Test basic spawn functionality
async function testSpawn() {
  console.log('🔍 Testing spawn functionality...');
  try {
    const echoTest = spawn('echo', ['test'], { stdio: ['pipe', 'pipe', 'pipe'] });
    
    let output = '';
    echoTest.stdout?.on('data', (data) => {
      output += data.toString();
    });

    await new Promise((resolve, reject) => {
      echoTest.on('close', (code) => {
        if (code === 0 && output.trim() === 'test') {
          console.log('✅ Spawn functionality working');
          resolve(true);
        } else {
          reject(new Error('Spawn test failed'));
        }
      });
      echoTest.on('error', reject);
    });

    // Now test Claude CLI
    await testClaudeCLI();

  } catch (error) {
    console.error('❌ Basic spawn test failed:', error.message);
  }
}

testSpawn().then(() => {
  console.log('\n🏁 CLI test completed');
}).catch(error => {
  console.error('Test error:', error.message);
});