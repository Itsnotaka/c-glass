import * as Effect from "effect/Effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const session = {
    sessionId: "session-1",
    sessionFile: undefined,
    sessionManager: {
      getCwd: () => "/tmp/glass",
      getTree: () => [],
    },
    sessionName: null,
    messages: [],
    isStreaming: false,
    model: {
      provider: "openai",
      id: "gpt-4o",
      name: "GPT-4o",
      reasoning: false,
    },
    thinkingLevel: "off",
    getSteeringMessages: () => [],
    getFollowUpMessages: () => [],
    subscribe: vi.fn(() => () => {}),
    setModel: vi.fn(
      async (next: { provider: string; id: string; name?: string; reasoning?: boolean }) => {
        session.model = {
          provider: next.provider,
          id: next.id,
          name: next.name ?? next.id,
          reasoning: Boolean(next.reasoning),
        };
      },
    ),
    dispose: vi.fn(),
  };

  return {
    session,
    createAgentSession: vi.fn(async () => ({ session })),
    createSessionManager: vi.fn(() => ({ kind: "mgr" })),
  };
});

vi.mock("@mariozechner/pi-coding-agent", () => ({
  SessionManager: {
    create: mocks.createSessionManager,
  },
  createAgentSession: mocks.createAgentSession,
}));

import { PiSessionService } from "./pi-session-service";

describe("PiSessionService", () => {
  beforeEach(() => {
    mocks.session.model = {
      provider: "openai",
      id: "gpt-4o",
      name: "GPT-4o",
      reasoning: false,
    };
    mocks.createAgentSession.mockClear();
    mocks.createSessionManager.mockClear();
    mocks.session.subscribe.mockClear();
    mocks.session.setModel.mockClear();
    mocks.session.dispose.mockClear();
  });

  it("emits a fresh snapshot after setModel", async () => {
    const cfg = {
      sync: vi.fn(),
      reg: {
        find: vi.fn((provider: string, model: string) => {
          if (provider !== "anthropic" || model !== "claude-opus-4-6") return null;
          return {
            provider,
            id: model,
            name: "Claude Opus 4.6",
            reasoning: true,
          };
        }),
      },
      auth: {},
      settings: vi.fn(() => ({})),
    };
    const shell = { cwd: "/tmp/glass" };
    const service = new PiSessionService(
      cfg as unknown as ConstructorParameters<typeof PiSessionService>[0],
      shell as unknown as ConstructorParameters<typeof PiSessionService>[1],
    );
    const fn = vi.fn();
    service.listen(fn);

    const snap = await Effect.runPromise(service.create());
    await Effect.runPromise(service.setModel(snap.id, "anthropic", "claude-opus-4-6"));

    expect(mocks.session.setModel).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "anthropic",
        id: "claude-opus-4-6",
      }),
    );
    expect(fn).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: snap.id,
        snapshot: expect.objectContaining({
          model: expect.objectContaining({
            provider: "anthropic",
            id: "claude-opus-4-6",
            reasoning: true,
          }),
        }),
        event: expect.objectContaining({
          type: "model_change",
          provider: "anthropic",
          modelId: "claude-opus-4-6",
        }),
      }),
    );
  });
});
