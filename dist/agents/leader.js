import * as fileUtils from '../utils/files.js';
import { BuildAgent } from './build.js';
import { TestAgent } from './test.js';
import { DocumentAgent } from './document.js';
import { ReviewerAgent } from './reviewer.js';
import { PlanAgent } from './plan.js';
export class LeaderAgent {
    ctx;
    state;
    projectPath;
    buildAgent;
    testAgent;
    documentAgent;
    reviewerAgent;
    planAgent;
    constructor(ctx, projectPath) {
        this.ctx = ctx;
        this.projectPath = projectPath;
        this.state = {
            ralphState: {
                currentPhase: 0,
                iteration: 0,
                retryCount: 0,
                assumeMode: false,
                lastCheckpoint: '',
            },
            config: {
                model: 'claude-3-5-sonnet',
                maxRetries: 5,
                assumeMode: false,
                dockerEnabled: true,
            },
            isRunning: false,
        };
        this.buildAgent = new BuildAgent(ctx, projectPath);
        this.testAgent = new TestAgent(ctx, projectPath);
        this.documentAgent = new DocumentAgent(ctx, projectPath);
        this.reviewerAgent = new ReviewerAgent(ctx, projectPath);
        this.planAgent = new PlanAgent(ctx, projectPath);
    }
    async initialize(assumeMode = false) {
        await fileUtils.ensureRalphStructure(this.ctx.$, this.projectPath);
        const config = await fileUtils.loadConfig(this.ctx.$, this.projectPath);
        config.assumeMode = assumeMode;
        await fileUtils.saveConfig(this.ctx.$, this.projectPath, config);
        this.state.config = config;
        this.state.ralphState.assumeMode = assumeMode;
        const savedState = await fileUtils.loadState(this.ctx.$, this.projectPath);
        if (savedState) {
            this.state.ralphState = savedState;
        }
    }
    async run() {
        if (this.state.isRunning) {
            return 'Ralph is already running';
        }
        this.state.isRunning = true;
        const phases = await fileUtils.loadPhases(this.ctx.$, this.projectPath);
        if (phases.length === 0) {
            this.state.isRunning = false;
            return 'No phases found. Run ralph_init first.';
        }
        let currentPhaseIndex = this.state.ralphState.currentPhase;
        while (currentPhaseIndex < phases.length) {
            const phase = phases[currentPhaseIndex];
            if (phase.status === 'complete') {
                currentPhaseIndex++;
                continue;
            }
            phase.status = 'in-progress';
            await fileUtils.savePhases(this.ctx.$, this.projectPath, phases);
            const result = await this.runPhase(phase);
            if (result === 'halt') {
                this.state.isRunning = false;
                await this.saveState();
                return `Ralph halted at phase ${phase.id}: ${phase.name}`;
            }
            phase.status = 'complete';
            await fileUtils.savePhases(this.ctx.$, this.projectPath, phases);
            currentPhaseIndex++;
            this.state.ralphState.currentPhase = currentPhaseIndex;
            await this.saveState();
        }
        this.state.isRunning = false;
        await this.saveState();
        return 'Ralph completed all phases successfully';
    }
    async runPhase(phase) {
        const maxRetries = this.state.config.maxRetries;
        while (this.state.ralphState.retryCount < maxRetries) {
            this.state.ralphState.iteration++;
            const handoff = await this.createHandoffMessage(phase);
            const buildResult = await this.buildAgent.execute(handoff);
            if (buildResult.status === 'failed') {
                await this.writeMemory(phase, 'fail', buildResult.notes, buildResult.outOfScopeFlags);
                this.state.ralphState.retryCount++;
                await this.saveState();
                continue;
            }
            if (buildResult.outOfScopeFlags.length > 0) {
                const reviewResult = await this.reviewerAgent.evaluateOutOfScopeFlags(handoff, buildResult.outOfScopeFlags);
                if (reviewResult.reviewResult?.suggestedPhase) {
                    await this.insertPhase(reviewResult.reviewResult.suggestedPhase);
                    await this.writeMemory(phase, 'pass', `Out-of-scope flags processed: ${buildResult.outOfScopeFlags.map(f => f.description).join(', ')}`, []);
                    return 'continue';
                }
            }
            const dockerAvailable = await this.testAgent.checkDockerAvailable();
            if (!dockerAvailable && this.state.config.dockerEnabled) {
                return 'halt';
            }
            const testResult = await this.testAgent.execute(handoff);
            if (testResult.testResults?.status === 'fail') {
                await this.writeMemory(phase, 'fail', `Test failures: ${testResult.testResults?.failures.map(f => f.test).join(', ')}`, []);
                this.state.ralphState.retryCount++;
                await this.saveState();
                continue;
            }
            const reviewResult = await this.reviewerAgent.execute(handoff, buildResult, testResult);
            if (reviewResult.reviewResult?.status === 'rejected') {
                await this.writeMemory(phase, 'fail', `Review rejected: ${reviewResult.reviewResult.reason}`, []);
                if (reviewResult.reviewResult.suggestedPhase) {
                    await this.insertPhase(reviewResult.reviewResult.suggestedPhase);
                }
                this.state.ralphState.retryCount++;
                await this.saveState();
                continue;
            }
            await this.documentAgent.execute(handoff);
            await this.writeMemory(phase, 'pass', 'Phase completed successfully', []);
            this.state.ralphState.retryCount = 0;
            await this.saveState();
            return 'continue';
        }
        await this.attemptRescope(phase);
        if (this.state.ralphState.retryCount >= maxRetries) {
            await this.writeMemory(phase, 'fail', `Max retries (${maxRetries}) exceeded and rescope failed`, []);
            return 'halt';
        }
        return 'continue';
    }
    async attemptRescope(phase) {
        const memories = await this.getPhaseMemories(phase.id);
        const failureContext = `Phase ${phase.id} (${phase.name}) has failed ${this.state.config.maxRetries} times. Current goal: ${phase.goal}. Last failure: retry limit exceeded.`;
        await this.writeMemory(phase, 'fail', `Attempting rescope after ${this.state.config.maxRetries} retries`, []);
        const result = await this.planAgent.rescope(phase.id, failureContext, memories);
        if (result.includes('successfully')) {
            this.state.ralphState.retryCount = 0;
            await this.saveState();
        }
    }
    async createHandoffMessage(phase) {
        return {
            phaseId: phase.id,
            phaseGoal: phase.goal,
            acceptanceCriteria: phase.acceptanceCriteria,
            iteration: this.state.ralphState.iteration,
            priorMemories: await this.getPriorMemories(phase.id),
            priorFailures: [],
            outOfScopeFlags: [],
            assumeMode: this.state.ralphState.assumeMode,
            agentRole: 'build',
        };
    }
    async insertPhase(newPhase) {
        const phases = await fileUtils.loadPhases(this.ctx.$, this.projectPath);
        phases.push(newPhase);
        phases.sort((a, b) => a.id - b.id);
        await fileUtils.savePhases(this.ctx.$, this.projectPath, phases);
    }
    async writeMemory(phase, status, notes, flags) {
        const index = await fileUtils.loadMemoriesIndex(this.ctx.$, this.projectPath);
        const id = index.length + 1;
        const keywords = this.extractKeywords(phase, notes, flags);
        const memory = {
            id,
            phase: phase.id,
            iteration: this.state.ralphState.iteration,
            context: phase.goal,
            attempted: `Phase ${phase.id}: ${phase.name}`,
            worked: status === 'pass' ? notes : '',
            failed: status === 'fail' ? notes : '',
            keyDecisions: [],
            assumptionsMade: this.state.ralphState.assumeMode ? [notes] : [],
            artifacts: [],
            handoffNotes: flags.length > 0 ? `Out-of-scope: ${flags.map(f => f.description).join(', ')}` : '',
        };
        await fileUtils.saveMemory(this.ctx.$, this.projectPath, memory);
        index.push({
            id,
            phase: phase.id,
            iteration: this.state.ralphState.iteration,
            keywords,
            status,
            file: `/MEMORIES/MEMORY_${id}.md`,
        });
        await fileUtils.saveMemoriesIndex(this.ctx.$, this.projectPath, index);
    }
    extractKeywords(phase, notes, flags) {
        const keywords = new Set();
        keywords.add(phase.name.toLowerCase().replace(/\s+/g, '-'));
        keywords.add(`phase-${phase.id}`);
        const words = notes.toLowerCase().split(/\s+/);
        for (const word of words) {
            const clean = word.replace(/[^a-z]/g, '');
            if (clean.length > 3 && !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'were', 'said', 'each', 'which', 'will', 'about', 'could', 'would'].includes(clean)) {
                keywords.add(clean);
            }
        }
        for (const flag of flags) {
            const flagWords = flag.description.toLowerCase().split(/\s+/);
            for (const word of flagWords) {
                const clean = word.replace(/[^a-z]/g, '');
                if (clean.length > 4) {
                    keywords.add(clean);
                }
            }
            if (flag.suggestedPhaseName) {
                keywords.add(flag.suggestedPhaseName.toLowerCase().replace(/\s+/g, '-'));
            }
        }
        return Array.from(keywords).slice(0, 10);
    }
    async getPhaseMemories(phaseId) {
        const index = await fileUtils.loadMemoriesIndex(this.ctx.$, this.projectPath);
        const memories = [];
        for (const entry of index.filter(e => e.phase === phaseId)) {
            const memory = await fileUtils.loadMemory(this.ctx.$, this.projectPath, entry.id);
            if (memory) {
                memories.push(memory);
            }
        }
        return memories;
    }
    async getPriorMemories(phaseId) {
        const index = await fileUtils.loadMemoriesIndex(this.ctx.$, this.projectPath);
        return index
            .filter(e => e.phase === phaseId)
            .map(e => e.file);
    }
    async saveState() {
        this.state.ralphState.lastCheckpoint = new Date().toISOString();
        await fileUtils.saveState(this.ctx.$, this.projectPath, this.state.ralphState);
    }
    async getStatus() {
        const phases = await fileUtils.loadPhases(this.ctx.$, this.projectPath);
        const completed = phases.filter(p => p.status === 'complete').length;
        const total = phases.length;
        const dockerAvailable = await this.testAgent.checkDockerAvailable();
        return `Ralph Status:
- Phases: ${completed}/${total} complete
- Current Phase: ${this.state.ralphState.currentPhase}
- Iteration: ${this.state.ralphState.iteration}
- Retry Count: ${this.state.ralphState.retryCount}
- Running: ${this.state.isRunning}
- Assume Mode: ${this.state.ralphState.assumeMode}
- Docker Available: ${dockerAvailable}`;
    }
    async resume() {
        const savedState = await fileUtils.loadState(this.ctx.$, this.projectPath);
        if (!savedState) {
            return 'No saved state found. Cannot resume.';
        }
        this.state.ralphState = savedState;
        return await this.run();
    }
}
//# sourceMappingURL=leader.js.map