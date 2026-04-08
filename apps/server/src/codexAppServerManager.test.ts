import { describe, expect, it } from "vitest";

import {
  classifyCodexStderrLine,
  normalizeCodexModelSlug,
  shouldSuppressCodexRuntimeMessage,
} from "./codexAppServerManager";

describe("normalizeCodexModelSlug", () => {
  it("canonicalizes the legacy gpt-5-codex slug", () => {
    expect(normalizeCodexModelSlug("gpt-5-codex")).toBe("gpt-5.4");
  });
});

describe("classifyCodexStderrLine", () => {
  it("ignores broken local skill symlink noise", () => {
    expect(
      classifyCodexStderrLine(
        "2026-04-08T01:50:41.147204Z ERROR codex_core_skills::loader: failed to stat skills entry /Users/workgyver/.codex/skills/remotion-best-practices (symlink): No such file or directory",
      ),
    ).toBeNull();
  });

  it("ignores rmcp transport shutdown follow-on noise", () => {
    expect(
      classifyCodexStderrLine(
        '2026-04-08T01:50:41.183436Z ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when Client(Reqwest(reqwest::Error { kind: Request, url: "http://127.0.0.1" }))',
      ),
    ).toBeNull();
  });

  it("keeps actionable websocket failures", () => {
    expect(
      classifyCodexStderrLine(
        "2026-04-08T01:50:47.118818Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 500 Internal Server Error, url: wss://api.openai.com/v1/realtime",
      ),
    ).toEqual({
      message:
        "2026-04-08T01:50:47.118818Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 500 Internal Server Error, url: wss://api.openai.com/v1/realtime",
    });
  });
});

describe("shouldSuppressCodexRuntimeMessage", () => {
  it("suppresses identical runtime messages in the dedupe window", () => {
    const last = {
      message:
        "2026-04-08t01:50:47.118818z error codex_api::endpoint::responses_websocket: failed to connect to websocket: http error: 500 internal server error",
      at: 1_000,
    };

    expect(
      shouldSuppressCodexRuntimeMessage(
        last,
        "2026-04-08T01:50:47.118818Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 500 Internal Server Error",
        5_000,
      ),
    ).toBe(true);
    expect(
      shouldSuppressCodexRuntimeMessage(
        last,
        "2026-04-08T01:50:47.118818Z ERROR codex_api::endpoint::responses_websocket: failed to connect to websocket: HTTP error: 500 Internal Server Error",
        7_000,
      ),
    ).toBe(false);
  });
});
