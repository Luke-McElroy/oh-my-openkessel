import * as fileUtils from '../utils/files.js';
export class PlanAgent {
    ctx;
    projectPath;
    constructor(ctx, projectPath) {
        this.ctx = ctx;
        this.projectPath = projectPath;
    }
    async initialize(projectGoal, techStack, constraints) {
        await fileUtils.ensureRalphStructure(this.ctx.$, this.projectPath);
        const prd = await this.generatePRD(projectGoal, techStack, constraints);
        await this.ctx.$ `echo ${prd} > ${this.projectPath}/PRD.md`;
        const phases = await this.generatePhases(projectGoal, techStack, constraints);
        await fileUtils.savePhases(this.ctx.$, this.projectPath, phases);
        const memoriesIndex = `# Memory Index

| ID | Phase | Iteration | Keywords | Status | File |
|----|-------|-----------|----------|--------|------|`;
        await this.ctx.$ `echo ${memoriesIndex} > ${this.projectPath}/MEMORIES.md`;
        const initialState = {
            currentPhase: 0,
            iteration: 0,
            retryCount: 0,
            assumeMode: false,
            lastCheckpoint: new Date().toISOString(),
        };
        await fileUtils.saveState(this.ctx.$, this.projectPath, initialState);
        return 'Ralph project initialized successfully';
    }
    async rescope(phaseId, failureContext, memories) {
        const phases = await fileUtils.loadPhases(this.ctx.$, this.projectPath);
        const phase = phases.find(p => p.id === phaseId);
        if (!phase) {
            return `Phase ${phaseId} not found`;
        }
        const updatedPhase = await this.regeneratePhase(phase, failureContext, memories);
        const index = phases.findIndex(p => p.id === phaseId);
        phases[index] = updatedPhase;
        await fileUtils.savePhases(this.ctx.$, this.projectPath, phases);
        return `Phase ${phaseId} rescoped successfully`;
    }
    async insertPhase(afterPhaseId, phaseSuggestion) {
        const phases = await fileUtils.loadPhases(this.ctx.$, this.projectPath);
        const newPhase = {
            id: phases.length + 1,
            name: phaseSuggestion.name || 'New Phase',
            status: 'pending',
            goal: phaseSuggestion.goal || '',
            tasks: phaseSuggestion.tasks || [],
            acceptanceCriteria: phaseSuggestion.acceptanceCriteria || [],
            outOfScopeFlags: [],
            notes: phaseSuggestion.notes || '',
        };
        const insertIndex = phases.findIndex(p => p.id === afterPhaseId) + 1;
        phases.splice(insertIndex, 0, newPhase);
        for (let i = 0; i < phases.length; i++) {
            phases[i].id = i + 1;
        }
        await fileUtils.savePhases(this.ctx.$, this.projectPath, phases);
        return `New phase inserted after phase ${afterPhaseId}`;
    }
    async generatePRD(projectGoal, techStack, constraints) {
        const prompt = `Generate a Product Requirements Document (PRD.md) for the following project:

Project Goal: ${projectGoal}
${techStack ? `Tech Stack: ${techStack}` : ''}
${constraints ? `Constraints: ${constraints}` : ''}

Follow this structure:
1. Overview - Brief description of the project
2. Problem Definition - What problem does this solve?
3. Requirements - Functional and non-functional requirements
4. Constraints - Technical or business constraints
5. Success Criteria - How do we know this is complete?

Use clear, specific language. Include measurable success criteria.

Generate the full PRD content now.`;
        const result = await this.ctx.client.session.prompt({
            path: { id: await this.getOrCreateSession() },
            body: { parts: [{ type: 'text', text: prompt }] },
        });
        const text = result.parts?.find((p) => p.type === 'text')?.text || '';
        return text;
    }
    async generatePhases(projectGoal, techStack, constraints) {
        const prompt = `Generate a detailed phase plan for the following project:

Project Goal: ${projectGoal}
${techStack ? `Tech Stack: ${techStack}` : ''}
${constraints ? `Constraints: ${constraints}` : ''}

Create 3-7 phases. For each phase, provide:
1. Phase name
2. Goal (single sentence, what does done look like?)
3. Tasks (3-7 specific, actionable tasks)
4. Acceptance Criteria (3-5 testable criteria)

Phases should be sequential and build on each other. Keep scope tight per phase.

Return ONLY a JSON array in this format:
[
  {
    "name": "Phase Name",
    "goal": "Goal description",
    "tasks": ["Task 1", "Task 2"],
    "acceptanceCriteria": ["Criterion 1", "Criterion 2"]
  }
]`;
        const result = await this.ctx.client.session.prompt({
            path: { id: await this.getOrCreateSession() },
            body: { parts: [{ type: 'text', text: prompt }] },
        });
        const text = result.parts?.find((p) => p.type === 'text')?.text || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const phaseData = JSON.parse(jsonMatch[0]);
            return phaseData.map((data, index) => ({
                id: index + 1,
                name: data.name,
                status: 'pending',
                goal: data.goal,
                tasks: data.tasks,
                acceptanceCriteria: data.acceptanceCriteria,
                outOfScopeFlags: [],
                notes: '',
            }));
        }
        return [{
                id: 1,
                name: 'Initial Phase',
                status: 'pending',
                goal: projectGoal,
                tasks: ['Implement core functionality'],
                acceptanceCriteria: ['Code compiles', 'Basic tests pass'],
                outOfScopeFlags: [],
                notes: '',
            }];
    }
    async regeneratePhase(phase, failureContext, memories) {
        const memoriesText = memories.map(m => `Memory ${m.id}: ${m.context}\nAttempted: ${m.attempted}\nFailed: ${m.failed}`).join('\n\n');
        const prompt = `Rescope the following phase based on failure analysis:

Current Phase:
- ID: ${phase.id}
- Name: ${phase.name}
- Goal: ${phase.goal}
- Tasks: ${phase.tasks.join(', ')}
- Acceptance Criteria: ${phase.acceptanceCriteria.join(', ')}

Failure Context:
${failureContext}

Previous Attempts:
${memoriesText}

Your task:
1. Analyze why the phase failed
2. Simplify or break down the phase if needed
3. Return updated phase definition

Return ONLY a JSON object in this format:
{
  "name": "Updated Phase Name",
  "goal": "Updated goal",
  "tasks": ["Updated task 1", "Updated task 2"],
  "acceptanceCriteria": ["Updated criterion 1", "Updated criterion 2"],
  "notes": "Reasoning for changes"
}`;
        const result = await this.ctx.client.session.prompt({
            path: { id: await this.getOrCreateSession() },
            body: { parts: [{ type: 'text', text: prompt }] },
        });
        const text = result.parts?.find((p) => p.type === 'text')?.text || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const updated = JSON.parse(jsonMatch[0]);
            return {
                ...phase,
                name: updated.name,
                goal: updated.goal,
                tasks: updated.tasks,
                acceptanceCriteria: updated.acceptanceCriteria,
                notes: updated.notes,
            };
        }
        return phase;
    }
    async getOrCreateSession() {
        const sessions = await this.ctx.client.session.list();
        const existing = sessions.find((s) => s.title?.includes('ralph-plan'));
        if (existing)
            return existing.id;
        const newSession = await this.ctx.client.session.create({
            body: { title: `ralph-plan-${Date.now()}` },
        });
        return newSession.id;
    }
}
//# sourceMappingURL=plan.js.map