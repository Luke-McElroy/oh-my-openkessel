# Ralph — Product Requirements Document

**Version:** 1.1  
**Status:** Draft  
**Project:** Ralph — Multi-Agent Coding Orchestration Plugin for OpenCode

---

## 1. Overview

Ralph is a multi-agent coding orchestration plugin for OpenCode. It takes a project goal from the user and autonomously plans, builds, tests, documents, and reviews code across structured phases — looping until the goal is complete or a hard failure threshold is reached.

Ralph is not a prompt wrapper. It is an agent runtime with:
- A **Leader Agent** that governs all execution, owns all escalation decisions, and orchestrates sub-agents
- Five independent sub-agents scoped strictly to execution tasks (Plan, Build, Test, Document, Reviewer)
- A persistent memory system for resumability and iteration learning
- A phase-based execution model with defined exit conditions
- Hard failure caps with escalation logic owned entirely by the Leader Agent

Sub-agents do not communicate with each other directly and do not make escalation decisions. All inter-agent routing flows through the Leader Agent.

---

## 2. User Interaction

### Entry Point

```bash
opencode ralph init   # Initialise a new Ralph project
opencode ralph run    # Run the Ralph loop
opencode ralph status # View current phase, loop count, memory index
```

### Optional Flags

```bash
--assume    # AI assumption mode: Ralph makes design decisions autonomously
--resume    # Force resume from last memory checkpoint (auto-detected by default)
```

---

## 3. Project Initialisation

Before any loop begins, the **Leader Agent** starts the project by invoking the **Plan Agent in initialisation mode**. This is not part of the outer loop. It is a prerequisite gate owned by the Leader Agent.

### Inputs
- User-provided project goal (plain language)
- Optional: existing codebase, constraints, tech stack preferences

### Outputs
- `PRD.md` — Problem definition, requirements, constraints, success criteria
- `PHASES.md` — Full ordered execution plan with goals and acceptance criteria per phase

### Phase Goal Definition
Every phase goal must be defined during initialisation, not at runtime. The Leader Agent instructs the Plan Agent to write structured acceptance criteria for each phase into `PHASES.md` before `ralph run` is ever called. This ensures the Reviewer Agent has an unambiguous target to evaluate against at the end of every phase.

**No phase may begin without a defined goal and acceptance criteria in `PHASES.md`.**

---

## 4. Output Artifacts

A Ralph project produces the following file structure:

```
/project-root
  PRD.md                   # Problem, requirements, constraints, success criteria
  PHASES.md                # Ordered phase plan (mutable — see Section 7)
  MEMORIES.md              # Keyword index of all memory files
  /MEMORIES/
    MEMORY_1.md
    MEMORY_2.md
    ...
  /src                     # Generated application code
  /tests                   # Generated test files
  /.ralph/
    config.json            # Ralph config (model, retries, assume mode, etc.)
    state.json             # Current phase, loop count, last checkpoint
```

---

## 5. Agent Hierarchy

Ralph has one governing Leader Agent and five sub-agents. Sub-agents are scoped strictly to execution. They do not make routing or escalation decisions — they complete their task, return a result, and hand off to the Leader Agent.

```
┌─────────────────────────────────┐
│          LEADER AGENT           │  ← Governs all execution and escalation
└────────────┬────────────────────┘
             │ instructs / receives results
    ┌────────┴──────────────────────────────────┐
    │         SUB-AGENTS                        │
    │  Plan · Build · Test · Document · Reviewer│
    └───────────────────────────────────────────┘
```

---

### 5.0 Leader Agent

**Runs:** Always. The Leader Agent is the entry point for every operation in Ralph.

**Responsibilities:**
- Govern the outer and inner loops — deciding when to advance, retry, escalate, or halt
- Invoke sub-agents in the correct sequence and pass them the correct context via handoff messages
- Receive results and flags from sub-agents and decide what happens next
- Own all escalation decisions:
  - Test failures → retry or escalate to Plan Agent
  - Out-of-scope flags → pass to Reviewer Agent to evaluate
  - Bad plan detected → escalate to Plan Agent to rescope
  - Retry limit exhausted → escalate to Plan Agent for rescope, then halt if still failing
  - Unrecoverable failure → surface to user with full context
