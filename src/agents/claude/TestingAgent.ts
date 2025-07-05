import { BaseAgent } from '../base/Agent.js';
import { AgentContext, AgentResult, AgentConfig } from '../../types/Agent.js';
import { AnthropicClient, AnthropicResponse } from '../../integrations/ai/AnthropicClient.js';
import logger from '../../utils/logger.js';

export interface TestingTask {
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'security' | 'smoke';
  targetCode: string;
  framework?: string;
  testEnvironment?: string;
  coverage?: {
    required: number;
    current?: number;
  };
  constraints?: string[];
  existingTests?: string;
}

export interface TestingResult extends AgentResult {
  testCode?: string;
  testRunner?: string;
  coverage?: {
    estimated: number;
    areas: string[];
  };
  recommendations?: string[];
  executionPlan?: string;
  mockingStrategy?: string;
}

export class TestingAgent extends BaseAgent {
  private anthropicClient: AnthropicClient;

  constructor(config: AgentConfig) {
    super({
      ...config,
      name: 'TestingAgent',
      type: 'execution',
      capabilities: [
        'unit_testing',
        'integration_testing',
        'e2e_testing',
        'performance_testing',
        'security_testing',
        'test_automation',
        'coverage_analysis',
        'mock_generation'
      ]
    });

    this.anthropicClient = new AnthropicClient({
      defaultModel: 'claude-3-sonnet-20240229',
      temperature: 0.2, // Very low temperature for testing precision
      maxTokens: 8192
    });

    logger.info('TestingAgent initialized', { 
      agentId: this.id, 
      model: 'claude-3-sonnet-20240229' 
    });
  }

  public async executeTask(context: AgentContext): Promise<TestingResult> {
    try {
      this.updateStatus('processing');
      
      const task = this.parseTask(context);
      logger.info('TestingAgent executing task', { 
        agentId: this.id, 
        testType: task.type,
        framework: task.framework 
      });

      let result: TestingResult;

      switch (task.type) {
        case 'unit':
          result = await this.generateUnitTests(task, context);
          break;
        case 'integration':
          result = await this.generateIntegrationTests(task, context);
          break;
        case 'e2e':
          result = await this.generateE2ETests(task, context);
          break;
        case 'performance':
          result = await this.generatePerformanceTests(task, context);
          break;
        case 'security':
          result = await this.generateSecurityTests(task, context);
          break;
        case 'smoke':
          result = await this.generateSmokeTests(task, context);
          break;
        default:
          throw new Error(`Unknown testing task type: ${task.type}`);
      }

      this.updateStatus('completed');
      this.updateMetrics({
        testType: task.type,
        framework: task.framework,
        duration: Date.now() - context.timestamp.getTime()
      });

      return result;
    } catch (error) {
      this.updateStatus('failed');
      logger.error('TestingAgent task failed', { 
        agentId: this.id, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        agentId: this.id,
        timestamp: Date.now()
      };
    }
  }

  private parseTask(context: AgentContext): TestingTask {
    const { task } = context;
    
    if (typeof task === 'object' && task !== null) {
      return task as TestingTask;
    }

    throw new Error('Invalid testing task format');
  }

  private async generateUnitTests(task: TestingTask, context: AgentContext): Promise<TestingResult> {
    const prompt = `Generate comprehensive unit tests for the following code:

${task.targetCode}

${task.framework ? `Testing framework: ${task.framework}` : ''}
${task.testEnvironment ? `Test environment: ${task.testEnvironment}` : ''}

${task.coverage ? `Coverage requirement: ${task.coverage.required}%` : ''}

${task.constraints ? `Constraints:
${task.constraints.map(c => `- ${c}`).join('\n')}` : ''}

${task.existingTests ? `Existing tests to extend:
${task.existingTests}` : ''}

Please provide:
1. Complete unit test suite
2. Test cases for happy paths
3. Edge case testing
4. Error handling tests
5. Mock setup where needed
6. Coverage analysis
7. Test execution instructions`;

    const response = await this.anthropicClient.sendTestingRequest(task.targetCode, 'unit');
    const parsedResult = this.parseTestResponse(response, 'unit');

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      testCode: parsedResult.testCode,
      testRunner: parsedResult.testRunner,
      coverage: parsedResult.coverage,
      recommendations: parsedResult.recommendations,
      executionPlan: parsedResult.executionPlan,
      mockingStrategy: parsedResult.mockingStrategy
    };
  }

