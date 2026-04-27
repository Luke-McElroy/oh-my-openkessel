declare module '@opencode-ai/plugin' {
  export interface PluginInput {
    client: any;
    project: { path: string; name: string; id: string } | null;
    directory: string;
    worktree: string;
    $: any;
  }
  
  export type Plugin = (ctx: PluginInput) => Promise<{
    tool?: Record<string, any>;
    'chat.message'?: (input: any, output: any) => Promise<void>;
    'experimental.session.compacting'?: (input: any, output: any) => Promise<void>;
  }>;
  
  export function tool(config: {
    description: string;
    args: any;
    execute: (args: any, context: { sessionID: string }) => Promise<string>;
  }): any;
  
  export namespace tool {
    export const schema: {
      string: () => any;
      number: () => any;
      boolean: () => any;
      array: (item: any) => any;
      enum: (values: string[]) => any;
      object: (shape: Record<string, any>) => any;
      optional: () => any;
    };
  }
}

declare module '@opencode-ai/sdk' {
  export interface Part {
    id?: string;
    sessionID?: string;
    messageID?: string;
    type: 'text' | 'tool' | 'image' | string;
    text?: string;
    synthetic?: boolean;
  }
}
