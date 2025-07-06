/**
 * Test Database Setup Script
 * 
 * Creates a SQLite-based test database for integration tests
 * that don't require external Docker dependencies.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, '..', 'test-database.sqlite');

// Ensure the database directory exists
const dbDir = path.dirname(TEST_DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Remove existing test database
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
  console.log('Removed existing test database');
}

// Create new test database
const db = new sqlite3.Database(TEST_DB_PATH, (err) => {
  if (err) {
    console.error('Error creating test database:', err);
    process.exit(1);
  }
  console.log('Created test database:', TEST_DB_PATH);
});

// Create test tables
const createTables = `
  -- Context Management Tables
  CREATE TABLE IF NOT EXISTS context_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT
  );

  CREATE TABLE IF NOT EXISTS context_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, key)
  );

  -- Knowledge Management Tables
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS document_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL,
    embedding TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (document_id) REFERENCES documents(id)
  );

  -- Agent Coordination Tables
  CREATE TABLE IF NOT EXISTS agent_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    task_type TEXT NOT NULL,
    task_data TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS agent_coordination (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    primary_agent_id TEXT NOT NULL,
    secondary_agent_id TEXT NOT NULL,
    coordination_type TEXT NOT NULL,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_context_messages_session_timestamp 
    ON context_messages(session_id, timestamp);
  
  CREATE INDEX IF NOT EXISTS idx_context_metadata_session 
    ON context_metadata(session_id);
  
  CREATE INDEX IF NOT EXISTS idx_documents_type 
    ON documents(type);
  
  CREATE INDEX IF NOT EXISTS idx_agent_tasks_status 
    ON agent_tasks(status);
`;

// Execute table creation
db.exec(createTables, (err) => {
  if (err) {
    console.error('Error creating tables:', err);
    process.exit(1);
  }
  console.log('Created test database tables');
});

// Insert test data
const insertTestData = `
  -- Insert test documents
  INSERT INTO documents (id, title, content, type, source, metadata) VALUES
  ('test-doc-1', 'Test Document 1', 'This is a test document for integration testing.', 'article', 'test', '{"tags": ["test", "integration"]}'),
  ('test-doc-2', 'Test Document 2', 'Another test document with different content.', 'article', 'test', '{"tags": ["test", "mock"]}'),
  ('test-doc-3', 'Code Example', 'function testFunction() { return "Hello World"; }', 'code', 'test', '{"language": "javascript"}');

  -- Insert test context messages
  INSERT INTO context_messages (session_id, agent_id, content, metadata) VALUES
  ('test-session-1', 'personal-assistant', 'Hello, how can I help you?', '{"type": "greeting"}'),
  ('test-session-1', 'user', 'I need help with my project.', '{"type": "request"}'),
  ('test-session-1', 'personal-assistant', 'I can help you with that. What kind of project?', '{"type": "response"}');

  -- Insert test metadata
  INSERT INTO context_metadata (session_id, key, value) VALUES
  ('test-session-1', 'user_preferences', '{"format": "mobile", "brief": true}'),
  ('test-session-1', 'last_activity', '2024-01-01T10:00:00Z');
`;

db.exec(insertTestData, (err) => {
  if (err) {
    console.error('Error inserting test data:', err);
    process.exit(1);
  }
  console.log('Inserted test data');
});

// Close database connection
db.close((err) => {
  if (err) {
    console.error('Error closing database:', err);
    process.exit(1);
  }
  console.log('Test database setup complete!');
  console.log('Database location:', TEST_DB_PATH);
});