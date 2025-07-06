/**
 * Global Test Teardown
 * 
 * Runs after all integration tests
 */

const fs = require('fs');
const path = require('path');

module.exports = async () => {
  console.log('Cleaning up integration test environment...');
  
  try {
    // Clean up test database
    const testDbPath = path.join(__dirname, '..', '..', 'test-database.sqlite');
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      console.log('Removed test database');
    }
    
    console.log('Integration test cleanup complete');
  } catch (error) {
    console.error('Failed to clean up integration test environment:', error);
  }
};