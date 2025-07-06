/**
 * Global Test Setup
 * 
 * Runs before all integration tests
 */

const { execSync } = require('child_process');
const path = require('path');

module.exports = async () => {
  console.log('Setting up integration test environment...');
  
  try {
    // Ensure test database is set up
    const setupScript = path.join(__dirname, '..', '..', 'scripts', 'setup-test-db.js');
    execSync(`node ${setupScript}`, { stdio: 'inherit' });
    
    console.log('Integration test environment ready');
  } catch (error) {
    console.error('Failed to set up integration test environment:', error);
    process.exit(1);
  }
};