  private async generateIntegrationTests(task: TestingTask, context: AgentContext): Promise<TestingResult> {
    const prompt = `Generate integration tests for the following code:

${task.targetCode}

${task.framework ? `Testing framework: ${task.framework}` : ''}
${task.testEnvironment ? `Test environment: ${task.testEnvironment}` : ''}

Focus on:
1. Component interactions
2. API integrations
3. Database interactions
4. External service dependencies
5. Data flow validation
6. Configuration testing

Please provide:
1. Complete integration test suite
2. Setup and teardown procedures
3. Mock/stub strategies for external dependencies
4. Test data management
5. Environment configuration
6. Test execution workflow`;

    const response = await this.anthropicClient.sendTestingRequest(task.targetCode, 'integration');
    const parsedResult = this.parseTestResponse(response, 'integration');

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      testCode: parsedResult.testCode,
      testRunner: parsedResult.testRunner,
      coverage: parsedResult.coverage,
      recommendations: parsedResult.recommendations,
      executionPlan: parsedResult.executionPlan,
      mockingStrategy: parsedResult.mockingStrategy
    };
  }

  private async generateE2ETests(task: TestingTask, context: AgentContext): Promise<TestingResult> {
    const prompt = `Generate end-to-end tests for the following application/feature:

${task.targetCode}

${task.framework ? `E2E framework: ${task.framework}` : ''}
${task.testEnvironment ? `Test environment: ${task.testEnvironment}` : ''}

Focus on:
1. Complete user workflows
2. Cross-browser compatibility
3. User interface interactions
4. Data persistence validation
5. Performance characteristics
6. Error scenarios

Please provide:
1. Complete E2E test suite
2. Page object models (if applicable)
3. Test data setup/cleanup
4. Browser configuration
5. Parallel execution strategy
6. Reporting and screenshots`;

    const response = await this.anthropicClient.sendTestingRequest(task.targetCode, 'e2e');
    const parsedResult = this.parseTestResponse(response, 'e2e');

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      testCode: parsedResult.testCode,
      testRunner: parsedResult.testRunner,
      coverage: parsedResult.coverage,
      recommendations: parsedResult.recommendations,
      executionPlan: parsedResult.executionPlan
    };
  }

  private async generatePerformanceTests(task: TestingTask, context: AgentContext): Promise<TestingResult> {
    const prompt = `Generate performance tests for the following code:

${task.targetCode}

${task.framework ? `Performance testing framework: ${task.framework}` : ''}

Focus on:
1. Load testing scenarios
2. Stress testing boundaries
3. Memory usage analysis
4. Response time validation
5. Throughput measurements
6. Resource utilization

Please provide:
1. Performance test suite
2. Load generation scripts
3. Performance benchmarks
4. Monitoring setup
5. Result analysis procedures
6. Performance optimization recommendations`;

    const response = await this.anthropicClient.sendMessage({
      messages: [{ role: 'user', content: prompt }],
      system: 'You are an expert performance test engineer. Create comprehensive performance tests that measure and validate system performance characteristics.',
      temperature: 0.2
    });

    const parsedResult = this.parseTestResponse(response, 'performance');

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      testCode: parsedResult.testCode,
      testRunner: parsedResult.testRunner,
      recommendations: parsedResult.recommendations,
      executionPlan: parsedResult.executionPlan
    };
  }

  private async generateSecurityTests(task: TestingTask, context: AgentContext): Promise<TestingResult> {
    const prompt = `Generate security tests for the following code:

${task.targetCode}

Focus on:
1. Input validation testing
2. Authentication/authorization testing
3. SQL injection prevention
4. XSS vulnerability testing
5. CSRF protection validation
6. Data encryption verification
7. Access control testing

Please provide:
1. Security test suite
2. Vulnerability scanning scripts
3. Penetration test scenarios
4. Security configuration validation
5. Compliance checking procedures
6. Security remediation recommendations`;

    const response = await this.anthropicClient.sendMessage({
      messages: [{ role: 'user', content: prompt }],
      system: 'You are an expert security test engineer. Create comprehensive security tests that identify vulnerabilities and validate security controls.',
      temperature: 0.1
    });

    const parsedResult = this.parseTestResponse(response, 'security');

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      testCode: parsedResult.testCode,
      testRunner: parsedResult.testRunner,
      recommendations: parsedResult.recommendations,
      executionPlan: parsedResult.executionPlan
    };
  }

  private async generateSmokeTests(task: TestingTask, context: AgentContext): Promise<TestingResult> {
    const prompt = `Generate smoke tests for the following system:

${task.targetCode}

${task.framework ? `Testing framework: ${task.framework}` : ''}

Focus on:
1. Critical path validation
2. Basic functionality verification
3. System health checks
4. Core feature availability
5. Quick regression detection

Please provide:
1. Minimal smoke test suite
2. Fast execution tests
3. Critical failure detection
4. System readiness validation
5. Quick feedback mechanisms`;

    const response = await this.anthropicClient.sendMessage({
      messages: [{ role: 'user', content: prompt }],
      system: 'You are an expert test engineer. Create minimal but effective smoke tests that quickly validate system health and critical functionality.',
      temperature: 0.2
    });

    const parsedResult = this.parseTestResponse(response, 'smoke');

    return {
      success: true,
      agentId: this.id,
      timestamp: Date.now(),
      testCode: parsedResult.testCode,
      testRunner: parsedResult.testRunner,
      recommendations: parsedResult.recommendations,
      executionPlan: parsedResult.executionPlan
    };
  }

  private parseTestResponse(response: AnthropicResponse, testType: string): {
    testCode?: string;
    testRunner?: string;
    coverage?: { estimated: number; areas: string[] };
    recommendations?: string[];
    executionPlan?: string;
    mockingStrategy?: string;
  } {
    const content = response.content;
    
    // Extract test code blocks
    const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
    const testCode = codeBlocks.map(block => 
      block.replace(/```\w*\n?|\n?```/g, '').trim()
    ).join('\n\n');

    // Extract test runner information
    const runnerMatch = content.match(/(?:test runner|framework|command):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const testRunner = runnerMatch?.[1]?.trim();

    // Extract coverage information
    const coverageMatch = content.match(/(?:coverage|estimated coverage):\s*(\d+)%/i);
    const coveragePercent = coverageMatch ? parseInt(coverageMatch[1]) : undefined;
    
    const areasMatch = content.match(/(?:coverage areas|test areas):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const areas = areasMatch?.[1]
      ?.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map(line => line.trim().replace(/^[-•]\s*/, ''));

    // Extract recommendations
    const recommendationsMatch = content.match(/(?:recommendations|suggestions):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const recommendations = recommendationsMatch?.[1]
      ?.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map(line => line.trim().replace(/^[-•]\s*/, ''));

    // Extract execution plan
    const executionMatch = content.match(/(?:execution|run|command):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const executionPlan = executionMatch?.[1]?.trim();

    // Extract mocking strategy
    const mockingMatch = content.match(/(?:mock|mocking|stub):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const mockingStrategy = mockingMatch?.[1]?.trim();

    return {
      testCode,
      testRunner,
      coverage: coveragePercent ? {
        estimated: coveragePercent,
        areas: areas || []
      } : undefined,
      recommendations,
      executionPlan,
      mockingStrategy
    };
  }

  public async analyzeTestCoverage(code: string, tests: string): Promise<{
    coverage: number;
    uncoveredAreas: string[];
    recommendations: string[];
  }> {
    const prompt = `Analyze test coverage for the following code and tests:

CODE:
${code}

TESTS:
${tests}

Please provide:
1. Estimated test coverage percentage
2. Uncovered code areas
3. Missing test scenarios
4. Recommendations for improving coverage`;

    const response = await this.anthropicClient.sendMessage({
      messages: [{ role: 'user', content: prompt }],
      system: 'You are an expert test coverage analyst. Analyze code and tests to provide accurate coverage assessment and improvement recommendations.',
      temperature: 0.1
    });

    const content = response.content;
    const coverageMatch = content.match(/coverage:\s*(\d+)%/i);
    const coverage = coverageMatch ? parseInt(coverageMatch[1]) : 0;

    const uncoveredMatch = content.match(/(?:uncovered|missing):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const uncoveredAreas = uncoveredMatch?.[1]
      ?.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map(line => line.trim().replace(/^[-•]\s*/, '')) || [];

    const recommendationsMatch = content.match(/(?:recommendations|suggestions):\s*([\s\S]*?)(?:\n\n|\n#|$)/i);
    const recommendations = recommendationsMatch?.[1]
      ?.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
      .map(line => line.trim().replace(/^[-•]\s*/, '')) || [];

    return {
      coverage,
      uncoveredAreas,
      recommendations
    };
  }

  public async getCapabilities(): Promise<string[]> {
    return [
      'Generate comprehensive unit tests',
      'Create integration test suites',
      'Build end-to-end test scenarios',
      'Develop performance testing scripts',
      'Design security test cases',
      'Create smoke test suites',
      'Analyze test coverage',
      'Generate mocking strategies',
      'Create test automation frameworks',
      'Provide testing best practices'
    ];
  }
}

export default TestingAgent;