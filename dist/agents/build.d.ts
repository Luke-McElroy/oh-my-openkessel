import type { PluginInput } from '@opencode-ai/plugin';
import type { HandoffMessage, AgentResult } from '../types/index.js';
export declare class BuildAgent {
    private ctx;
    private projectPath;
    constructor(ctx: PluginInput, projectPath: string);
    execute(handoff: HandoffMessage): Promise<AgentResult>;
    private formatPrompt;
    private parseResult;
    private getOrCreateSession;
}
//# sourceMappingURL=build.d.ts.map