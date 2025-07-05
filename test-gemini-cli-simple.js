/**
 * Simple Gemini CLI test without dependencies
 */

const { spawn } = require('child_process');

async function testGeminiCLI() {
  console.log('🧪 Testing Gemini CLI availability...\n');

  const cliCandidates = [
    'gemini',           // Standalone Gemini CLI
    'gcloud',           // Google Cloud CLI
    'google-cloud-cli', // Alternative gcloud name
    'ai'                // AI-specific CLI
  ];

  const availableCLIs = [];

  for (const cli of cliCandidates) {
    try {
      console.log(`🔍 Testing ${cli}...`);
      
      const testProcess = spawn(cli, ['--help'], {
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
          if (error.code === 'ENOENT') {
            resolve({ code: -1, stdout: '', stderr: 'Command not found' });
          } else {
            reject(error);
          }
        });

        setTimeout(() => {
          if (!testProcess.killed) {
            testProcess.kill('SIGTERM');
            resolve({ code: -1, stdout: '', stderr: 'Timeout' });
          }
        }, 5000);
      });

      if (result.code === 0 || result.code === 1) { // Many CLIs return 1 for help
        console.log(`✅ ${cli} is available!`);
        availableCLIs.push(cli);
        
        // Show preview of help output
        console.log('📋 Help output preview:');
        console.log(stdout.split('\n').slice(0, 3).join('\n'));
        console.log('');
      } else if (result.stderr === 'Command not found') {
        console.log(`❌ ${cli} not found in PATH`);
      } else {
        console.log(`⚠️ ${cli} responded with code ${result.code}`);
      }

    } catch (error) {
      console.log(`❌ Error testing ${cli}:`, error.message);
    }
  }

  console.log('\n📊 Summary:');
  if (availableCLIs.length > 0) {
    console.log(`✅ Found ${availableCLIs.length} Gemini CLI tool(s): ${availableCLIs.join(', ')}`);
    console.log('\n🎉 Your Gemini CLI integration should work!');
    
    console.log('\n📝 To use Gemini CLI with the RAG system:');
    console.log('1. Make sure you\'re authenticated (varies by CLI tool)');
    console.log('2. Use RAGProviderFactory.createProviders({ preferCLI: true })');
    console.log('3. The system will auto-detect and use available Gemini CLI');
    
    const preferredCLI = ['gemini', 'gcloud', 'google-cloud-cli', 'ai'].find(cli => availableCLIs.includes(cli));
    console.log(`4. Auto-selected CLI will be: ${preferredCLI}`);
    
  } else {
    console.log('❌ No Gemini CLI tools found');
    console.log('\n📋 Installation options:');
    console.log('• Google Cloud CLI: https://cloud.google.com/sdk/docs/install');
    console.log('• Standalone Gemini CLI (if available)');
    console.log('• Or use the API-only mode instead');
    
    console.log('\n🔄 Alternative: Use API-only mode');
    console.log('Set GEMINI_API_KEY and use:');
    console.log('RAGProviderFactory.createAPIOnlyProviders()');
  }

  return availableCLIs;
}

// Test basic spawn functionality first
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

    // Now test Gemini CLI
    const available = await testGeminiCLI();
    
    console.log('\n🔄 Testing dual CLI setup...');
    if (available.length > 0) {
      console.log('✅ Gemini CLI available for dual Claude+Gemini setup');
      console.log('📝 Both CLIs can be used together for maximum flexibility');
    } else {
      console.log('ℹ️ Only Claude CLI setup available (if Claude CLI is installed)');
    }

  } catch (error) {
    console.error('❌ Basic spawn test failed:', error.message);
  }
}

testSpawn().then(() => {
  console.log('\n🏁 Gemini CLI test completed');
}).catch(error => {
  console.error('Test error:', error.message);
});