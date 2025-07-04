import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce logging during tests
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/claudate_test';
process.env.DATABASE_PASSWORD = 'test';
process.env.REDIS_URL = 'redis://localhost:6379/0';
process.env.REDIS_PASSWORD = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.API_BASE_URL = 'http://localhost:3000';
process.env.PUBLIC_URL = 'http://localhost:3000';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.GOOGLE_API_KEY = 'test-google-key';
process.env.GOOGLE_AI_API_KEY = 'test-google-ai-key';
process.env.GOOGLE_PROJECT_ID = 'test-project';
process.env.TWILIO_ACCOUNT_SID = 'test-twilio-sid';
process.env.TWILIO_AUTH_TOKEN = 'test-twilio-token';
process.env.TWILIO_PHONE_NUMBER = '+1234567890';
process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
process.env.SENDGRID_FROM_EMAIL = 'test@example.com';
process.env.GOOGLE_CHAT_CREDENTIALS_PATH = '/tmp/test-credentials.json';
process.env.GOOGLE_CHAT_WEBHOOK_URL = 'https://example.com/webhook';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters-long';

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