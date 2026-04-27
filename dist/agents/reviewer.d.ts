import type { PluginInput } from '@opencode-ai/plugin';
import type { HandoffMessage, AgentResult, OutOfScopeFlag } from '../types/index.js';
export declare class ReviewerAgent {
    private ctx;
    private projectPath;
    constructor(ctx: PluginInput, projectPath: string);
    execute(handoff: HandoffMessage, buildResult: AgentResult, testResult: AgentResult): Promise<AgentResult>;
    evaluateOutOfScopeFlags(handoff: HandoffMessage, flags: OutOfScopeFlag[]): Promise<AgentResult>;
    private formatPrompt;
    private parseResult;
    private getOrCreateSession;
}
//# sourceMappingURL=reviewer.d.ts.map