- Manage crash recovery by reading the last MEMORY file and reconstructing state
- Write to `/.ralph/state.json` after every transition

**Inputs:**
- User commands (`init`, `run`, `status`, `--resume`)
- Sub-agent result messages and out-of-scope flags
- `PHASES.md` (for loop navigation)
- `/.ralph/state.json` (for state tracking)

**Outputs:**
- Handoff messages to sub-agents
- Updated `/.ralph/state.json`
- User-facing status messages and halt reports

**Authority:** The Leader Agent is the only agent that decides what happens next at any decision point. Sub-agents do not invoke other sub-agents.

---

### 5.1 Plan Agent

**Runs:** When invoked by the Leader Agent — during initialisation or when the Leader escalates a failure or scope issue.

**Responsibilities:**
- (Init mode) Produce `PRD.md` and `PHASES.md` with fully defined phase goals
- (Rescope mode) Modify or insert phases into `PHASES.md` based on the escalation context provided by the Leader Agent
- Evaluate the full architecture before modifying the phase plan

**Inputs:**
- Leader Agent handoff message (includes: escalation reason, failing phase, all MEMORY files for that phase, test failure detail)

**Outputs:**
- `PRD.md` (init only)
- Updated `PHASES.md`
- Result message to Leader Agent confirming changes made

**Scope limit:** Plan Agent does not write code, tests, or documentation. It does not decide when to run — the Leader Agent does.

---

### 5.2 Build Agent

**Runs:** When invoked by the Leader Agent during the inner loop.

**Responsibilities:**
- Write and modify code to satisfy the current phase goal
- Stay within the scope defined in the current phase entry in `PHASES.md`
- Flag any out-of-scope requirements discovered during build

**Inputs:**
- Leader Agent handoff message (includes: phase entry, acceptance criteria, relevant memory files, prior failures)

**Outputs:**
- Code written to `/src`
- Result message to Leader Agent (includes: completion status, out-of-scope flags if any)

**Scope limit:** Build Agent does not write tests, documentation, or modify `PHASES.md`. It does not decide what happens next — it returns a result to the Leader Agent.

---

### 5.3 Test Agent

**Runs:** When invoked by the Leader Agent, after Build Agent completes.

**Responsibilities:**
- Write tests for the current phase deliverable
- Spin up a Docker instance and execute tests against the codebase in an isolated environment
- Return a structured pass/fail result to the Leader Agent

**Inputs:**
- Leader Agent handoff message (includes: phase entry, acceptance criteria, path to built code)

**Outputs:**
- Test files written to `/tests`
- Structured result message to Leader Agent:
  - `status`: pass | fail
  - `failures`: list of failed assertions with detail
  - `coverage`: summary

**Docker requirement:** The Test Agent must have Docker available in the CLI environment. If Docker is unavailable, the Test Agent returns a hard-fail result to the Leader Agent, which halts Ralph and informs the user.

**Scope limit:** Test Agent does not modify source code or `PHASES.md`. It does not decide whether to retry — it returns a result and the Leader Agent decides.

---

### 5.4 Document Agent

**Runs:** When invoked by the Leader Agent after a phase is approved by the Reviewer Agent.

**Responsibilities:**
- Write or update documentation for the completed phase
- Update `README.md` and any relevant API or module docs

**Inputs:**
- Leader Agent handoff message (includes: completed phase entry, phase summary)

**Outputs:**
- Updated `README.md`
- Per-phase or per-module documentation files
- Result message to Leader Agent confirming completion

**Scope limit:** Document Agent does not modify code, tests, or `PHASES.md`.

---

### 5.5 Reviewer Agent

**Runs:** When invoked by the Leader Agent after the Test Agent returns a passing result.

