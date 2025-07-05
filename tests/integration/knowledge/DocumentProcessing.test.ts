import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { 
  DocumentProcessor,
  TextDocumentProcessor,
  PDFDocumentProcessor,
  CodeDocumentProcessor,
  JSONDocumentProcessor
} from '../../../src/knowledge/ingestion/DocumentProcessor.js';
import { Document, DocumentType } from '../../../src/types/Knowledge.js';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Document Processing Integration', () => {
  let textProcessor: TextDocumentProcessor;
  let pdfProcessor: PDFDocumentProcessor;
  let codeProcessor: CodeDocumentProcessor;
  let jsonProcessor: JSONDocumentProcessor;

  beforeAll(() => {
    textProcessor = new TextDocumentProcessor();
    pdfProcessor = new PDFDocumentProcessor();
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
        language: 'en'
      };

      const document = await textProcessor.processDocument(
        buffer,
        'text/plain',
        'test-ml-doc.txt',
        metadata
      );

      expect(document.title).toBe('ML Introduction');
      expect(document.content).toContain('Machine learning');
      expect(document.type).toBe('text');
      expect(document.chunks).toBeDefined();
      expect(document.chunks!.length).toBeGreaterThan(1);
      
      // Check chunk structure
      const firstChunk = document.chunks![0];
      expect(firstChunk.content).toBeDefined();
      expect(firstChunk.startIndex).toBe(0);
      expect(firstChunk.metadata.chunkIndex).toBe(0);
      expect(firstChunk.metadata.wordCount).toBeGreaterThan(0);
    });

    it('should handle different text encodings', async () => {
      const content = 'Héllo Wörld! This is a test with unicode characters: 你好世界';
      const buffer = Buffer.from(content, 'utf-8');

      const document = await textProcessor.processDocument(
        buffer,
        'text/plain',
        'unicode-test.txt',
        { title: 'Unicode Test' }
      );

      expect(document.content).toContain('Héllo Wörld');
      expect(document.content).toContain('你好世界');
    });

    it('should create appropriate chunks for long documents', async () => {
      const longContent = 'This is a sentence. '.repeat(500); // ~10,000 characters
      const buffer = Buffer.from(longContent, 'utf-8');

      const document = await textProcessor.processDocument(
        buffer,
        'text/plain',
        'long-doc.txt',
        { title: 'Long Document' }
      );

      expect(document.chunks!.length).toBeGreaterThan(1);
      
      // Verify chunk overlap
      if (document.chunks!.length > 1) {
        const firstChunk = document.chunks![0];
        const secondChunk = document.chunks![1];
        
        expect(firstChunk.endIndex).toBeGreaterThan(firstChunk.startIndex);
        expect(secondChunk.startIndex).toBeLessThan(firstChunk.endIndex); // Overlap
      }
    });
  });

  describe('Code Document Processing', () => {
    it('should process TypeScript files', async () => {
      const codeContent = `/**
 * A utility class for mathematical operations
 */
export class MathUtils {
  /**
   * Calculates the factorial of a number
   * @param n The number to calculate factorial for
   * @returns The factorial result
   */
  public static factorial(n: number): number {
    if (n <= 1) {
      return 1;
    }
    return n * this.factorial(n - 1);
  }

  /**
   * Checks if a number is prime
   * @param num The number to check
   * @returns True if the number is prime
   */
  public static isPrime(num: number): boolean {
    if (num <= 1) return false;
    if (num <= 3) return true;
    if (num % 2 === 0 || num % 3 === 0) return false;
    
    for (let i = 5; i * i <= num; i += 6) {
      if (num % i === 0 || num % (i + 2) === 0) return false;
    }
    return true;
  }
}`;

      const buffer = Buffer.from(codeContent, 'utf-8');
      const document = await codeProcessor.processDocument(
        buffer,
        'application/typescript',
        'MathUtils.ts',
        { title: 'Math Utilities' }
      );

      expect(document.type).toBe('code');
      expect(document.content).toContain('export class MathUtils');
      expect(document.metadata.language).toBe('typescript');
      expect(document.chunks).toBeDefined();
      
      // Code chunks should preserve function boundaries
      const chunks = document.chunks!;
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some(chunk => chunk.content.includes('factorial'))).toBe(true);
      expect(chunks.some(chunk => chunk.content.includes('isPrime'))).toBe(true);
    });

    it('should process Python files', async () => {
      const pythonCode = `"""
A module for data analysis utilities
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Optional

class DataAnalyzer:
    """A class for analyzing datasets"""
    
    def __init__(self, data: pd.DataFrame):
        self.data = data
        self.summary_stats = None
    
    def calculate_summary_stats(self) -> Dict[str, float]:
        """Calculate summary statistics for numerical columns"""
        numerical_cols = self.data.select_dtypes(include=[np.number]).columns
        stats = {}
        
        for col in numerical_cols:
            stats[col] = {
                'mean': self.data[col].mean(),
                'median': self.data[col].median(),
                'std': self.data[col].std(),
                'min': self.data[col].min(),
                'max': self.data[col].max()
            }
        
        self.summary_stats = stats
        return stats
    
    def find_outliers(self, column: str, method: str = 'iqr') -> List[int]:
        """Find outliers in a specific column"""
        if method == 'iqr':
            Q1 = self.data[column].quantile(0.25)
            Q3 = self.data[column].quantile(0.75)
            IQR = Q3 - Q1
            lower_bound = Q1 - 1.5 * IQR
            upper_bound = Q3 + 1.5 * IQR
            
            outliers = self.data[(self.data[column] < lower_bound) | 
                               (self.data[column] > upper_bound)].index.tolist()
            return outliers
        
        return []`;

      const buffer = Buffer.from(pythonCode, 'utf-8');
      const document = await codeProcessor.processDocument(
        buffer,
        'text/x-python',
        'data_analyzer.py',
        { title: 'Data Analyzer' }
      );

      expect(document.type).toBe('code');
      expect(document.metadata.language).toBe('python');
      expect(document.content).toContain('class DataAnalyzer');
      
      // Should extract class and method information
      const chunks = document.chunks!;
      expect(chunks.some(chunk => chunk.content.includes('calculate_summary_stats'))).toBe(true);
      expect(chunks.some(chunk => chunk.content.includes('find_outliers'))).toBe(true);
    });

    it('should handle different programming languages', async () => {
      const languages = [
        { code: 'function hello() { return "Hello"; }', mime: 'application/javascript', file: 'test.js', lang: 'javascript' },
        { code: 'public class Hello { public static void main(String[] args) {} }', mime: 'text/x-java', file: 'Hello.java', lang: 'java' },
        { code: '#include <iostream>\nint main() { return 0; }', mime: 'text/x-c++src', file: 'main.cpp', lang: 'cpp' }
      ];

      for (const { code, mime, file, lang } of languages) {
        const buffer = Buffer.from(code, 'utf-8');
        const document = await codeProcessor.processDocument(buffer, mime, file, { title: 'Test' });
        
        expect(document.type).toBe('code');
        expect(document.metadata.language).toBe(lang);
        expect(document.content).toBe(code);
      }
    });
  });

  describe('JSON Document Processing', () => {
    it('should process structured JSON data', async () => {
      const jsonData = {
        users: [
          {
            id: 1,
            name: 'John Doe',
            email: 'john@example.com',
            profile: {
              age: 30,
              location: 'New York',
              interests: ['programming', 'music', 'travel']
            }
          },
          {
            id: 2,
            name: 'Jane Smith',
            email: 'jane@example.com',
            profile: {
              age: 25,
              location: 'San Francisco',
              interests: ['design', 'photography', 'hiking']
            }
          }
        ],
        metadata: {
          total: 2,
          generated_at: '2023-01-01T00:00:00Z',
          version: '1.0'
        }
      };

      const buffer = Buffer.from(JSON.stringify(jsonData, null, 2), 'utf-8');
      const document = await jsonProcessor.processDocument(
        buffer,
        'application/json',
        'users.json',
        { title: 'User Data' }
      );

      expect(document.type).toBe('structured');
      expect(document.content).toContain('John Doe');
      expect(document.content).toContain('Jane Smith');
      expect(document.metadata.structuredData).toBeDefined();
      
      // Should extract key-value pairs for searchability
      expect(document.content).toContain('programming');
      expect(document.content).toContain('San Francisco');
    });

    it('should handle nested JSON structures', async () => {
      const complexJson = {
        api: {
          version: '2.0',
          endpoints: {
            users: {
              get: '/api/users',
              post: '/api/users',
              parameters: ['id', 'name', 'email']
            },
            posts: {
              get: '/api/posts',
              post: '/api/posts',
              parameters: ['title', 'content', 'author_id']
            }
          }
        },
        config: {
          database: {
            host: 'localhost',
            port: 5432,
            name: 'myapp'
          },
          cache: {
            provider: 'redis',
            ttl: 3600
          }
        }
      };

      const buffer = Buffer.from(JSON.stringify(complexJson, null, 2), 'utf-8');
      const document = await jsonProcessor.processDocument(
        buffer,
        'application/json',
        'api-config.json',
        { title: 'API Configuration' }
      );

      expect(document.content).toContain('/api/users');
      expect(document.content).toContain('redis');
      expect(document.content).toContain('localhost');
      
      // Should preserve nested structure information
      expect(document.content).toContain('endpoints');
      expect(document.content).toContain('database');
    });

    it('should handle invalid JSON gracefully', async () => {
      const invalidJson = '{ "incomplete": "json", "missing": }';
      const buffer = Buffer.from(invalidJson, 'utf-8');

      await expect(
        jsonProcessor.processDocument(buffer, 'application/json', 'invalid.json', { title: 'Invalid' })
      ).rejects.toThrow();
    });
  });

  describe('Document Processor Factory', () => {
    it('should select correct processor based on MIME type', () => {
      const mimeTypeTests = [
        { mimeType: 'text/plain', expectedProcessor: TextDocumentProcessor },
        { mimeType: 'application/pdf', expectedProcessor: PDFDocumentProcessor },
        { mimeType: 'application/javascript', expectedProcessor: CodeDocumentProcessor },
        { mimeType: 'text/x-python', expectedProcessor: CodeDocumentProcessor },
        { mimeType: 'application/json', expectedProcessor: JSONDocumentProcessor }
      ];

      for (const { mimeType, expectedProcessor } of mimeTypeTests) {
        const processor = DocumentProcessor.getProcessor(mimeType);
        expect(processor).toBeInstanceOf(expectedProcessor);
      }
    });

    it('should handle unknown MIME types', () => {
      const processor = DocumentProcessor.getProcessor('application/unknown');
      expect(processor).toBeInstanceOf(TextDocumentProcessor); // Should fall back to text
    });
  });

  describe('Chunk Quality and Consistency', () => {
    it('should maintain chunk boundaries at sentence level', async () => {
      const content = `First sentence here. Second sentence follows. Third sentence completes the thought. 
      
      This is a new paragraph with more content. It has multiple sentences too. Each sentence should be preserved.
      
      Final paragraph to test chunking behavior. This ensures proper boundary detection.`;

      const buffer = Buffer.from(content, 'utf-8');
      const document = await textProcessor.processDocument(
        buffer,
        'text/plain',
        'boundary-test.txt',
        { title: 'Boundary Test' }
      );

      const chunks = document.chunks!;
      
      // Each chunk should start and end at reasonable boundaries
      for (const chunk of chunks) {
        expect(chunk.content.trim().length).toBeGreaterThan(0);
        
        // Shouldn't cut off mid-sentence (basic check)
        if (!chunk.content.trim().endsWith('.') && 
            !chunk.content.trim().endsWith('!') && 
            !chunk.content.trim().endsWith('?')) {
          // Last chunk might not end with punctuation
          expect(chunk.metadata.chunkIndex).toBe(chunks.length - 1);
        }
      }
    });

    it('should handle edge cases in chunking', async () => {
      const edgeCases = [
        '', // Empty content
        'A', // Single character
        'Short text.', // Very short content
        'No punctuation here' // No sentence endings
      ];

      for (const content of edgeCases) {
        const buffer = Buffer.from(content, 'utf-8');
        const document = await textProcessor.processDocument(
          buffer,
          'text/plain',
          'edge-case.txt',
          { title: 'Edge Case' }
        );

        expect(document.content).toBe(content);
        if (content.length > 0) {
          expect(document.chunks!.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Metadata Extraction', () => {
    it('should extract comprehensive metadata', async () => {
      const content = 'Test document content with various characteristics.';
      const buffer = Buffer.from(content, 'utf-8');
      
      const inputMetadata = {
        title: 'Test Document',
        author: 'Test Author',
        tags: ['test', 'sample'],
        language: 'en',
        customField: 'custom value'
      };

      const document = await textProcessor.processDocument(
        buffer,
        'text/plain',
        'metadata-test.txt',
        inputMetadata
      );

      expect(document.metadata.author).toBe('Test Author');
      expect(document.metadata.tags).toEqual(['test', 'sample']);
      expect(document.metadata.language).toBe('en');
      expect(document.metadata.fileSize).toBe(buffer.length);
      expect(document.metadata.mimeType).toBe('text/plain');
      expect(document.metadata.extractedAt).toBeInstanceOf(Date);
      expect(document.metadata.processingVersion).toBeDefined();
    });

    it('should calculate accurate statistics', async () => {
      const content = 'This is a test document. It has multiple sentences. Word count should be accurate.';
      const buffer = Buffer.from(content, 'utf-8');

      const document = await textProcessor.processDocument(
        buffer,
        'text/plain',
        'stats-test.txt',
        { title: 'Stats Test' }
      );

      const expectedWordCount = content.split(/\s+/).length;
      
      // Check document-level stats
      expect(document.metadata.fileSize).toBe(buffer.length);
      
      // Check chunk-level stats
      let totalChunkWords = 0;
      for (const chunk of document.chunks!) {
        expect(chunk.metadata.wordCount).toBeGreaterThan(0);
        totalChunkWords += chunk.metadata.wordCount!;
      }
      
      // Total words in chunks should match or be close to document word count
      expect(Math.abs(totalChunkWords - expectedWordCount)).toBeLessThanOrEqual(2);
    });
  });
});