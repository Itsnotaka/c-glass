import "../../styles/tailwind.css";
import "../../styles/app.css";
import "../../styles/glass.css";

import type { HarnessDescriptor } from "@glass/contracts";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { page } from "vitest/browser";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  api: {
    server: {
      listSkills: vi.fn(async () => []),
    },
    projects: {
      searchEntries: vi.fn(async () => ({ entries: [] })),
    },
    git: {
      onStatus: vi.fn(() => () => undefined),
    },
  },
  navigate: vi.fn(),
  openSettings: vi.fn(),
  send: vi.fn(async () => ({ clear: true })),
  runtime: {
    items: [
      {
        key: "codex/gpt-5.4",
        provider: "codex",
        id: "gpt-5.4",
        name: "GPT-5.4",
        reasoning: true,
        supportsFastMode: true,
        supportsXhigh: true,
      },
    ],
    fastMode: false,
    fastSupported: true,
    loading: false,
    status: "ready" as const,
    thinkingLevel: "high" as const,
  },
}));

vi.mock("../../native-api", () => ({
  readNativeApi: () => mocks.api,
}));

vi.mock("../../hooks/use-runtime-models", () => ({
  useRuntimeModels: () => mocks.runtime,
}));

vi.mock("../../hooks/use-shell-cwd", () => ({
  useShellState: () => ({ cwd: "/tmp/project" }),
}));

vi.mock("../../lib/thread-session-store", () => ({
  useThreadSessionStore: (pick: (state: object) => unknown) =>
    pick({
      snaps: {
        "thread-fast": {
          thinkingLevel: "high",
        },
      },
      work: {},
    }),
}));

vi.mock("../../store", () => ({
  useStore: (pick: (state: object) => unknown) =>
    pick({
      threads: [{ id: "thread-fast", branch: null }],
    }),
}));