**Responsibilities:**
- Evaluate whether the phase goal and acceptance criteria in `PHASES.md` are fully satisfied
- Evaluate how the completed phase integrates with the broader architecture
- Return an approval or rejection result to the Leader Agent with full reasoning

**Inputs:**
- Leader Agent handoff message (includes: current phase entry, full `PHASES.md`, test results, out-of-scope flags from Build Agent)

**Outputs:**
- Result message to Leader Agent:
  - `status`: approved | rejected
  - `reason`: explanation
  - `suggested_phase`: new phase entry (if rejected and a corrective phase is needed)

**Note:** The Reviewer Agent does not insert phases into `PHASES.md` directly. It returns a suggested phase to the Leader Agent, which then instructs the Plan Agent to insert it.

**Scope limit:** Reviewer Agent does not write code or tests. It does not modify `PHASES.md` directly.

---

## 6. The Ralph Loop

### 6.1 Outer Loop (Project Level)

```
LEADER AGENT starts
  │
  ├─ Invokes Plan Agent (init mode)
  │    └─ Produces PRD.md + PHASES.md
  │
  └─ FOR EACH phase in PHASES.md:
        └─ Leader Agent runs INNER LOOP for current phase

IF all phases complete AND Reviewer approves final state:
  └─ Leader Agent signals: Project complete
```

**Project completion** is determined by the Leader Agent after the Reviewer Agent approves the final phase. If new phases were inserted during execution, those must also complete before the Leader Agent can signal completion.

---

### 6.2 Inner Loop (Phase Level)

The Leader Agent owns every decision node in the inner loop. Sub-agents only execute and return results.

```
LEADER AGENT starts phase
  │
  ├─ Invokes Build Agent → Build returns: code + out-of-scope flags
  │
  ├─ Invokes Test Agent → Test returns: pass | fail + detail
  │
  ├─ [LEADER DECISION] IF FAIL:
  │     └─ Leader writes MEMORY file
  │     └─ IF retry < 5:
  │     │     └─ Leader loops back → invokes Build Agent again
  │     └─ IF retry == 5:
  │           └─ Leader escalates → invokes Plan Agent (rescope mode)
  │           └─ Plan Agent returns updated PHASES.md
  │           └─ Leader resets retry counter → inner loop resumes
  │           └─ IF fails again after 5 more retries:
  │                 └─ Leader writes MEMORY file
  │                 └─ Leader halts Ralph → surfaces to user
  │
  ├─ [LEADER DECISION] IF PASS:
  │     └─ Leader invokes Reviewer Agent
  │     └─ Reviewer returns: approved | rejected + reasoning
  │     │
  │     ├─ [LEADER DECISION] IF APPROVED:
  │     │     └─ Leader invokes Document Agent
  │     │     └─ Leader writes MEMORY file
  │     │     └─ Leader marks phase complete → advances outer loop
  │     │
  │     └─ [LEADER DECISION] IF REJECTED:
  │           └─ Leader passes Reviewer's suggested phase to Plan Agent
  │           └─ Plan Agent inserts corrective phase into PHASES.md
  │           └─ Leader writes MEMORY file
  │           └─ Leader marks current phase complete
  │           └─ Leader advances outer loop (corrective phase runs next)
  │
  └─ [LEADER DECISION] IF OUT-OF-SCOPE FLAG received from Build Agent:
        └─ Leader passes flag to Reviewer Agent for evaluation
        └─ Reviewer decides: insert new phase or dismiss
        └─ If inserting: Leader instructs Plan Agent to add it
```

---

## 7. PHASES.md — Structure and Mutability

### Phase Entry Schema

```md
## Phase N: [Phase Name]

**Status:** pending | in-progress | complete | failed | escalated
**Goal:** [Single sentence — what does done look like?]

### Tasks
- [ ] Task 1
- [ ] Task 2

### Acceptance Criteria
- Criterion 1 (testable)
- Criterion 2 (testable)

### Out-of-Scope Flags
[Populated at runtime by agents if out-of-scope work is discovered]

### Notes
[Populated by Plan or Reviewer agent during rescope or correction]
```

