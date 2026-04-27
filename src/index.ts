import type { Plugin, PluginInput } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';
import type { Part } from '@opencode-ai/sdk';
import { LeaderAgent } from './agents/leader.js';
import { PlanAgent } from './agents/plan.js';
import type { SessionState } from './types/index.js';
import * as fileUtils from './utils/files.js';

interface RalphSessionData {
  state: SessionState;
  leader: LeaderAgent;
  plan: PlanAgent;
}

const sessions = new Map<string, RalphSessionData>();

export const RalphPlugin: Plugin = async (ctx: PluginInput) => {
  const { client, project, directory, $ } = ctx;
  
  return {
    tool: {
      ralph_init: tool({
        description: 'Initialize a new Ralph multi-agent project',
        args: {
          projectGoal: tool.schema.string(),
          techStack: tool.schema.string().optional(),
          constraints: tool.schema.string().optional(),
          assumeMode: tool.schema.boolean().optional(),
        },
        async execute(args, toolCtx) {
          const sessionId = toolCtx.sessionID;
          const projectPath = project?.path || directory;
          
          const planAgent = new PlanAgent(ctx, projectPath);
          const result = await planAgent.initialize(
            args.projectGoal,
            args.techStack,
            args.constraints
          );
          
          const leader = new LeaderAgent(ctx, projectPath);
          await leader.initialize(args.assumeMode || false);
          
          sessions.set(sessionId, {
            state: {
              ralphState: {
                currentPhase: 0,
                iteration: 0,
                retryCount: 0,
                assumeMode: args.assumeMode || false,
                lastCheckpoint: new Date().toISOString(),
              },
              config: {
                model: 'claude-3-5-sonnet',
                maxRetries: 5,
                assumeMode: args.assumeMode || false,
                dockerEnabled: true,
              },
              isRunning: false,
            },
            leader,
            plan: planAgent,
          });
          
          return `${result}\n\nRalph project initialized at: ${projectPath}\nRun 'ralph_run' to start the orchestration loop.`;
        },
      }),

      ralph_run: tool({
        description: 'Run the Ralph multi-agent orchestration loop',
        args: {
          resume: tool.schema.boolean().optional(),
        },
        async execute(args, toolCtx) {
          const sessionId = toolCtx.sessionID;
          const projectPath = project?.path || directory;
          
          let sessionData = sessions.get(sessionId);
          
          if (!sessionData) {
            const leader = new LeaderAgent(ctx, projectPath);
            await leader.initialize(false);
            
            sessionData = {
              state: {
                ralphState: {
                  currentPhase: 0,
                  iteration: 0,
                  retryCount: 0,
                  assumeMode: false,
                  lastCheckpoint: new Date().toISOString(),
                },
                config: {
                  model: 'claude-3-5-sonnet',
                  maxRetries: 5,
                  assumeMode: false,
                  dockerEnabled: true,
                },
                isRunning: false,
              },
              leader,
              plan: new PlanAgent(ctx, projectPath),
            };
            
            sessions.set(sessionId, sessionData);
          }
          
          const result = args.resume 
            ? await sessionData.leader.resume()
            : await sessionData.leader.run();
          
          return result;
        },
      }),

      ralph_status: tool({
        description: 'Check Ralph project status and current phase',
        args: {},
        async execute(args, toolCtx) {
          const sessionId = toolCtx.sessionID;
          const projectPath = project?.path || directory;
          
          let sessionData = sessions.get(sessionId);
          
          if (!sessionData) {
            const leader = new LeaderAgent(ctx, projectPath);
            return await leader.getStatus();
          }
          
          return await sessionData.leader.getStatus();
        },
      }),

      ralph_memory: tool({
        description: 'Search and retrieve Ralph memory files',
        args: {
          keyword: tool.schema.string(),
          phase: tool.schema.number().optional(),
          limit: tool.schema.number().optional(),
        },
        async execute(args, toolCtx) {
          const projectPath = project?.path || directory;
          const index = await fileUtils.loadMemoriesIndex($, projectPath);
          
          let results = index;
          
          if (args.keyword) {
            const keyword = args.keyword.toLowerCase();
            results = results.filter(e => 
              e.keywords.some(k => k.toLowerCase().includes(keyword))
            );
          }
          
          if (args.phase !== undefined) {
            results = results.filter(e => e.phase === args.phase);
          }
          
          if (args.limit) {
            results = results.slice(0, args.limit);
          }
          
          const output = results.map(e => 
            `Memory ${e.id}: Phase ${e.phase}, Iter ${e.iteration} - ${e.status} - ${e.keywords.join(', ')}`
          ).join('\n');
          
          return output || 'No memories found matching criteria';
        },
      }),

      ralph_rescue: tool({
        description: 'Rescue a stuck Ralph project by clearing state and allowing manual intervention',
        args: {},
        async execute(args, toolCtx) {
          const sessionId = toolCtx.sessionID;
          const projectPath = project?.path || directory;
          
          try {
            await $`rm -f ${projectPath}/.ralph/state.json`;
            sessions.delete(sessionId);
            return 'Ralph state cleared. You can now reinitialize or manually fix issues.';
          } catch (e) {
            return `Failed to clear state: ${e}`;
          }
        },
      }),
    },

    'chat.message': async (input, output) => {
      const textParts = output.parts.filter(
        (p: Part): p is Part & { type: 'text'; text: string } => p.type === 'text'
      );
      const userMessage = textParts.map((p: Part & { type: 'text'; text: string }) => p.text).join('\n').toLowerCase();
      
      if (userMessage.includes('ralph') && userMessage.includes('status')) {
        const projectPath = project?.path || directory;
        const leader = new LeaderAgent(ctx, projectPath);
        const status = await leader.getStatus();
        
        output.parts.push({
          id: `prt_ralph_status_${Date.now()}`,
          sessionID: input.sessionID,
          messageID: output.message.id,
          type: 'text',
          text: `\n\n[Ralph Status]\n${status}`,
          synthetic: true,
        });
      }
    },

    'experimental.session.compacting': async (input, output) => {
      const sessionData = sessions.get(input.sessionID);
      if (sessionData) {
        output.context.push(`<ralph-state>
          Phase: ${sessionData.state.ralphState.currentPhase}
          Iteration: ${sessionData.state.ralphState.iteration}
          Retries: ${sessionData.state.ralphState.retryCount}
          Running: ${sessionData.state.isRunning}
        </ralph-state>`);
      }
    },
  };
};
