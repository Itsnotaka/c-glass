export type GitFileState =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked"
  | "typechange"
  | "conflicted";

export interface GitFileSummary {
  id: string;
  path: string;
  prevPath: string | null;
  state: GitFileState;
  staged: boolean;
  unstaged: boolean;
}

export interface GitState {
  cwd: string;
  gitRoot: string | null;
  repo: boolean;
  clean: boolean;
  count: number;
  files: GitFileSummary[];
  patch: string;
}

export interface GitBridge {
  getState: (cwd: string) => Promise<GitState>;
  refresh: (cwd: string) => Promise<GitState>;
  init: (cwd: string) => Promise<GitState>;
  discard: (cwd: string, paths: string[]) => Promise<GitState>;
  onState: (listener: (state: GitState) => void) => () => void;
}
