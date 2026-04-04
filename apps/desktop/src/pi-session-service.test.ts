import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import * as OS from "node:os";
import * as Path from "node:path";

import * as Effect from "effect/Effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const session = {
    sessionId: "session-1",
    sessionFile: undefined,
    sessionManager: {
      getCwd: () => "/tmp/glass",
      getTree: () => [],
      getEntries: () => [],
      getLeafId: () => null,
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
    promptTemplates: [] as Array<{ name: string; description: string; content: string }>,
    extensionRunner: {
      getRegisteredCommands: vi.fn<() => Array<{ name: string; description: string }>>(() => []),
      getCommand: vi.fn<(name: string) => undefined>(() => undefined),
    },
    resourceLoader: {
      getSkills: vi.fn<
        () => {
          skills: Array<{
            name: string;
            description: string;
            filePath: string;
            baseDir: string;
            sourceInfo: unknown;
            disableModelInvocation: boolean;
          }>;
          diagnostics: unknown[];
        }
      >(() => ({ skills: [], diagnostics: [] })),
    },
    getSteeringMessages: () => [],
    getFollowUpMessages: () => [],
    subscribe: vi.fn(() => () => {}),
    prompt: vi.fn(async () => {}),
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
    setThinkingLevel: vi.fn((level: string) => {
      session.thinkingLevel = level;
    }),
    abort: vi.fn(async () => {}),
    dispose: vi.fn(),
  };

  return {
    session,
    createAgentSession: vi.fn(async () => ({ session })),
    createSessionManager: vi.fn(() => ({
      kind: "mgr",
      getSessionDir: () => `${session.sessionManager.getCwd()}/.sessions`,
    })),
    openSessionManager: vi.fn(() => ({
      kind: "mgr",
      getSessionDir: () => `${session.sessionManager.getCwd()}/.sessions`,
    })),
    listSessions: vi.fn(async () => []),
    createLoader: vi.fn(
      class {
        reload = vi.fn(async () => {});
      },
    ),
  };
});

vi.mock("@mariozechner/pi-coding-agent", () => ({
  DefaultResourceLoader: mocks.createLoader,
  SessionManager: {
    create: mocks.createSessionManager,
    open: mocks.openSessionManager,
    list: mocks.listSessions,
  },
  createAgentSession: mocks.createAgentSession,
}));

import { PiSessionService } from "./pi-session-service";

const png =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO0p0n0AAAAASUVORK5CYII=";

