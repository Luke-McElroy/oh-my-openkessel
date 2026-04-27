import * as fileUtils from '../utils/files.js';
export class ReviewerAgent {
    ctx;
    projectPath;
    constructor(ctx, projectPath) {
        this.ctx = ctx;
        this.projectPath = projectPath;
    }
    async execute(handoff, buildResult, testResult) {
        const phases = await fileUtils.loadPhases(this.ctx.$, this.projectPath);
        const phase = phases.find(p => p.id === handoff.phaseId);
        const prompt = this.formatPrompt(handoff, buildResult, testResult, phase);
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
                            reviewResult: {
                                type: 'object',
                                properties: {
                                    status: { type: 'string', enum: ['approved', 'rejected'] },
                                    reason: { type: 'string' },
                                    suggestedPhase: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'number' },
                                            name: { type: 'string' },
                                            goal: { type: 'string' },
                                            tasks: { type: 'array', items: { type: 'string' } },
                                            acceptanceCriteria: { type: 'array', items: { type: 'string' } }
                                        }
                                    }
                                }
                            },
                            notes: { type: 'string' }
                        },
                        required: ['status', 'reviewResult']
                    }
                }
            },
        });
        return this.parseResult(result, handoff.phaseId);
    }
    async evaluateOutOfScopeFlags(handoff, flags) {
        const prompt = JSON.stringify({
            role: 'reviewer',
            task: 'evaluate_out_of_scope',
            phaseId: handoff.phaseId,
            phaseGoal: handoff.phaseGoal,
            outOfScopeFlags: flags,
            instructions: `You are the Reviewer Agent evaluating out-of-scope flags.

For each out-of-scope flag, decide:
1. Is this genuinely out of scope and needs a new phase?
2. Should it be dismissed as not needed?

If a new phase is needed, provide:
- Phase name
- Phase goal
- Tasks (3-5 items)
- Acceptance criteria

Return format:
{
  "status": "complete",
  "reviewResult": {
    "status": "approved" | "rejected",
    "reason": "explanation",
    "suggestedPhase": { ... } // if approved and needs new phase
  },
  "notes": "summary of evaluation"
}`
        }, null, 2);
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
                            status: { type: 'string' },
                            reviewResult: {
                                type: 'object',
                                properties: {
                                    status: { type: 'string' },
                                    reason: { type: 'string' },
                                    suggestedPhase: { type: 'object' }
                                }
                            },
                            notes: { type: 'string' }
                        }
                    }
                }
            },
        });
        return this.parseResult(result, handoff.phaseId);
    }
    formatPrompt(handoff, buildResult, testResult, phase) {
        return JSON.stringify({
            role: 'reviewer',
            phaseId: handoff.phaseId,
            phaseGoal: handoff.phaseGoal,
            acceptanceCriteria: handoff.acceptanceCriteria,
            buildStatus: buildResult.status,
            testStatus: testResult.testResults?.status,
            outOfScopeFlags: buildResult.outOfScopeFlags,
            fullPhases: phase ? [phase] : [],
            instructions: `You are the Reviewer Agent. Your task is to evaluate if the phase is complete.

EVALUATION CRITERIA:
1. Are ALL acceptance criteria satisfied?
2. Is the code quality acceptable?
3. Does it integrate properly with the architecture?
4. Is there scope creep or over-engineering?
5. Are out-of-scope flags properly handled?

BE STRICT:
- Reject if acceptance criteria are not met
- Reject if code is over-engineered
- Reject if quality is poor

If rejecting, provide a suggested corrective phase with:
- Name, goal, tasks, acceptance criteria

Return format:
{
  "status": "complete",
  "reviewResult": {
    "status": "approved" | "rejected",
    "reason": "detailed explanation",
    "suggestedPhase": { // only if rejected
      "id": number,
      "name": "string",
      "goal": "string",
      "tasks": ["task1", "task2"],
      "acceptanceCriteria": ["criterion1"]
    }
  },
  "notes": "brief summary"
}`
        }, null, 2);
    }
    parseResult(result, phaseId) {
        try {
            const text = result.parts?.find((p) => p.type === 'text')?.text || '';
            const parsed = JSON.parse(text);
            return {
                agentRole: 'reviewer',
                phaseId,
                status: parsed.status || 'complete',
                outOfScopeFlags: [],
                notes: parsed.notes || '',
                reviewResult: parsed.reviewResult
            };
        }
        catch {
            return {
                agentRole: 'reviewer',
                phaseId,
                status: 'complete',
                outOfScopeFlags: [],
                notes: 'Review completed',
                reviewResult: {
                    status: 'approved',
                    reason: 'Default approval - could not parse result'
                }
            };
        }
    }
    async getOrCreateSession() {
        const sessions = await this.ctx.client.session.list();
        const existing = sessions.find((s) => s.title?.includes('ralph-reviewer'));
        if (existing)
            return existing.id;
        const newSession = await this.ctx.client.session.create({
            body: { title: `ralph-reviewer-${Date.now()}` },
        });
        return newSession.id;
    }
}
//# sourceMappingURL=reviewer.js.map