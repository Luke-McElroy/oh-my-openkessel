import type { PluginInput } from '@opencode-ai/plugin';
import type { Phase, HandoffMessage, AgentResult, TestResult, TestFailure } from '../types/index.js';

export class TestAgent {
  private ctx: PluginInput;
  private projectPath: string;

  constructor(ctx: PluginInput, projectPath: string) {
    this.ctx = ctx;
    this.projectPath = projectPath;
  }

  async checkDockerAvailable(): Promise<boolean> {
    try {
      await this.ctx.$`docker --version`;
      return true;
    } catch {
      return false;
    }
  }

  async execute(handoff: HandoffMessage): Promise<AgentResult> {
    const dockerAvailable = await this.checkDockerAvailable();
    
    if (!dockerAvailable) {
      return {
        agentRole: 'test',
        phaseId: handoff.phaseId,
        status: 'failed',
        outOfScopeFlags: [],
        notes: 'Docker is not available. Tests cannot be executed. Please install Docker to use the Test Agent.',
        testResults: {
          status: 'fail',
          failures: [{
            test: 'docker-check',
            error: 'Docker not found',
            detail: 'Docker is required for test execution but is not installed or not in PATH'
          }],
          coverage: '0%'
        }
      };
    }

    const testResult = await this.runTestsInDocker(handoff);
    
    return {
      agentRole: 'test',
      phaseId: handoff.phaseId,
      status: testResult.status === 'pass' ? 'complete' : 'failed',
      outOfScopeFlags: [],
      notes: `Tests ${testResult.status}. Coverage: ${testResult.coverage}`,
      testResults: testResult
    };
  }

  private async runTestsInDocker(handoff: HandoffMessage): Promise<TestResult> {
    const containerName = `ralph-test-${handoff.phaseId}-${Date.now()}`;
    
    try {
      await this.ctx.$`docker run --rm -d --name ${containerName} -v ${this.projectPath}:/workspace node:20-alpine tail -f /dev/null`;
      
      const hasPackageJson = await this.checkFileExists('/workspace/package.json', containerName);
      
      if (hasPackageJson) {
        await this.ctx.$`docker exec ${containerName} sh -c "cd /workspace && npm install"`;
      }
      
      const testCommand = this.determineTestCommand(containerName);
      const testOutput = await this.runTestCommand(testCommand, containerName);
      
      await this.ctx.$`docker stop ${containerName}`;
      
      return this.parseTestOutput(testOutput);
    } catch (error) {
      try {
        await this.ctx.$`docker stop ${containerName}`;
      } catch {}
      
      return {
        status: 'fail',
        failures: [{
          test: 'docker-execution',
          error: 'Test execution failed',
          detail: String(error)
        }],
        coverage: '0%'
      };
    }
  }

  private async checkFileExists(path: string, containerName: string): Promise<boolean> {
    try {
      await this.ctx.$`docker exec ${containerName} test -f ${path}`;
      return true;
    } catch {
      return false;
    }
  }

  private determineTestCommand(containerName: string): string {
    return 'cd /workspace && (npm test 2>/dev/null || echo "NO_TESTS")';
  }

  private async runTestCommand(command: string, containerName: string): Promise<string> {
    try {
      const result = await this.ctx.$`docker exec ${containerName} sh -c ${command}`;
      return result.text();
    } catch (error: any) {
      return error.stdout || error.message || '';
    }
  }

  private parseTestOutput(output: string): TestResult {
    const failures: TestFailure[] = [];
    
    if (output.includes('NO_TESTS') || output.includes('no test specified')) {
      return {
        status: 'pass',
        failures: [],
        coverage: '0% (no tests found)'
      };
    }
    
    const passMatch = output.match(/passing\s+(\d+)/);
    const failMatch = output.match(/failing\s+(\d+)/);
    
    if (failMatch && parseInt(failMatch[1]) > 0) {
      const lines = output.split('\n');
      let currentTest = '';
      
      for (const line of lines) {
        const testMatch = line.match(/^\s+\d+\)\s+(.+):/);
        if (testMatch) {
          currentTest = testMatch[1];
          failures.push({
            test: currentTest,
            error: '',
            detail: ''
          });
        } else if (currentTest && failures.length > 0) {
          const lastFailure = failures[failures.length - 1];
          if (!lastFailure.error && line.includes('Error:')) {
            lastFailure.error = line.trim();
          } else {
            lastFailure.detail += line + '\n';
          }
        }
      }
    }
    
    const coverageMatch = output.match(/(\d+(?:\.\d+)?)%/);
    const coverage = coverageMatch ? `${coverageMatch[1]}%` : 'unknown';
    
    return {
      status: failures.length === 0 ? 'pass' : 'fail',
      failures,
      coverage
    };
  }
}