describe("PiSessionService", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(Path.join(OS.tmpdir(), "glass-pi-"));
    mkdirSync(Path.join(dir, ".sessions"));
    mocks.session.sessionManager.getCwd = () => dir;
    mocks.session.promptTemplates = [];
    mocks.session.extensionRunner.getRegisteredCommands.mockReturnValue([]);
    mocks.session.extensionRunner.getCommand.mockReturnValue(undefined);
    mocks.session.resourceLoader.getSkills.mockReturnValue({ skills: [], diagnostics: [] });
    mocks.session.prompt.mockClear();
    mocks.session.subscribe.mockClear();
    mocks.session.setModel.mockClear();
    mocks.session.setThinkingLevel.mockClear();
    mocks.session.abort.mockClear();
    mocks.session.dispose.mockClear();
    mocks.createAgentSession.mockClear();
    mocks.createLoader.mockClear();
    mocks.createSessionManager.mockClear();
    mocks.openSessionManager.mockClear();
    mocks.listSessions.mockResolvedValue([]);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("expands @file mentions and image attachments into prompt text and images", async () => {
    writeFileSync(Path.join(dir, "note.ts"), "export const note = 1;\n", "utf8");
    writeFileSync(Path.join(dir, "shot.png"), Buffer.from(png, "base64"));

    const cfg = {
      sync: vi.fn(),
      reg: { find: vi.fn(() => null) },
      auth: {},
      settings: vi.fn(() => ({})),
      paths: vi.fn(() => ({ agent: dir })),
    };
    const shell = { cwd: dir };
    const service = new PiSessionService(
      cfg as unknown as ConstructorParameters<typeof PiSessionService>[0],
      shell as unknown as ConstructorParameters<typeof PiSessionService>[1],
    );

    const snap = await Effect.runPromise(service.create());
    await Effect.runPromise(
      service.prompt(snap.id, {
        text: "Look at @note.ts",
        attachments: [{ type: "path", path: "shot.png" }],
      }),
    );

    expect(mocks.session.prompt).toHaveBeenCalledWith(
      expect.stringContaining(
        `<file name="${Path.join(dir, "note.ts")}">\nexport const note = 1;\n\n</file>`,
      ),
      expect.objectContaining({
        images: [
          expect.objectContaining({
            type: "image",
            mimeType: "image/png",
          }),
        ],
      }),
    );
    expect(
      (
        mocks.session.prompt.mock.calls as unknown as Array<
          [string, { images?: unknown[]; expandPromptTemplates?: boolean } | undefined]
        >
      )[0]?.[0],
    ).toContain(`<file name="${Path.join(dir, "shot.png")}"></file>`);
  });

  it("expands prompt templates before appending file blocks", async () => {
    writeFileSync(Path.join(dir, "bug.ts"), "throw new Error('boom');\n", "utf8");
    mocks.session.promptTemplates = [
      {
        name: "fix",
        description: "Fix something",
        content: "Fix $1 carefully.",
      },
    ];

    const cfg = {
      sync: vi.fn(),
      reg: { find: vi.fn(() => null) },
      auth: {},
      settings: vi.fn(() => ({})),
      paths: vi.fn(() => ({ agent: dir })),
    };
    const shell = { cwd: dir };
    const service = new PiSessionService(
      cfg as unknown as ConstructorParameters<typeof PiSessionService>[0],
      shell as unknown as ConstructorParameters<typeof PiSessionService>[1],
    );

    const snap = await Effect.runPromise(service.create());
    await Effect.runPromise(
      service.prompt(snap.id, {
        text: "/fix crash @bug.ts",
      }),
    );

    expect(mocks.session.prompt).toHaveBeenCalledWith(
      expect.stringContaining("Fix crash carefully."),
      expect.objectContaining({ expandPromptTemplates: false, images: [] }),
    );
    expect(
      (
        mocks.session.prompt.mock.calls as unknown as Array<
          [string, { images?: unknown[]; expandPromptTemplates?: boolean } | undefined]
        >
      )[0]?.[0],
    ).toContain(`<file name="${Path.join(dir, "bug.ts")}">\nthrow new Error('boom');\n\n</file>`);
  });

  it("returns prompt, extension, and skill slash commands", async () => {
    mocks.session.promptTemplates = [
      {
        name: "fix",
        description: "Fix something",
        content: "Fix it",
      },
    ];
    mocks.session.extensionRunner.getRegisteredCommands.mockReturnValue([
      { name: "deploy", description: "Deploy app" },
    ]);
    mocks.session.resourceLoader.getSkills.mockReturnValue({
      skills: [
        {
          name: "sql",
          description: "Write SQL",
          filePath: Path.join(dir, "sql", "SKILL.md"),
          baseDir: Path.join(dir, "sql"),
          sourceInfo: {} as never,
          disableModelInvocation: false,
        },
      ],
      diagnostics: [],
    });

    const cfg = {
      sync: vi.fn(),
      reg: { find: vi.fn(() => null) },
      auth: {},
      settings: vi.fn(() => ({})),
      paths: vi.fn(() => ({ agent: dir })),
    };
    const shell = { cwd: dir };
    const service = new PiSessionService(
      cfg as unknown as ConstructorParameters<typeof PiSessionService>[0],
      shell as unknown as ConstructorParameters<typeof PiSessionService>[1],
    );

    const snap = await Effect.runPromise(service.create());
    const items = await Effect.runPromise(service.commands(snap.id));

    expect(items).toEqual([
      { name: "deploy", description: "Deploy app", source: "extension" },
      { name: "fix", description: "Fix something", source: "prompt" },
      { name: "skill:sql", description: "Write SQL", source: "skill" },
    ]);
  });
});
