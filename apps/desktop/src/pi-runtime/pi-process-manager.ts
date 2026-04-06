import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

type Exit = {
  code: number | null;
  signal: NodeJS.Signals | null;
};

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export interface PiProcessManagerOptions {
  workerPath: string;
  cwd: string;
  sessionPath?: string;
}

export class PiProcessManager {
  private workerPath: string;
  private cwd: string;
  private sessionPath: string | undefined;
  private child: ChildProcessWithoutNullStreams | null = null;
  private lines = new Set<(line: string) => void>();
  private errs = new Set<(chunk: string) => void>();
  private exits = new Set<(event: Exit) => void>();
  private stderr = "";
  private outbuf = "";

  constructor(opts: PiProcessManagerOptions) {
    this.workerPath = opts.workerPath;
    this.cwd = opts.cwd;
    this.sessionPath = opts.sessionPath;
  }

  onLine(fn: (line: string) => void) {
    this.lines.add(fn);
    return () => {
      this.lines.delete(fn);
    };
  }

  onStderr(fn: (chunk: string) => void) {
    this.errs.add(fn);
    return () => {
      this.errs.delete(fn);
    };
  }

  onExit(fn: (event: Exit) => void) {
    this.exits.add(fn);
    return () => {
      this.exits.delete(fn);
    };
  }

  getStderr() {
    return this.stderr;
  }

  async start() {
    if (this.child) throw new Error("Runtime process already started");

    const args = [this.workerPath, "--cwd", this.cwd];
    if (this.sessionPath) {
      args.push("--session", this.sessionPath);
    }

    const env = { ...process.env, ELECTRON_RUN_AS_NODE: "1" };
    const child = spawn(process.execPath, args, {
      cwd: this.cwd,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;

    child.stdout.on("data", (chunk: Buffer) => {
      this.readStdout(chunk.toString("utf8"));
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      this.stderr += text;
      for (const fn of this.errs) fn(text);
    });

    child.on("exit", (code, signal) => {
      this.child = null;
      for (const fn of this.exits) fn({ code, signal });
    });

    await new Promise<void>((ok) => setTimeout(ok, 80));
    if (child.exitCode !== null) {
      throw new Error(
        `Runtime process exited on startup (code ${child.exitCode}). ${this.stderr.trim()}`,
      );
    }
  }

  send(value: Json) {
    if (!this.child?.stdin) {
      throw new Error("Runtime process is not running");
    }
    this.child.stdin.write(`${JSON.stringify(value)}\n`);
  }

  async stop() {
    if (!this.child) return;

    const child = this.child;
    await new Promise<void>((ok) => {
      let done = false;
      const close = () => {
        if (done) return;
        done = true;
        ok();
      };

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
      }, 800);
      timer.unref?.();

      child.once("exit", () => {
        clearTimeout(timer);
        close();
      });

      child.kill("SIGTERM");
    });
    this.child = null;
  }

  private readStdout(chunk: string) {
    this.outbuf += chunk;
    while (true) {
      const idx = this.outbuf.indexOf("\n");
      if (idx < 0) return;
      const line = this.outbuf.slice(0, idx);
      this.outbuf = this.outbuf.slice(idx + 1);
      if (line.length === 0) continue;
      for (const fn of this.lines) fn(line);
    }
  }
}
