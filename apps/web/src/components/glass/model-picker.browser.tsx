import "../../styles/tailwind.css";
import "../../styles/app.css";
import "../../styles/glass.css";

import { useState } from "react";
import { page } from "vitest/browser";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import { GlassModelPicker } from "./model-picker";
import type { RuntimeModelItem } from "../../lib/runtime-models";

const fastModel: RuntimeModelItem = {
  key: "codex/gpt-5.4",
  provider: "codex",
  id: "gpt-5.4",
  name: "GPT-5.4",
  reasoning: false,
  supportsFastMode: true,
  supportsXhigh: false,
};

const slowModel: RuntimeModelItem = {
  ...fastModel,
  key: "claude/claude-sonnet-4-6",
  provider: "claudeAgent",
  id: "claude-sonnet-4-6",
  name: "Claude Sonnet 4.6",
  supportsFastMode: false,
};

function Harness(props: { item: RuntimeModelItem }) {
  const [fast, setFast] = useState(false);
  return (
    <GlassModelPicker
      items={[props.item]}
      selection={{
        model: {
          provider: props.item.provider,
          id: props.item.id,
          name: props.item.name,
          reasoning: props.item.reasoning,
        },
        fastMode: fast,
      }}
      variant="settings"
      onSelect={() => {}}
      onFastMode={setFast}
    />
  );
}

async function mount(item: RuntimeModelItem) {
  const host = document.createElement("div");
  document.body.append(host);
  const screen = await render(<Harness item={item} />, { container: host });
  const cleanup = async () => {
    await screen.unmount();
    host.remove();
  };
  return {
    [Symbol.asyncDispose]: cleanup,
    cleanup,
  };
}

describe("GlassModelPicker", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("shows fast mode controls for supported models and updates the trigger state", async () => {
    await using _ = await mount(fastModel);

    await page.getByRole("button").click();

    await vi.waitFor(() => {
      expect(document.body.textContent ?? "").toContain("Fast Mode");
    });

    await page.getByText("Fast Mode").click();
    await page.getByText("On").click();

    await vi.waitFor(() => {
      expect(document.body.textContent ?? "").toContain("Fast: On");
    });
  });

  it("hides fast mode controls for unsupported models", async () => {
    await using _ = await mount(slowModel);

    await page.getByRole("button").click();

    await vi.waitFor(() => {
      expect(document.body.textContent ?? "").not.toContain("Fast Mode");
    });
  });
});
