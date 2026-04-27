export class DocumentAgent {
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
                            notes: { type: 'string' },
                            filesUpdated: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['status', 'notes']
                    }
                }
            },
        });
        return this.parseResult(result, handoff.phaseId);
    }
    formatPrompt(handoff) {
        return JSON.stringify({
            role: 'document',
            phaseId: handoff.phaseId,
            phaseGoal: handoff.phaseGoal,
            acceptanceCriteria: handoff.acceptanceCriteria,
            projectPath: this.projectPath,
            instructions: `You are the Document Agent. Your task is to update documentation for the completed phase.

DOCUMENTATION TASKS:
1. Update README.md with:
   - Summary of what was implemented in this phase
   - How to use the new features
   - Any API changes or new endpoints
   
2. Create or update per-module documentation if needed

3. Ensure all public APIs are documented

Use the Bash and Edit tools to modify files.

Return format:
{
  "status": "complete" | "failed",
  "notes": "summary of documentation updated",
  "filesUpdated": ["README.md", "docs/api.md", ...]
}`
        }, null, 2);
    }
    parseResult(result, phaseId) {
        try {
            const text = result.parts?.find((p) => p.type === 'text')?.text || '';
            const parsed = JSON.parse(text);
            return {
                agentRole: 'document',
                phaseId,
                status: parsed.status || 'complete',
                outOfScopeFlags: [],
                notes: parsed.notes || '',
            };
        }
        catch {
            return {
                agentRole: 'document',
                phaseId,
                status: 'complete',
                outOfScopeFlags: [],
                notes: 'Documentation updated',
            };
        }
    }
    async getOrCreateSession() {
        const sessions = await this.ctx.client.session.list();
        const existing = sessions.find((s) => s.title?.includes('ralph-document'));
        if (existing)
            return existing.id;
        const newSession = await this.ctx.client.session.create({
            body: { title: `ralph-document-${Date.now()}` },
        });
        return newSession.id;
    }
}
//# sourceMappingURL=document.js.map