export type AgentRole = 'leader' | 'plan' | 'build' | 'test' | 'document' | 'reviewer';

export type PhaseStatus = 'pending' | 'in-progress' | 'complete' | 'failed' | 'escalated';

export type IterationStatus = 'pass' | 'fail';

export interface Phase {
  id: number;
  name: string;
  status: PhaseStatus;
  goal: string;
  tasks: string[];
  acceptanceCriteria: string[];
  outOfScopeFlags: OutOfScopeFlag[];
  notes: string;
}

export interface OutOfScopeFlag {
  description: string;
  suggestedPhaseName: string;
  suggestedInsertionAfterPhase: number;
}

export interface HandoffMessage {
  phaseId: number;
  phaseGoal: string;
  acceptanceCriteria: string[];
  iteration: number;
  priorMemories: string[];
  priorFailures: string[];
  outOfScopeFlags: OutOfScopeFlag[];
  assumeMode: boolean;
  agentRole: Exclude<AgentRole, 'leader'>;
}

export interface AgentResult {
  agentRole: Exclude<AgentRole, 'leader'>;
  phaseId: number;
  status: 'complete' | 'failed';
  outOfScopeFlags: OutOfScopeFlag[];
  notes: string;
  testResults?: TestResult;
  reviewResult?: ReviewResult;
}

export interface TestResult {
  status: 'pass' | 'fail';
  failures: TestFailure[];
  coverage: string;
}

export interface TestFailure {
  test: string;
  error: string;
  detail: string;
}

export interface ReviewResult {
  status: 'approved' | 'rejected';
  reason: string;
  suggestedPhase?: Phase;
}

export interface Memory {
  id: number;
  phase: number;
  iteration: number;
  context: string;
  attempted: string;
  worked: string;
  failed: string;
  keyDecisions: string[];
  assumptionsMade: string[];
  artifacts: string[];
  handoffNotes: string;
}

export interface MemoryIndexEntry {
  id: number;
  phase: number;
  iteration: number;
  keywords: string[];
  status: IterationStatus;
  file: string;
}

export interface RalphState {
  currentPhase: number;
  iteration: number;
  retryCount: number;
  assumeMode: boolean;
  lastCheckpoint: string;
}

export interface RalphConfig {
  model: string;
  maxRetries: number;
  assumeMode: boolean;
  dockerEnabled: boolean;
}

export interface SessionState {
  ralphState: RalphState;
  config: RalphConfig;
  isRunning: boolean;
}
