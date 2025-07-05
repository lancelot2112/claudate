import { describe, it, expect, beforeAll } from '@jest/globals';
import { 
  TextDocumentProcessor,
  CodeDocumentProcessor,
  JSONDocumentProcessor
} from '../../../src/knowledge/ingestion/DocumentProcessor';

describe('Document Processing Integration', () => {
  let textProcessor: TextDocumentProcessor;
  let codeProcessor: CodeDocumentProcessor;
  let jsonProcessor: JSONDocumentProcessor;

  beforeAll(() => {
    textProcessor = new TextDocumentProcessor();
    codeProcessor = new CodeDocumentProcessor();
    jsonProcessor = new JSONDocumentProcessor();
  });

  describe('Text Document Processing', () => {
    it('should process plain text documents', async () => {
      const content = `# Introduction to Machine Learning

Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed.

## Key Concepts

1. **Supervised Learning**: Learning with labeled data
2. **Unsupervised Learning**: Finding patterns in unlabeled data
3. **Reinforcement Learning**: Learning through interaction and feedback

## Applications

Machine learning has applications in:
- Image recognition
- Natural language processing
- Recommendation systems
- Autonomous vehicles

## Conclusion

Machine learning continues to evolve and transform various industries.`;

      const buffer = Buffer.from(content, 'utf-8');
      const metadata = {
        title: 'ML Introduction',
        author: 'AI Researcher',
        tags: ['machine-learning', 'ai'],
        language: 'en',
        source: 'test',
        extractedAt: new Date(),
        processingVersion: '1.0'
      };

      const document = await textProcessor.process(buffer, metadata);

      expect(document).toBeDefined();
      expect(document.content).toBe(content);
      expect(document.metadata.title).toBe('ML Introduction');
      expect(document.chunks.length).toBeGreaterThan(0);
      
      // Should create appropriate chunks
      const firstChunk = document.chunks[0];
      expect(firstChunk?.content).toContain('Machine learning');
      expect(firstChunk?.metadata.chunkIndex).toBe(0);
    });

    it('should handle markdown formatting', async () => {
      const content = `# Markdown Test

This document tests **markdown** formatting with *emphasis* and [links](http://example.com).

## Code Examples

\`\`\`python
def hello_world():
    print("Hello, World!")
\`\`\`

## Lists

- Item 1
- Item 2
- Item 3`;

      const buffer = Buffer.from(content, 'utf-8');
      const metadata = {
        title: 'Markdown Test',
        author: 'Test Author',
        tags: ['markdown', 'test'],
        language: 'en',
        source: 'test',
        extractedAt: new Date(),
        processingVersion: '1.0'
      };

      const document = await textProcessor.process(buffer, metadata);

      expect(document.content).toBe(content);
      expect(document.chunks.length).toBeGreaterThan(0);
      expect(document.chunks.some(chunk => chunk.content.includes('markdown'))).toBe(true);
    });

    it('should chunk long documents appropriately', async () => {
      const longContent = 'This is a long sentence that will be repeated many times. '.repeat(100);
      const buffer = Buffer.from(longContent, 'utf-8');
      const metadata = {
        title: 'Long Document',
        author: 'Test Author',
        source: 'test',
        language: 'en',
        tags: [],
        extractedAt: new Date(),
        processingVersion: '1.0'
      };

      const document = await textProcessor.process(buffer, metadata);

      expect(document.chunks.length).toBeGreaterThan(1);
      expect(document.chunks.every(chunk => chunk.content.length > 0)).toBe(true);
    });
  });

  describe('Code Document Processing', () => {
    it('should process JavaScript code files', async () => {
      const jsCode = `/**
 * Utility functions for mathematical operations
 */

function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

function isPrime(num) {
  if (num <= 1) return false;
  if (num <= 3) return true;
  if (num % 2 === 0 || num % 3 === 0) return false;
  
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false;
  }
  return true;
}

export { factorial, isPrime };`;

      const buffer = Buffer.from(jsCode, 'utf-8');
      const metadata = {
        title: 'Math Utils',
        author: 'Developer',
        source: 'test',
        language: 'javascript',
        tags: ['math', 'utils'],
        extractedAt: new Date(),
        processingVersion: '1.0'
      };

      const document = await codeProcessor.process(buffer, metadata);

      expect(document.content).toBe(jsCode);
      expect(document.chunks.length).toBeGreaterThan(0);
      
      const chunks = document.chunks;
      expect(chunks.some((chunk: any) => chunk.content.includes('factorial'))).toBe(true);
      expect(chunks.some((chunk: any) => chunk.content.includes('isPrime'))).toBe(true);
    });

    it('should identify functions and classes in code', async () => {
      const pythonCode = `class Calculator:
    """A simple calculator class"""
    
    def __init__(self):
        self.history = []
    
    def add(self, a, b):
        result = a + b
        self.history.append(f"{a} + {b} = {result}")
        return result
    
    def multiply(self, a, b):
        result = a * b
        self.history.append(f"{a} * {b} = {result}")
        return result

def calculate_summary_stats(data):
    """Calculate basic statistics for a dataset"""
    return {
        'mean': sum(data) / len(data),
        'min': min(data),
        'max': max(data),
        'count': len(data)
    }`;

      const buffer = Buffer.from(pythonCode, 'utf-8');
      const metadata = {
        title: 'Calculator',
        author: 'Python Developer',
        source: 'test',
        language: 'python',
        tags: ['python', 'calculator'],
        extractedAt: new Date(),
        processingVersion: '1.0'
      };

      const document = await codeProcessor.process(buffer, metadata);

      expect(document.content).toBe(pythonCode);
      const chunks = document.chunks;
      expect(chunks.some((chunk: any) => chunk.content.includes('calculate_summary_stats'))).toBe(true);
      expect(chunks.some((chunk: any) => chunk.content.includes('class Calculator'))).toBe(true);
    });
  });

  describe('JSON Document Processing', () => {
    it('should process JSON configuration files', async () => {
      const jsonData = {
        name: 'test-project',
        version: '1.0.0',
        description: 'A test project configuration',
        dependencies: {
          'express': '^4.18.0',
          'lodash': '^4.17.21'
        },
        scripts: {
          start: 'node index.js',
          test: 'jest',
          build: 'webpack'
        },
        keywords: ['test', 'configuration', 'json']
      };

      const buffer = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8');
      const metadata = {
        title: 'Package Configuration',
        author: 'Config Manager',
        source: 'test',
        language: 'json',
        tags: ['config', 'package'],
        extractedAt: new Date(),
        processingVersion: '1.0'
      };

      const document = await jsonProcessor.process(buffer, metadata);

      expect(document.content).toContain('test-project');
      expect(document.chunks.length).toBeGreaterThan(0);
      expect(document.metadata.tags).toContain('config');
      expect(document.metadata.tags).toContain('package');
      expect(document.metadata.mimeType).toBe('application/json');
    });

    it('should handle complex nested JSON', async () => {
      const complexJson = {
        users: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            preferences: {
              theme: 'dark',
              notifications: true,
              privacy: {
                profileVisible: false,
                dataSharing: 'limited'
              }
            }
          },
          {
            id: 2,
            name: 'Jane Smith',
            email: 'jane@example.com',
            preferences: {
              theme: 'light',
              notifications: false,
              privacy: {
                profileVisible: true,
                dataSharing: 'full'
              }
            }
          }
        ],
        settings: {
          version: '2.1',
          features: ['analytics', 'reporting', 'automation']
        }
      };

      const buffer = Buffer.from(JSON.stringify(complexJson, null, 2), 'utf-8');
      const metadata = {
        title: 'User Data',
        author: 'Data Manager',
        source: 'test',
        language: 'json',
        tags: ['users', 'data'],
        extractedAt: new Date(),
        processingVersion: '1.0'
      };

      const document = await jsonProcessor.process(buffer, metadata);

      expect(document.content).toContain('John Doe');
      expect(document.content).toContain('Jane Smith');
      expect(document.chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Processor Support Detection', () => {
    it('should correctly identify supported MIME types', () => {
      expect(textProcessor.supports('text/plain')).toBe(true);
      expect(textProcessor.supports('text/markdown')).toBe(true);
      expect(textProcessor.supports('application/pdf')).toBe(false);

      expect(codeProcessor.supports('text/javascript')).toBe(true);
      expect(codeProcessor.supports('text/x-python')).toBe(true);
      expect(codeProcessor.supports('text/plain')).toBe(false);

      expect(jsonProcessor.supports('application/json')).toBe(true);
      expect(jsonProcessor.supports('text/plain')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const malformedJson = '{ "incomplete": json data }';
      const buffer = Buffer.from(malformedJson, 'utf-8');
      const metadata = {
        title: 'Malformed JSON',
        author: 'Test',
        source: 'test',
        language: 'json',
        tags: [],
        extractedAt: new Date(),
        processingVersion: '1.0'
      };

      await expect(jsonProcessor.process(buffer, metadata)).rejects.toThrow();
    });

    it('should handle empty content', async () => {
      const buffer = Buffer.from('', 'utf-8');
      const metadata = {
        title: 'Empty Document',
        author: 'Test',
        source: 'test',
        language: 'en',
        tags: [],
        extractedAt: new Date(),
        processingVersion: '1.0'
      };

      const document = await textProcessor.process(buffer, metadata);
      
      expect(document.content).toBe('');
      expect(document.chunks.length).toBe(0);
    });

    it('should handle very large content', async () => {
      const largeContent = 'Large content chunk. '.repeat(10000);
      const buffer = Buffer.from(largeContent, 'utf-8');
      const metadata = {
        title: 'Large Document',
        author: 'Test',
        source: 'test',
        language: 'en',
        tags: [],
        extractedAt: new Date(),
        processingVersion: '1.0'
      };

      const document = await textProcessor.process(buffer, metadata);
      
      expect(document.content).toContain('Large content chunk');
      expect(document.content.length).toBeGreaterThan(10000); // Verify it's still large
      expect(document.chunks.length).toBeGreaterThan(1);
    });
  });
});