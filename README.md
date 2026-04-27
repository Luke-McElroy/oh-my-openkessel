# Ralph - Multi-Agent Coding Orchestration for OpenCode

Ralph is a multi-agent coding orchestration plugin for OpenCode that autonomously plans, builds, tests, documents, and reviews code across structured phases.

## Installation

1. Copy the plugin to your OpenCode plugins directory:
```bash
mkdir -p .opencode/plugins
cp -r dist/ .opencode/plugins/ralph/
```

2. Or build from source:
```bash
npm install
npm run build
```

## Usage

### Initialize a Ralph Project

```bash
opencode ralph_init "Create a REST API for user authentication"
```

This creates:
- `PRD.md` - Problem definition and requirements
- `PHASES.md` - Ordered phase plan
- `MEMORIES.md` - Memory index
- `.ralph/config.json` - Ralph configuration
- `MEMORIES/` - Directory for memory files

### Run Ralph

```bash
opencode ralph_run
```

This starts the multi-agent orchestration loop:
1. Build Agent writes code
2. Test Agent runs tests
3. Reviewer Agent evaluates
4. Document Agent updates docs
5. Repeats until all phases complete

### Check Status

```bash
opencode ralph_status
```

Shows current phase, iteration count, and retry status.

### Resume After Crash

```bash
opencode ralph_run --resume
```

Resumes from the last checkpoint.

### Search Memories

```bash
opencode ralph_memory search auth
```

Search through all memory files by keyword.

### Emergency Rescue

If Ralph gets stuck:
```bash
opencode ralph_rescue
```

Clears state so you can manually intervene.

## Architecture

Ralph has a Leader Agent and 5 sub-agents:
- **Plan Agent**: Creates PRD and phase plans
- **Build Agent**: Writes and modifies code
- **Test Agent**: Runs tests in Docker
- **Document Agent**: Updates documentation
- **Reviewer Agent**: Evaluates completion

All agents communicate through the Leader Agent - no direct sub-agent communication.

## Configuration

Edit `.ralph/config.json`:
```json
{
  "model": "claude-3-5-sonnet",
  "maxRetries": 5,
  "assumeMode": false,
  "dockerEnabled": true
}
```

- `model`: AI model to use for agents
- `maxRetries`: Retries before escalating
- `assumeMode`: AI makes decisions autonomously
- `dockerEnabled`: Run tests in Docker

## Phase Structure

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
- Users can register and login
- JWT tokens are generated correctly
- Expired tokens are rejected

### Out-of-Scope Flags
None

### Notes
[Any additional context]
```

## Memory System

Ralph writes memory files after each iteration:
- `/MEMORIES/MEMORY_1.md`
- `/MEMORIES/MEMORY_2.md`
- etc.

Each memory tracks:
- What was attempted
- What worked
- What failed
- Key decisions made
- Assumptions (if assumeMode on)

Search memories: `opencode ralph_memory search <keyword>`

## Failure Handling

Ralph handles failures automatically:
- Build failures: Retry up to 5 times
- Test failures: Retry with fixes
- Review rejections: Insert corrective phase
- After 5 retries: Escalate to Plan Agent for rescope
- After rescope + 5 more retries: Halt with full context

## Karpathy Principles

Ralph applies minimal-complexity principles:
- No speculative abstractions
- Strict scope enforcement
- Simple, clear plans
- Decisive decisions
- No over-orchestration

## Development

Build the plugin:
```bash
npm run build
```

Watch mode:
```bash
npm run dev
```

## License

MIT
