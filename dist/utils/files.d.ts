import type { Phase, Memory, MemoryIndexEntry, RalphState, RalphConfig } from '../types/index.js';
export declare function ensureRalphStructure($: any, projectPath: string): Promise<void>;
export declare function loadPhases($: any, projectPath: string): Promise<Phase[]>;
export declare function parsePhases(content: string): Phase[];
export declare function savePhases($: any, projectPath: string, phases: Phase[]): Promise<void>;
export declare function loadState($: any, projectPath: string): Promise<RalphState | null>;
export declare function saveState($: any, projectPath: string, state: RalphState): Promise<void>;
export declare function loadConfig($: any, projectPath: string): Promise<RalphConfig>;
export declare function saveConfig($: any, projectPath: string, config: RalphConfig): Promise<void>;
export declare function loadMemoriesIndex($: any, projectPath: string): Promise<MemoryIndexEntry[]>;
export declare function parseMemoriesIndex(content: string): MemoryIndexEntry[];
export declare function saveMemoriesIndex($: any, projectPath: string, entries: MemoryIndexEntry[]): Promise<void>;
export declare function loadMemory($: any, projectPath: string, id: number): Promise<Memory | null>;
export declare function parseMemory(content: string, id: number): Memory;
export declare function saveMemory($: any, projectPath: string, memory: Memory): Promise<void>;
//# sourceMappingURL=files.d.ts.map