### Mutability Rules

| Agent | Can Read | Can Write |
|---|---|---|
| Leader Agent | ✅ (all phases) | ✅ (status updates only) |
| Plan Agent | ✅ (all phases) | ✅ (insert, rescope — when instructed by Leader) |
| Build Agent | ✅ (current phase only) | ❌ |
| Test Agent | ✅ (current phase only) | ❌ |
| Document Agent | ✅ (current phase only) | ❌ |
| Reviewer Agent | ✅ (all phases) | ❌ (returns suggested phases to Leader; Plan Agent inserts) |

**New phases are always inserted at the correct position in sequence**, not appended to the end, unless they are genuinely final-stage concerns.

---

## 8. Memory System

### Purpose

The memory system gives Ralph resumability across crashes, learning across iterations, and structured context retrieval for agents starting a new loop.

### File Structure

```
MEMORIES.md              # Keyword index
/MEMORIES/
  MEMORY_1.md
  MEMORY_2.md
  ...
```

### MEMORIES.md — Index Schema

```md
# Memory Index

| ID | Phase | Iteration | Keywords | Status | File |
|----|-------|-----------|----------|--------|------|
| 1  | 2     | 3         | auth, jwt, login, bcrypt | fail | /MEMORIES/MEMORY_1.md |
| 2  | 2     | 4         | auth, jwt, token expiry | pass | /MEMORIES/MEMORY_2.md |
```

### MEMORY_X.md — File Schema

```md
# Memory [ID]

## Phase
[Phase number and name]

## Iteration
[Loop iteration number within this phase]

## Context
[What was the goal of this iteration?]

## What Was Attempted
[Specific actions taken by which agents]

## What Worked
[Outcomes that produced positive results]

## What Failed
[Specific failures, error messages, root causes]

## Key Decisions
[Any architectural or implementation decisions made, including assumptions if --assume mode is on]

## Assumptions Made
[Only populated if --assume mode is active — logs autonomous decisions]

## Artifacts
[Files created, modified, or deleted during this iteration]

## Handoff Notes
[Any out-of-scope flags or escalation context passed to orchestrator]
```

### Memory Retrieval

- Agents request relevant memories via keyword search against `MEMORIES.md` index
- CLI command: `opencode ralph memory search <keyword>`
- The Leader Agent passes relevant `MEMORY_X.md` file paths to sub-agents in the handoff message
- On crash recovery: the Leader Agent reads the last `MEMORY_X.md` file to restore state before resuming

### Memory Write Trigger

A new MEMORY file is written by the Leader Agent:
- After every inner loop iteration (pass or fail)
- After every Plan Agent rescope
- After every Reviewer Agent correction

---

## 9. Failure Handling

All failure decisions are owned by the Leader Agent. Sub-agents return results — they never decide to retry or escalate themselves.

### 9.1 Phase Retry Exhaustion (5 retries)

```
Test Agent returns fail on iteration 5
  └─ Leader Agent writes MEMORY file with full failure context
  └─ Leader Agent invokes Plan Agent (rescope mode) with:
       - Current phase entry
       - All MEMORY files for this phase
       - Test failure detail

Plan Agent returns updated PHASES.md
  └─ Leader Agent resets retry counter to 0
  └─ Leader Agent resumes inner loop with up to 5 new attempts

IF Test Agent fails again after rescope (5 more iterations):
  └─ Leader Agent writes MEMORY file
  └─ Leader Agent marks phase status: "failed"
  └─ Leader Agent halts Ralph
  └─ Leader Agent surfaces to user:
       - Phase that failed
       - All memory files for that phase
       - Last test failure output
       - Suggested next steps
```

### 9.2 Bad Plan / Impossible Instructions

If the Build Agent determines that the current phase instructions are contradictory or unexecutable before writing code:
- Build Agent returns a hard-fail result to the Leader Agent with the conflict documented
- Leader Agent writes a MEMORY file documenting the conflict
- Leader Agent invokes the Plan Agent to rescope (retry counter is NOT incremented — this is not a build failure)
- Plan Agent returns updated PHASES.md
- Leader Agent resumes the phase

