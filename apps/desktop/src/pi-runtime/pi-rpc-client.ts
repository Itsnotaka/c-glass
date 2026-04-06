import * as Effect from "effect/Effect";
import type { AgentMessage, ThinkingLevel } from "@mariozechner/pi-agent-core";
import type { PiProcessManagerOptions } from "./pi-process-manager";
import { PiProcessManager } from "./pi-process-manager";
import { parsePiRpcLine, type PiRpcIntake } from "./pi-rpc-event-parser";
import type { PiRpcCommand, PiRpcExtensionUiResponse, PiRpcResponse } from "./pi-rpc-types";

type ReqCommand = Exclude<PiRpcCommand, { type: "extension_ui_response" }>;

type Pending = {
  done: (value: PiRpcResponse) => void;
  fail: (err: Error) => void;
  type: string;
  timer: ReturnType<typeof setTimeout>;
};

function failText(res: PiRpcResponse) {
  if (res.success) return null;
  return res.error;
}

function data<T>(res: PiRpcResponse): T {
  if (!res.success) {
    throw new Error(res.error);
  }
  if ("data" in res) return res.data as T;
  return undefined as T;
}

export class PiRpcClient {
  private proc: PiProcessManager;
  private offs: Array<() => void> = [];
  private listeners = new Set<(intake: PiRpcIntake) => void>();
  private waits = new Map<string, Pending>();
  private seq = 0;

  constructor(opts: PiProcessManagerOptions) {
    this.proc = new PiProcessManager(opts);
  }

  onIntake(fn: (intake: PiRpcIntake) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  stderr() {
    return this.proc.getStderr();
  }

  start() {
    return Effect.tryPromise({
      try: async () => {
        this.offs.push(
          this.proc.onLine((line) => {
            const intake = parsePiRpcLine(line);
            this.handleIntake(intake);
          }),
        );
        this.offs.push(
          this.proc.onExit((event) => {
            this.rejectAll(
              new Error(
                `Runtime process exited (code=${event.code ?? "null"}, signal=${event.signal ?? "null"})`,
              ),
            );
          }),
        );
        await this.proc.start();
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  stop() {
    return Effect.tryPromise({
      try: async () => {
        this.rejectAll(new Error("Runtime client stopped"));
        for (const off of this.offs) off();
        this.offs = [];
        await this.proc.stop();
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  prompt(message: string, images?: { type: "image"; mimeType: string; data: string }[]) {
    return this.call({
      type: "prompt",
      message,
      ...(images && images.length ? { images } : {}),
    }).pipe(Effect.asVoid);
  }

  abort() {
    return this.call({ type: "abort" }).pipe(Effect.asVoid);
  }

  getState() {
    return this.call({ type: "get_state" }).pipe(
      Effect.map((res) =>
        data<{
          model?: unknown;
          thinkingLevel: string;
          isStreaming: boolean;
          isCompacting: boolean;
          steeringMode: "all" | "one-at-a-time";
          followUpMode: "all" | "one-at-a-time";
          sessionFile?: string;
          sessionId: string;
          sessionName?: string;
          autoCompactionEnabled: boolean;
          messageCount: number;
          pendingMessageCount: number;
        }>(res),
      ),
    );
  }

  getMessages() {
    return this.call({ type: "get_messages" }).pipe(
      Effect.map((res) => data<{ messages: AgentMessage[] }>(res).messages),
    );
  }

  getCommands() {
    return this.call({ type: "get_commands" }).pipe(
      Effect.map(
        (res) =>
          data<{
            commands: Array<{
              name: string;
              description?: string;
              source: "extension" | "prompt" | "skill";
            }>;
          }>(res).commands,
      ),
    );
  }

  setModel(provider: string, modelId: string) {
    return this.call({ type: "set_model", provider, modelId }).pipe(Effect.asVoid);
  }

  setThinkingLevel(next: ThinkingLevel) {
    return this.call({ type: "set_thinking_level", level: next }).pipe(Effect.asVoid);
  }

  sendUiResponse(res: PiRpcExtensionUiResponse) {
    return Effect.sync(() => {
      this.proc.send(res);
    });
  }

  private call(command: ReqCommand) {
    return Effect.tryPromise({
      try: async () => {
        const id = `rpc_${++this.seq}`;
        const full = { ...command, id };
        const res = await new Promise<PiRpcResponse>((done, fail) => {
          const timer = setTimeout(() => {
            this.waits.delete(id);
            fail(new Error(`Timed out waiting for ${command.type} response`));
          }, 30000);
          this.waits.set(id, { done, fail, type: command.type, timer });
          this.proc.send(full);
        });
        const text = failText(res);
        if (text) throw new Error(text);
        return res;
      },
      catch: (err) => (err instanceof Error ? err : new Error(String(err))),
    });
  }

  private handleIntake(intake: PiRpcIntake) {
    if (intake.kind === "response" && typeof intake.response.id === "string") {
      const pending = this.waits.get(intake.response.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.waits.delete(intake.response.id);
        pending.done(intake.response);
      }
    }
    for (const fn of this.listeners) fn(intake);
  }

  private rejectAll(err: Error) {
    for (const pending of this.waits.values()) {
      clearTimeout(pending.timer);
      pending.fail(err);
    }
    this.waits.clear();
  }
}
