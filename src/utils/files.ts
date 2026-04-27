import type { Phase, Memory, MemoryIndexEntry, RalphState, RalphConfig, IterationStatus } from '../types/index.js';

const RALPH_DIR = '.ralph';
const MEMORIES_DIR = 'MEMORIES';

export async function ensureRalphStructure($: any, projectPath: string): Promise<void> {
  await $`mkdir -p ${projectPath}/${RALPH_DIR}`;
  await $`mkdir -p ${projectPath}/${MEMORIES_DIR}`;
}

export async function loadPhases($: any, projectPath: string): Promise<Phase[]> {
  try {
    const content = await $`cat ${projectPath}/PHASES.md`.text();
    return parsePhases(content);
  } catch {
    return [];
  }
}

export function parsePhases(content: string): Phase[] {
  const phases: Phase[] = [];
  const lines = content.split('\n');
  let currentPhase: Phase | null = null;
  let section = '';

  for (const line of lines) {
    const phaseMatch = line.match(/## Phase (\d+): (.+)/);
    if (phaseMatch) {
      if (currentPhase && currentPhase.id) {
        phases.push(currentPhase as Phase);
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
      } as Phase;
      section = '';
      continue;
    }

    if (!currentPhase) continue;

    if (line.startsWith('**Status:**')) {
      currentPhase.status = line.split('**Status:**')[1].trim() as Phase['status'];
    } else if (line.startsWith('**Goal:**')) {
      currentPhase.goal = line.split('**Goal:**')[1].trim();
    } else if (line === '### Tasks') {
      section = 'tasks';
    } else if (line === '### Acceptance Criteria') {
      section = 'criteria';
    } else if (line === '### Out-of-Scope Flags') {
      section = 'flags';
    } else if (line === '### Notes') {
      section = 'notes';
    } else if (line.startsWith('- [ ]') || line.startsWith('- [x]')) {
      const task = line.replace('- [ ]', '').replace('- [x]', '').trim();
      if (section === 'tasks') {
        currentPhase.tasks.push(task);
      } else if (section === 'criteria') {
        currentPhase.acceptanceCriteria.push(task);
      }
    }
  }

  if (currentPhase && currentPhase.id) {
    phases.push(currentPhase as Phase);
  }

  return phases;
}

export async function savePhases($: any, projectPath: string, phases: Phase[]): Promise<void> {
  const content = phases.map(p => formatPhase(p)).join('\n\n');
  await $`echo ${content} > ${projectPath}/PHASES.md`;
}

function formatPhase(phase: Phase): string {
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

export async function loadState($: any, projectPath: string): Promise<RalphState | null> {
  try {
    const content = await $`cat ${projectPath}/${RALPH_DIR}/state.json`.text();
    return JSON.parse(content) as RalphState;
  } catch {
    return null;
  }
}

export async function saveState($: any, projectPath: string, state: RalphState): Promise<void> {
  await $`echo ${JSON.stringify(state, null, 2)} > ${projectPath}/${RALPH_DIR}/state.json`;
}

export async function loadConfig($: any, projectPath: string): Promise<RalphConfig> {
  try {
    const content = await $`cat ${projectPath}/${RALPH_DIR}/config.json`.text();
    return JSON.parse(content) as RalphConfig;
  } catch {
    return {
      model: 'claude-3-5-sonnet',
      maxRetries: 5,
      assumeMode: false,
      dockerEnabled: true,
    };
  }
}

export async function saveConfig($: any, projectPath: string, config: RalphConfig): Promise<void> {
  await $`echo ${JSON.stringify(config, null, 2)} > ${projectPath}/${RALPH_DIR}/config.json`;
}

export async function loadMemoriesIndex($: any, projectPath: string): Promise<MemoryIndexEntry[]> {
  try {
    const content = await $`cat ${projectPath}/MEMORIES.md`.text();
    return parseMemoriesIndex(content);
  } catch {
    return [];
  }
}

export function parseMemoriesIndex(content: string): MemoryIndexEntry[] {
  const entries: MemoryIndexEntry[] = [];
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
          status: parts[4] as IterationStatus,
          file: parts[5],
        });
      }
    }
  }

  return entries;
}

export async function saveMemoriesIndex($: any, projectPath: string, entries: MemoryIndexEntry[]): Promise<void> {
  const header = `# Memory Index

| ID | Phase | Iteration | Keywords | Status | File |
|----|-------|-----------|----------|--------|------|`;
  const rows = entries.map(e => 
    `| ${e.id} | ${e.phase} | ${e.iteration} | ${e.keywords.join(', ')} | ${e.status} | ${e.file} |`
  );
  const content = [header, ...rows].join('\n');
  await $`echo ${content} > ${projectPath}/MEMORIES.md`;
}

export async function loadMemory($: any, projectPath: string, id: number): Promise<Memory | null> {
  try {
    const content = await $`cat ${projectPath}/${MEMORIES_DIR}/MEMORY_${id}.md`.text();
    return parseMemory(content, id);
  } catch {
    return null;
  }
}

export function parseMemory(content: string, id: number): Memory {
  const lines = content.split('\n');
  const memory: Partial<Memory> = { id };
  let section = '';

  for (const line of lines) {
    if (line.startsWith('## Phase')) {
      const match = line.match(/Phase (\d+)/);
      if (match) memory.phase = parseInt(match[1]);
    } else if (line.startsWith('## Iteration')) {
      const match = line.match(/Iteration (\d+)/);
      if (match) memory.iteration = parseInt(match[1]);
    } else if (line === '## Context') {
      section = 'context';
      memory.context = '';
    } else if (line === '## What Was Attempted') {
      section = 'attempted';
      memory.attempted = '';
    } else if (line === '## What Worked') {
      section = 'worked';
      memory.worked = '';
    } else if (line === '## What Failed') {
      section = 'failed';
      memory.failed = '';
    } else if (line === '## Key Decisions') {
      section = 'decisions';
      memory.keyDecisions = [];
    } else if (line === '## Assumptions Made') {
      section = 'assumptions';
      memory.assumptionsMade = [];
    } else if (line === '## Artifacts') {
      section = 'artifacts';
      memory.artifacts = [];
    } else if (line === '## Handoff Notes') {
      section = 'handoff';
      memory.handoffNotes = '';
    } else if (line.startsWith('- ') && section === 'decisions') {
      memory.keyDecisions!.push(line.substring(2));
    } else if (line.startsWith('- ') && section === 'assumptions') {
      memory.assumptionsMade!.push(line.substring(2));
    } else if (line.startsWith('- ') && section === 'artifacts') {
      memory.artifacts!.push(line.substring(2));
    } else if (section && !line.startsWith('#')) {
      const key = section as 'context' | 'attempted' | 'worked' | 'failed' | 'handoffNotes';
      if (typeof memory[key] === 'string') {
        (memory[key] as string) += line + '\n';
      }
    }
  }

  return memory as Memory;
}

export async function saveMemory($: any, projectPath: string, memory: Memory): Promise<void> {
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

  await $`echo ${content} > ${projectPath}/${MEMORIES_DIR}/MEMORY_${memory.id}.md`;
}
