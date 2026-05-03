<div align="center">

# 🚀 Oh-My-OpenKessel

### Multi-Agent Coding Orchestration for OpenCode

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue.svg)](https://www.typescriptlang.org/)
[![OpenCode](https://img.shields.io/badge/OpenCode-Plugin-green.svg)](https://opencode.ai)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Powered by 🎯 Ralph — Autonomous planning, building, testing, documenting, and reviewing across structured phases**

</div>

---

## 📋 Table of Contents

- [What is Oh-My-OpenKessel?](#what-is-oh-my-openkessel)
- [Installation](#installation)
  - [Quick Install (Copy to Agent)](#quick-install-copy-to-agent)
  - [Manual Install](#manual-install)
  - [Build from Source](#build-from-source)
- [Commands & Usage](#commands--usage)
  - [`ralph_init`](#ralph_init)
  - [`ralph_run`](#ralph_run)
  - [`ralph_status`](#ralph_status)
  - [`ralph_memory`](#ralph_memory)
  - [`ralph_rescue`](#ralph_rescue)
- [Architecture](#architecture)
  - [Leader Agent](#-leader-agent)
  - [Plan Agent](#-plan-agent)
  - [Build Agent](#-build-agent)
  - [Test Agent](#-test-agent)
  - [Reviewer Agent](#-reviewer-agent)
  - [Document Agent](#-document-agent)
- [Configuration](#configuration)
- [Phase Structure](#phase-structure)
- [Memory System](#memory-system)
- [Failure Handling](#failure-handling)
- [Karpathy Principles](#karpathy-principles)
- [Development](#development)

---

## 🎯 What is Oh-My-OpenKessel?

Oh-My-OpenKessel is a **multi-agent coding orchestration plugin** for OpenCode powered by Ralph, a sophisticated agent system that brings structure and autonomy to AI-assisted development. Instead of ad-hoc coding sessions, Oh-My-OpenKessel uses Ralph's **phased approach** with specialized agents that collaborate to build software:

```
┌─────────────────────────────────────────────────────────────┐
│  Oh-My-OpenKessel                                           │
│  YOUR GOAL → PRD → PHASES → BUILD → TEST → REVIEW → 📦      │
│  Powered by Ralph 🎯                                        │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- 🧠 **Intelligent Planning** - Ralph creates PRDs and structured phase plans
- 🏗️ **Multi-Agent Orchestration** - 5 specialized Ralph agents work in sequence
- 📝 **Memory System** - Ralph tracks attempts, failures, and decisions
- 🔄 **Automatic Retries** - Smart failure recovery with escalation
- 🐳 **Docker Testing** - Isolated, reproducible test execution
- 📊 **Status Tracking** - Always know where you are in the project

---

## 🚀 Installation

### ⚡ Quick Install (Copy to Agent)

Copy this entire block into your OpenCode agent for automatic installation:

````markdown
# Oh-My-OpenKessel Installation Script
# Copy everything below this line into your agent

## Step 1: Install the plugin
```bash
# Clone or create the Ralph plugin directory
mkdir -p /tmp/opencode-ralph
cd /tmp/opencode-ralph

# Create package.json
cat > package.json << 'EOF'
{
  "name": "opencode-oh-my-openkessel",
  "version": "1.0.0",
  "description": "Multi-agent coding orchestration plugin for OpenCode",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "prepare": "npm run build"
  },
  "keywords": ["opencode", "plugin", "multi-agent", "orchestration", "ralph"],
  "peerDependencies": {
    "@opencode-ai/plugin": "^2.0.0",
    "@opencode-ai/sdk": "^2.0.0"
  },
  "dependencies": {
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/node": "^20.19.39",
    "typescript": "^5.9.3"
  }
}
EOF

# Install dependencies
npm install
```

## Step 2: Copy plugin to OpenCode
```bash
# Create plugins directory if it doesn't exist
mkdir -p ~/.opencode/plugins

# Copy the built plugin
cp -r /tmp/opencode-oh-my-openkessel ~/.opencode/plugins/oh-my-openkessel

# Verify installation
ls -la ~/.opencode/plugins/oh-my-openkessel/
```

## Step 3: Build and activate
```bash
cd ~/.opencode/plugins/oh-my-openkessel
npm run build
echo "✅ Oh-My-OpenKessel installed and built successfully!"
echo "💡 Run 'opencode ralph_init \"Your project goal\"' to get started"
```

## Verification
After installation, verify Oh-My-OpenKessel is working:
```bash
# Check if Ralph commands are available
opencode ralph_init --help
opencode ralph_status
```

### 📦 Manual Install

```bash
# 1. Create the plugins directory
mkdir -p ~/.opencode/plugins

# 2. Copy the plugin files
cp -r dist/ ~/.opencode/plugins/oh-my-openkessel/

# 3. Verify
ls ~/.opencode/plugins/oh-my-openkessel/
```

### 🔨 Build from Source

```bash
# Clone and build
git clone <repository-url>
cd oh-my-openkessel
npm install
npm run build

# Install to OpenCode
mkdir -p ~/.opencode/plugins
cp -r dist/ ~/.opencode/plugins/oh-my-openkessel/
```
````

### 📦 Manual Install

```bash
# 1. Create the plugins directory
mkdir -p ~/.opencode/plugins

# 2. Copy the plugin files
cp -r dist/ ~/.opencode/plugins/ralph/

# 3. Verify
ls ~/.opencode/plugins/ralph/
```

### 🔨 Build from Source

```bash
# Clone and build
git clone <repository-url>
cd opencode-ralph
npm install
npm run build

# Install to OpenCode
mkdir -p ~/.opencode/plugins
cp -r dist/ ~/.opencode/plugins/ralph/
```

---

## 🎮 Commands & Usage

### `ralph_init`

**Initialize a new Ralph project** with planning documents:

```bash
# Basic initialization
opencode ralph_init "Create a REST API for user authentication"

# With tech stack specification
opencode ralph_init "Build a React dashboard" \
  --techStack "TypeScript, React, TailwindCSS, Vite" \
  --constraints "Must work offline, max bundle size 200kb"

# Enable assume mode (AI makes autonomous decisions)
opencode ralph_init "Create a CLI tool" --assumeMode
```

**Creates:**
| File | Purpose |
|------|---------|
| `PRD.md` | Problem definition, requirements, success criteria |
| `PHASES.md` | Ordered phase plan with goals and acceptance criteria |
| `MEMORIES.md` | Memory file index |
| `.ralph/config.json` | Ralph configuration |
| `MEMORIES/` | Directory for iteration memory files |

---

### `ralph_run`

**Start the multi-agent orchestration loop:**

```bash
# Start from the beginning
opencode ralph_run

# Resume after crash
opencode ralph_run --resume
```

**Orchestration Flow:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  📝 PLAN    │ ──▶ │  🏗️ BUILD   │ ──▶ │  🧪 TEST    │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
           ┌─────────────┐                    ▼
           │  📚 DOCUMENT│ ◀── ┌─────────────┐
           └─────────────┘     │  👁️ REVIEW   │
                               └─────────────┘
```

The loop continues until all phases complete or a fatal error occurs.

---

### `ralph_status`

**Check current project status:**

```bash
opencode ralph_status
```

**Output:**
```
📊 Ralph Status

Current Phase: Phase 3: API Integration
Status: in-progress
Iteration: 2 of 5
Retry Count: 1
Last Checkpoint: 2024-01-15T14:23:00Z

Progress: ████████░░ 80% (4 of 5 phases)
```

---

### `ralph_memory`

**Search and retrieve memory files:**

```bash
# Search all memories by keyword
opencode ralph_memory search auth

# Search within a specific phase
opencode ralph_memory search database --phase 2

# Limit results
opencode ralph_memory search error --limit 5
```

---

### `ralph_rescue`

**Emergency rescue for stuck projects:**

```bash
# Clear state and allow manual intervention
opencode ralph_rescue
```

Use this when:
- Ralph is stuck in an infinite retry loop
- The state file is corrupted
- You need to manually fix something mid-phase

---

## 🏛️ Architecture

Oh-My-OpenKessel uses Ralph, a **hub-and-spoke architecture** with a Leader Agent coordinating 5 specialized sub-agents:

```
                    ┌──────────────────┐
                    │   👑 LEADER      │
                    │     AGENT        │
                    │  (Orchestrator)  │
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  📝 PLAN      │  │  🏗️ BUILD      │  │  🧪 TEST       │
│  AGENT        │  │  AGENT         │  │  AGENT         │
└───────────────┘  └───────────────┘  └───────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
           ┌───────────────┐ ┌───────────────┐
           │  👁️ REVIEWER  │ │  📚 DOCUMENT  │
           │   AGENT       │ │   AGENT       │
           └───────────────┘ └───────────────┘
```

**Key Principle:** All communication flows through Ralph's Leader Agent. Sub-agents never talk directly to each other.

---

### 👑 Leader Agent

**Ralph's orchestrator that owns all decisions.**

**Responsibilities:**
- Govern the outer loop (project) and inner loop (phases)
- Invoke sub-agents in correct sequence
- Parse sub-agent results and decide next action
- Own all escalation logic (retry, rescope, halt)
- Write state after every transition
- Manage crash recovery

**Decision Rules:**

| Result | Action |
|--------|--------|
| Build `complete`, no flags | Invoke Test Agent |
| Build `hard-fail` | Invoke Plan Agent (rescope) |
| Test `pass` | Invoke Reviewer Agent |
| Test `fail`, retry < 5 | Increment retry, re-invoke Build |
| Test `fail`, retry == 5 | Rescope with Plan Agent |
| Reviewer `approved` | Invoke Document Agent, advance phase |
| Reviewer `rejected` | Re-invoke Build Agent |

---

### 📝 Plan Agent

**Creates and modifies project plans.**

**Modes:**
- **Init Mode**: Generate `PRD.md` and `PHASES.md` at project start
- **Rescope Mode**: Modify phases when retry limit is exhausted

**Principles:**
- Think before planning — understand the goal completely
- Simplicity first — minimum plan that achieves the goal
- Goal-driven — every phase has concrete, testable acceptance criteria

---

### 🏗️ Build Agent

**Ralph agent that writes and modifies code.**

**Karpathy Principles Applied:**
1. **Think Before Coding** — State assumptions explicitly, check prior memory files
2. **Simplicity First** — Minimum code that solves the problem
3. **Surgical Changes** — Touch only what the phase requires
4. **Goal-Driven Execution** — Map each criterion to implementation checkpoint

**Result Format:**
```json
{
  "status": "complete" | "hard-fail",
  "outOfScopeFlags": [],
  "notes": "Summary of what was built"
}
```

---

### 🧪 Test Agent

**Ralph agent that writes and executes tests.**

**Focus Areas:**
- **Goal-Driven Testing** — Every test maps to an acceptance criterion
- **Thoroughness Within Scope** — Happy path, failure path, edge cases
- **Mechanical Focus** — Deterministic, isolated, fast tests

**Docker Integration:**
```bash
docker run --rm -v $(pwd):/workspace <test-image> <test-command>
```

**Result Format:**
```json
{
  "status": "complete",
  "testResults": {
    "status": "pass" | "fail",
    "failures": [...],
    "coverage": "85%"
  }
}
```

---

### 👁️ Reviewer Agent

**Ralph agent that evaluates phase completion and code quality.**

**Evaluation Criteria:**
1. **Acceptance Criteria Check** — Every criterion satisfied and verified
2. **Architectural Integration** — No conflicts with upcoming phases
3. **Karpathy Violation Check** — Enforces code quality principles

**Violations Checked:**
- Unnecessary complexity
- Unsurgical changes
- Speculative features
- Scope creep

---

### 📚 Document Agent

**Ralph agent that writes documentation for completed phases.**

**Standards:**
- Update `README.md` with new features
- Write per-module docs for non-obvious behavior
- Document public APIs with examples
- Explain architectural decisions

**Quality:** Clarity and completeness over brevity

---

## ⚙️ Configuration

Edit `.ralph/config.json`:

```json
{
  "model": "claude-3-5-sonnet",
  "maxRetries": 5,
  "assumeMode": false,
  "dockerEnabled": true
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | string | `"claude-3-5-sonnet"` | AI model for sub-agents |
| `maxRetries` | number | `5` | Retries before escalating |
| `assumeMode` | boolean | `false` | AI makes decisions autonomously |
| `dockerEnabled` | boolean | `true` | Run tests in Docker |

---

## 📊 Phase Structure

Each phase in `PHASES.md` follows this format:

```markdown
## Phase 1: Authentication Setup

**Status:** pending | in-progress | complete | failed | escalated
**Goal:** Implement user authentication with JWT

### Tasks
- [ ] Set up JWT library
- [ ] Create auth middleware
- [ ] Implement login endpoint

### Acceptance Criteria
- POST /auth/register with valid payload returns 201
- POST /auth/login returns signed JWT
- Request with expired token returns 401

### Out-of-Scope Flags
None

### Notes
[Any additional context or decisions]
```

**Statuses:**
- `pending` — Not yet started
- `in-progress` — Currently being worked on
- `complete` — Reviewed and approved
- `failed` — Exhausted retry limit, requires manual intervention
- `escalated` — Sent to Plan Agent for rescope

---

## 🧠 Memory System

Ralph (via Oh-My-OpenKessel) writes memory files after each iteration to track progress and learn from failures:

```
MEMORIES/
├── MEMORY_1.md    # Phase 1, Iteration 1
├── MEMORY_2.md    # Phase 1, Iteration 2
├── MEMORY_3.md    # Phase 2, Iteration 1
└── ...
```

**Each Memory Tracks:**
- What was attempted
- What worked
- What failed
- Key decisions made
- Assumptions (if assumeMode on)
- Artifacts created

**Memory Format:**
```markdown
# Memory 5: Phase 2, Iteration 1

## Context
Building user registration endpoint

## Attempted
Implemented POST /auth/register with bcrypt hashing

## Worked
- User creation succeeds
- Password hashing works

## Failed
- Email validation regex too strict
- Missing unique constraint on email

## Key Decisions
- Using bcrypt with 10 rounds
- Added email format validation

## Assumptions Made
- SQLite database is sufficient for MVP
```

**Index:** `MEMORIES.md` tracks all memories with keywords for search.

---

## 🚨 Failure Handling

Ralph (via Oh-My-OpenKessel) handles failures automatically with a smart retry and escalation system:

```
Build Fails ──▶ Retry (max 5) ──▶ Rescope ──▶ Retry (max 5) ──▶ Halt
     │                │              │              │
     │                ▼              │              ▼
     │         Document in           │        Surface to user
     │         MEMORY file           │        with full context
     │                               │
     └───────────────────────────────┘ (Hard-fail: immediate rescope)
```

**Failure Scenarios:**

| Scenario | Handling |
|----------|----------|
| Build failure | Retry up to 5 times with documentation |
| Test failure | Retry with fixes, document in memory |
| Review rejection | Retry with corrections |
| Retry limit reached | Escalate to Plan Agent for rescope |
| Rescope + 5 more retries | Halt with full context to user |
| Docker hard-fail | Halt immediately with setup instructions |

**Halting Format:**
```
RALPH HALTED

Phase: 3 — API Integration
Reason: Database connection pool exhausted
Iterations attempted: 5
Rescope attempted: yes

Relevant memory files:
- /MEMORIES/MEMORY_12.md
- /MEMORIES/MEMORY_13.md

Last test failure:
[Full error details]

Suggested next steps:
1. Increase connection pool size in config
2. Or switch to external database
```

---

## 🧭 Karpathy Principles

Ralph (the engine behind Oh-My-OpenKessel) applies minimal-complexity principles from Andrej Karpathy's approach to software development:

### 1. 🧠 Think Before Acting
- Do not start until you understand the problem completely
- State assumptions explicitly
- Check prior work before repeating approaches

### 2. ✂️ Simplicity First
- Write the minimum code that solves the problem
- No abstractions for code used once
- No configurability not explicitly requested
- No error handling for impossible scenarios

### 3. 🎯 Goal-Driven
- Transform goals into concrete, verifiable checkpoints
- Every acceptance criterion maps to implementation
- No work beyond what criteria require

### 4. 🔪 Surgical Changes
- Touch only what the phase requires
- Don't refactor adjacent code
- Don't clean up pre-existing issues
- Document out-of-scope discoveries

### 5. ⚖️ Decisive and Minimal
- No over-orchestration
- Fail fast on unrecoverable errors
- Keep state minimal
- Surface reasoning, don't decide silently

---

## 🔧 Development

**Build the plugin:**
```bash
npm run build
```

**Watch mode:**
```bash
npm run dev
```

**Project Structure:**
```
oh-my-openkessel/
├── src/
│   ├── index.ts           # Plugin entry point & commands
│   ├── types/             # TypeScript type definitions
│   ├── agents/            # Agent implementations
│   │   ├── leader.ts      # Leader Agent (orchestrator)
│   │   ├── plan.ts        # Plan Agent
│   │   ├── build.ts       # Build Agent
│   │   ├── test.ts        # Test Agent
│   │   ├── reviewer.ts    # Reviewer Agent
│   │   └── document.ts    # Document Agent
│   └── utils/             # Utility functions
├── agents/                # Agent documentation/prompts
│   ├── leader.md
│   ├── plan.md
│   ├── build.md
│   ├── test.md
│   ├── reviewer.md
│   └── document.md
├── dist/                  # Compiled JavaScript
├── package.json
├── tsconfig.json
└── README.md
```

---

## 📄 License

MIT License — see LICENSE file for details.

---

<div align="center">

**Built with ❤️ for the OpenCode community**

[Report Bug](https://github.com/yourusername/oh-my-openkessel/issues) · [Request Feature](https://github.com/yourusername/oh-my-openkessel/issues)

</div>
