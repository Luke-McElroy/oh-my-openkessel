import type { PluginInput } from '@opencode-ai/plugin';
import type { Phase, Memory } from '../types/index.js';
export declare class PlanAgent {
    private ctx;
    private projectPath;
    constructor(ctx: PluginInput, projectPath: string);
    initialize(projectGoal: string, techStack?: string, constraints?: string): Promise<string>;
    rescope(phaseId: number, failureContext: string, memories: Memory[]): Promise<string>;
    insertPhase(afterPhaseId: number, phaseSuggestion: Partial<Phase>): Promise<string>;
    private generatePRD;
    private generatePhases;
    private regeneratePhase;
    private getOrCreateSession;
}
//# sourceMappingURL=plan.d.ts.map