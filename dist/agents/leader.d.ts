import type { PluginInput } from '@opencode-ai/plugin';
export declare class LeaderAgent {
    private ctx;
    private state;
    private projectPath;
    private buildAgent;
    private testAgent;
    private documentAgent;
    private reviewerAgent;
    private planAgent;
    constructor(ctx: PluginInput, projectPath: string);
    initialize(assumeMode?: boolean): Promise<void>;
    run(): Promise<string>;
    private runPhase;
    private attemptRescope;
    private createHandoffMessage;
    private insertPhase;
    private writeMemory;
    private extractKeywords;
    private getPhaseMemories;
    private getPriorMemories;
    private saveState;
    getStatus(): Promise<string>;
    resume(): Promise<string>;
}
//# sourceMappingURL=leader.d.ts.map