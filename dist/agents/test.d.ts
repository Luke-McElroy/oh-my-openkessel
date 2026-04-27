import type { PluginInput } from '@opencode-ai/plugin';
import type { HandoffMessage, AgentResult } from '../types/index.js';
export declare class TestAgent {
    private ctx;
    private projectPath;
    constructor(ctx: PluginInput, projectPath: string);
    checkDockerAvailable(): Promise<boolean>;
    execute(handoff: HandoffMessage): Promise<AgentResult>;
    private runTestsInDocker;
    private checkFileExists;
    private determineTestCommand;
    private runTestCommand;
    private parseTestOutput;
}
//# sourceMappingURL=test.d.ts.map