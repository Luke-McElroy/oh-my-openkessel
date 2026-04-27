import type { PluginInput } from '@opencode-ai/plugin';
import type { HandoffMessage, AgentResult } from '../types/index.js';
export declare class DocumentAgent {
    private ctx;
    private projectPath;
    constructor(ctx: PluginInput, projectPath: string);
    execute(handoff: HandoffMessage): Promise<AgentResult>;
    private formatPrompt;
    private parseResult;
    private getOrCreateSession;
}
//# sourceMappingURL=document.d.ts.map