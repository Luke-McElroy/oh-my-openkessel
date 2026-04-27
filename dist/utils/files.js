const RALPH_DIR = '.ralph';
const MEMORIES_DIR = 'MEMORIES';
export async function ensureRalphStructure($, projectPath) {
    await $ `mkdir -p ${projectPath}/${RALPH_DIR}`;
    await $ `mkdir -p ${projectPath}/${MEMORIES_DIR}`;
}
export async function loadPhases($, projectPath) {
    try {
        const content = await $ `cat ${projectPath}/PHASES.md`.text();
        return parsePhases(content);
    }
    catch {
        return [];
    }
}
export function parsePhases(content) {
    const phases = [];
    const lines = content.split('\n');
    let currentPhase = null;
    let section = '';
    for (const line of lines) {
        const phaseMatch = line.match(/## Phase (\d+): (.+)/);
        if (phaseMatch) {
            if (currentPhase && currentPhase.id) {
                phases.push(currentPhase);
            }
            currentPhase = {
                id: parseInt(phaseMatch[1]),
                name: phaseMatch[2],
                status: 'pending',
                goal: '',
                tasks: [],
                acceptanceCriteria: [],
                outOfScopeFlags: [],
                notes: '',
            };
            section = '';
            continue;
        }
        if (!currentPhase)
            continue;
        if (line.startsWith('**Status:**')) {
            currentPhase.status = line.split('**Status:**')[1].trim();
        }
        else if (line.startsWith('**Goal:**')) {
            currentPhase.goal = line.split('**Goal:**')[1].trim();
        }
        else if (line === '### Tasks') {
            section = 'tasks';
        }
        else if (line === '### Acceptance Criteria') {
            section = 'criteria';
        }
        else if (line === '### Out-of-Scope Flags') {
            section = 'flags';
        }
        else if (line === '### Notes') {
            section = 'notes';
        }
        else if (line.startsWith('- [ ]') || line.startsWith('- [x]')) {
            const task = line.replace('- [ ]', '').replace('- [x]', '').trim();
            if (section === 'tasks') {
                currentPhase.tasks.push(task);
            }
            else if (section === 'criteria') {
                currentPhase.acceptanceCriteria.push(task);
            }
        }
    }
    if (currentPhase && currentPhase.id) {
        phases.push(currentPhase);
    }
    return phases;
}
export async function savePhases($, projectPath, phases) {
    const content = phases.map(p => formatPhase(p)).join('\n\n');
    await $ `echo ${content} > ${projectPath}/PHASES.md`;
}
function formatPhase(phase) {
    return `## Phase ${phase.id}: ${phase.name}

**Status:** ${phase.status}
**Goal:** ${phase.goal}

### Tasks
${phase.tasks.map(t => `- [ ] ${t}`).join('\n')}

### Acceptance Criteria
${phase.acceptanceCriteria.map(c => `- ${c}`).join('\n')}

### Out-of-Scope Flags
${phase.outOfScopeFlags.map(f => `- ${f.description}`).join('\n') || 'None'}

### Notes
${phase.notes || ''}`;
}
export async function loadState($, projectPath) {
    try {
        const content = await $ `cat ${projectPath}/${RALPH_DIR}/state.json`.text();
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
export async function saveState($, projectPath, state) {
    await $ `echo ${JSON.stringify(state, null, 2)} > ${projectPath}/${RALPH_DIR}/state.json`;
}
export async function loadConfig($, projectPath) {
    try {
        const content = await $ `cat ${projectPath}/${RALPH_DIR}/config.json`.text();
        return JSON.parse(content);
    }
    catch {
        return {
            model: 'claude-3-5-sonnet',
            maxRetries: 5,
            assumeMode: false,
            dockerEnabled: true,
        };
    }
}
export async function saveConfig($, projectPath, config) {
    await $ `echo ${JSON.stringify(config, null, 2)} > ${projectPath}/${RALPH_DIR}/config.json`;
}
export async function loadMemoriesIndex($, projectPath) {
    try {
        const content = await $ `cat ${projectPath}/MEMORIES.md`.text();
        return parseMemoriesIndex(content);
    }
    catch {
        return [];
    }
}
export function parseMemoriesIndex(content) {
    const entries = [];
    const lines = content.split('\n');
    let inTable = false;
    for (const line of lines) {
        if (line.startsWith('| ID |')) {
            inTable = true;
            continue;
        }
        if (line.startsWith('|----|')) {
            continue;
        }
        if (inTable && line.startsWith('|')) {
            const parts = line.split('|').map(p => p.trim()).filter(Boolean);
            if (parts.length >= 6) {
                entries.push({
                    id: parseInt(parts[0]),
                    phase: parseInt(parts[1]),
                    iteration: parseInt(parts[2]),
                    keywords: parts[3].split(',').map(k => k.trim()),
                    status: parts[4],
                    file: parts[5],
                });
            }
        }
    }
    return entries;
}
export async function saveMemoriesIndex($, projectPath, entries) {
    const header = `# Memory Index

| ID | Phase | Iteration | Keywords | Status | File |
|----|-------|-----------|----------|--------|------|`;
    const rows = entries.map(e => `| ${e.id} | ${e.phase} | ${e.iteration} | ${e.keywords.join(', ')} | ${e.status} | ${e.file} |`);
    const content = [header, ...rows].join('\n');
    await $ `echo ${content} > ${projectPath}/MEMORIES.md`;
}
export async function loadMemory($, projectPath, id) {
    try {
        const content = await $ `cat ${projectPath}/${MEMORIES_DIR}/MEMORY_${id}.md`.text();
        return parseMemory(content, id);
    }
    catch {
        return null;
    }
}
export function parseMemory(content, id) {
    const lines = content.split('\n');
    const memory = { id };
    let section = '';
    for (const line of lines) {
        if (line.startsWith('## Phase')) {
            const match = line.match(/Phase (\d+)/);
            if (match)
                memory.phase = parseInt(match[1]);
        }
        else if (line.startsWith('## Iteration')) {
            const match = line.match(/Iteration (\d+)/);
            if (match)
                memory.iteration = parseInt(match[1]);
        }
        else if (line === '## Context') {
            section = 'context';
            memory.context = '';
        }
        else if (line === '## What Was Attempted') {
            section = 'attempted';
            memory.attempted = '';
        }
        else if (line === '## What Worked') {
            section = 'worked';
            memory.worked = '';
        }
        else if (line === '## What Failed') {
            section = 'failed';
            memory.failed = '';
        }
        else if (line === '## Key Decisions') {
            section = 'decisions';
            memory.keyDecisions = [];
        }
        else if (line === '## Assumptions Made') {
            section = 'assumptions';
            memory.assumptionsMade = [];
        }
        else if (line === '## Artifacts') {
            section = 'artifacts';
            memory.artifacts = [];
        }
        else if (line === '## Handoff Notes') {
            section = 'handoff';
            memory.handoffNotes = '';
        }
        else if (line.startsWith('- ') && section === 'decisions') {
            memory.keyDecisions.push(line.substring(2));
        }
        else if (line.startsWith('- ') && section === 'assumptions') {
            memory.assumptionsMade.push(line.substring(2));
        }
        else if (line.startsWith('- ') && section === 'artifacts') {
            memory.artifacts.push(line.substring(2));
        }
        else if (section && !line.startsWith('#')) {
            const key = section;
            if (typeof memory[key] === 'string') {
                memory[key] += line + '\n';
            }
        }
    }
    return memory;
}
export async function saveMemory($, projectPath, memory) {
    const content = `# Memory ${memory.id}

## Phase
Phase ${memory.phase}

## Iteration
Iteration ${memory.iteration}

## Context
${memory.context}

## What Was Attempted
${memory.attempted}

## What Worked
${memory.worked}

## What Failed
${memory.failed}

## Key Decisions
${memory.keyDecisions.map(d => `- ${d}`).join('\n')}

## Assumptions Made
${memory.assumptionsMade.map(a => `- ${a}`).join('\n')}

## Artifacts
${memory.artifacts.map(a => `- ${a}`).join('\n')}

## Handoff Notes
${memory.handoffNotes}`;
    await $ `echo ${content} > ${projectPath}/${MEMORIES_DIR}/MEMORY_${memory.id}.md`;
}
//# sourceMappingURL=files.js.map