### 9.3 Crash Recovery / Resume

On `opencode ralph run` (or `--resume`):
1. Leader Agent reads `/.ralph/state.json` to identify current phase and iteration
2. Leader Agent reads the last `MEMORY_X.md` file for that phase
3. Leader Agent reconstructs handoff context and resumes from the start of the last incomplete iteration
4. Leader Agent writes a new MEMORY file for the resumed iteration

### 9.4 Docker Unavailable

If Docker is not present in the CLI environment:
- Test Agent returns a hard-fail result to the Leader Agent immediately
- Leader Agent halts Ralph and informs the user with setup instructions
- No retry is attempted

---

## 10. Agent Handoff — Message Format

All agent-to-agent communication is runtime messages constructed and dispatched by the Leader Agent. Sub-agents do not communicate with each other directly. The Leader Agent is always the sender and receiver of every handoff.

### Handoff Message Schema (Leader Agent → Sub-Agent)

```json
{
  "phase_id": 3,
  "phase_goal": "Implement user authentication with JWT",
  "acceptance_criteria": ["New user can register", "Login returns valid JWT", "Expired tokens rejected"],
  "iteration": 2,
  "prior_memories": ["/MEMORIES/MEMORY_4.md", "/MEMORIES/MEMORY_5.md"],
  "prior_failures": ["bcrypt hash mismatch on login", "token expiry not enforced"],
  "out_of_scope_flags": [],
  "assume_mode": true,
  "agent_role": "build"
}
```

### Sub-Agent Result Schema (Sub-Agent → Leader Agent)

```json
{
  "agent_role": "build",
  "phase_id": 3,
  "status": "complete",
  "out_of_scope_flags": [
    {
      "description": "Password reset flow is required but not in scope of this phase",
      "suggested_phase_name": "Password Reset Flow",
      "suggested_insertion_after_phase": 5
    }
  ],
  "notes": "Auth middleware extracted into shared module for reuse"
}
```

The Leader Agent reads the result, makes the next routing decision, and constructs the next handoff message.

---

## 11. AI Assumption Mode (`--assume`)

When `--assume` is active:
- Ralph makes design and implementation decisions autonomously without pausing to ask the user
- Every autonomous decision is logged in the `## Assumptions Made` section of the current MEMORY file
- Agents surface fewer clarifying questions and proceed with a reasonable default
- The user can audit all assumptions by running: `opencode ralph memory search assumptions`

When `--assume` is **not** active:
- Agents surface ambiguous decisions to the user before proceeding
- Ralph pauses and waits for user input, then resumes

---

## 12. Karpathy Principles — Application

Ralph applies minimal-complexity, high-clarity coding principles selectively:

| Agent | Enforcement Level |
|---|---|
| Leader Agent | Strict — decisions must be decisive and minimal; no over-orchestration |
| Plan Agent | Strict — plans must be minimal, unambiguous, avoid over-engineering |
| Build Agent | Strict — no speculative abstractions; code only what the phase requires |
| Test Agent | Light — tests should be thorough but mechanically focused |
| Document Agent | None — clarity and completeness take priority |
| Reviewer Agent | Strict — actively flag over-engineering and scope creep |

---

## 13. Success Criteria (Project Level)

A Ralph project is considered complete when:

1. All phases in `PHASES.md` have status `complete`
2. The Reviewer Agent has approved the final phase
3. All acceptance criteria across all phases are satisfied
4. All MEMORY files are written and indexed in `MEMORIES.md`
5. Documentation is up to date

---

## 14. Constraints and Non-Goals (v1)

### Constraints
- Docker must be available for the Test Agent to function
- All agents run sequentially within a phase (no parallelism in v1)
- Memory retrieval is keyword-based only (no semantic search in v1)

### Non-Goals (v1)
- Multi-user or collaborative Ralph sessions
- Semantic/vector memory search
- Parallel phase execution
- Web UI — CLI only in v1
