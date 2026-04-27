export class BuildAgent {
    ctx;
    projectPath;
    constructor(ctx, projectPath) {
        this.ctx = ctx;
        this.projectPath = projectPath;
    }
    async execute(handoff) {
        const prompt = this.formatPrompt(handoff);
        const sessionId = await this.getOrCreateSession();
        const result = await this.ctx.client.session.prompt({
            path: { id: sessionId },
            body: {
                parts: [{ type: 'text', text: prompt }],
                format: {
                    type: 'json_schema',
                    schema: {
                        type: 'object',
                        properties: {
                            status: { type: 'string', enum: ['complete', 'failed'] },
                            outOfScopeFlags: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        description: { type: 'string' },
                                        suggestedPhaseName: { type: 'string' },
                                        suggestedInsertionAfterPhase: { type: 'number' }
                                    }
                                }
                            },
                            notes: { type: 'string' },
                            filesModified: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['status', 'outOfScopeFlags', 'notes']
                    }
                }
            },
        });
        return this.parseResult(result);
    }
    formatPrompt(handoff) {
        return JSON.stringify({
            role: 'build',
            phaseId: handoff.phaseId,
            phaseGoal: handoff.phaseGoal,
            acceptanceCriteria: handoff.acceptanceCriteria,
            iteration: handoff.iteration,
            priorMemories: handoff.priorMemories,
            priorFailures: handoff.priorFailures,
            assumeMode: handoff.assumeMode,
            projectPath: this.projectPath,
            instructions: `You are the Build Agent. Your task is to write code to satisfy the phase goal.

STRICT RULES:
1. Stay within the phase scope defined in acceptance criteria
2. Write minimal code that solves the problem - no speculative abstractions
3. Flag any out-of-scope work you discover
4. Modify files using Bash tool
5. Return structured JSON result

Return format:
{
  "status": "complete" | "failed",
  "outOfScopeFlags": [...],
  "notes": "summary of what was built",
  "filesModified": ["src/file.ts", ...]
}`
        }, null, 2);
    }
    parseResult(result) {
        try {
            const text = result.parts?.find((p) => p.type === 'text')?.text || '';
            const parsed = JSON.parse(text);
            return {
                agentRole: 'build',
                phaseId: result.phaseId || 0,
                status: parsed.status || 'complete',
                outOfScopeFlags: parsed.outOfScopeFlags || [],
                notes: parsed.notes || '',
            };
        }
        catch {
            return {
                agentRole: 'build',
                phaseId: 0,
                status: 'failed',
                outOfScopeFlags: [],
                notes: 'Failed to parse build agent result',
            };
        }
    }
    async getOrCreateSession() {
        const sessions = await this.ctx.client.session.list();
        const existing = sessions.find((s) => s.title?.includes('ralph-build'));
        if (existing)
            return existing.id;
        const newSession = await this.ctx.client.session.create({
            body: { title: `ralph-build-${Date.now()}` },
        });
        return newSession.id;
    }
}
//# sourceMappingURL=build.js.map