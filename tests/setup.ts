import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce logging during tests

// Mock external services by default
process.env.MOCK_TWILIO = 'true';
process.env.MOCK_SENDGRID = 'true';
process.env.MOCK_AI_SERVICES = 'true';

// Global test setup
beforeAll(async () => {
  // Global setup logic here
});

afterAll(async () => {
  // Global cleanup logic here
});

// Increase test timeout for integration tests
jest.setTimeout(30000);