vi.mock("./settings-context", () => ({
  useGlassSettings: () => ({ openSettings: mocks.openSettings }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("@tanstack/react-hotkeys", () => ({
  useHotkey: () => undefined,
}));

import { GlassChatComposer } from "./chat-composer";

const descriptor: HarnessDescriptor = {
  kind: "codex",
  label: "Codex",
  available: true,
  enabled: true,
  capabilities: {
    modelPicker: true,
    thinkingLevels: true,
    commands: true,
    interactive: true,
    fileAttachments: true,
  },
};

function Harness(props: { supported: boolean }) {
  const [draft, setDraft] = useState("");
  const [fast, setFast] = useState(false);
  return (
    <GlassChatComposer
      sessionId="thread-fast"
      draft={draft}
      onDraft={setDraft}
      busy={false}
      model={{
        provider: "codex",
        id: "gpt-5.4",
        name: "GPT-5.4",
        reasoning: true,
      }}
      modelLoading={false}
      variant="dock"
      onAbort={() => {}}
      onModel={() => {}}
      onThinkingLevel={() => {}}
      fastActive={fast}
      fastSupported={props.supported}
      onFastMode={setFast}
      onFastToggle={() => setFast((cur) => !cur)}
      onPlanMode={() => {}}
      onPlanToggle={() => {}}
      onSend={mocks.send}
      harness="codex"
      harnessDescriptor={descriptor}
    />
  );
}

async function mount(supported = true) {
  mocks.runtime.items = [
    {
      key: "codex/gpt-5.4",
      provider: "codex",
      id: "gpt-5.4",
      name: "GPT-5.4",
      reasoning: true,
      supportsFastMode: supported,
      supportsXhigh: true,
    },
  ];
  mocks.runtime.fastSupported = supported;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  root.render(<Harness supported={supported} />);
  await Promise.resolve();
  const cleanup = async () => {
    root.unmount();
    host.remove();
  };
  return {
    [Symbol.asyncDispose]: cleanup,
    cleanup,
  };
}

function seg(text: string) {
  return [...document.querySelectorAll<HTMLSpanElement>(".glass-composer-mirror span")].find(
    (node) => node.textContent === text,
  );
}

function check(node: HTMLSpanElement) {
  const style = getComputedStyle(node);
  const cut =
    style.getPropertyValue("box-decoration-break") ||
    style.getPropertyValue("-webkit-box-decoration-break");
  expect(parseFloat(style.paddingLeft)).toBeGreaterThan(0);
  expect(parseFloat(style.paddingRight)).toBeGreaterThan(0);
  expect(parseFloat(style.borderRadius)).toBeGreaterThan(0);
  expect(cut).toBe("clone");
  expect(style.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
}

describe("GlassChatComposer fast mode", () => {
  beforeEach(() => {
    mocks.api.server.listSkills.mockImplementation(async () => []);
    mocks.api.server.listSkills.mockClear();
    mocks.api.projects.searchEntries.mockClear();
    mocks.api.projects.searchEntries.mockImplementation(async () => ({ entries: [] }));
    mocks.navigate.mockClear();
    mocks.openSettings.mockClear();
    mocks.send.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows /fast, toggles it from the slash menu, and updates the pill state", async () => {
    await using _ = await mount(true);

    await page.getByRole("textbox").fill("/fa");

    await vi.waitFor(() => {
      const text = document.body.textContent ?? "";
      expect(text).toContain("/fast");
      expect(text).toContain("Turn on fast mode");
    });

    await page.getByRole("option").click();

    await vi.waitFor(() => {
      expect((document.querySelector("textarea") as HTMLTextAreaElement | null)?.value ?? "").toBe(
        "",
      );
      expect(document.body.textContent ?? "").toContain("Fast");
    });

    await page.getByRole("textbox").fill("/fa");

    await vi.waitFor(() => {
      expect(document.body.textContent ?? "").toContain("Turn off fast mode");
    });

    await page.getByLabelText("Turn off fast mode").click();

    await page.getByRole("textbox").fill("/fa");

    await vi.waitFor(() => {
      expect(document.body.textContent ?? "").toContain("Turn on fast mode");
    });
  });

  it("toggles fast mode from a raw /fast submit without sending a message", async () => {
    await using _ = await mount(true);

    await page.getByRole("textbox").fill("/fast");
    document
      .querySelector("textarea")
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter" }),
      );

    await vi.waitFor(() => {
      expect(mocks.send).not.toHaveBeenCalled();
      expect((document.querySelector("textarea") as HTMLTextAreaElement | null)?.value ?? "").toBe(
        "",
      );
      expect(document.body.textContent ?? "").toContain("Fast");
    });
  });

  it("does not offer /fast when the selected model does not support it", async () => {
    await using _ = await mount(false);

    await page.getByRole("textbox").fill("/fa");

    await vi.waitFor(() => {
      expect(document.body.textContent ?? "").not.toContain("/fast");
      expect(document.body.textContent ?? "").not.toContain("Turn on fast mode");
    });
  });
});

describe("GlassChatComposer mirror tokens", () => {
  beforeEach(() => {
    mocks.api.server.listSkills.mockClear();
    mocks.api.server.listSkills.mockImplementation(async () => []);
    mocks.api.projects.searchEntries.mockClear();
    mocks.api.projects.searchEntries.mockImplementation(async () => ({ entries: [] }));
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders padded selection-style highlights for skills and quoted file mentions", async () => {
    mocks.api.server.listSkills.mockResolvedValue([
      {
        id: "/Users/workgyver/.agents/skills/tailwind",
        name: "tailwind",
        body: "Use the Tailwind skill.",
        description: "Tailwind CSS guidance.",
      },
    ]);

    await using _ = await mount(true);

    await page.getByRole("textbox").fill('/tailwind @"foo bar"');

    await vi.waitFor(() => {
      expect(seg("/tailwind")).toBeTruthy();
      expect(seg('@"foo bar"')).toBeTruthy();
    });

    check(seg("/tailwind")!);
    check(seg('@"foo bar"')!);
  });

  it("renders pending slash text with the same padded token treatment", async () => {
    await using _ = await mount(true);

    await page.getByRole("textbox").fill("/tai");

    await vi.waitFor(() => {
      expect(seg("/tai")).toBeTruthy();
    });

    check(seg("/tai")!);
  });
});
