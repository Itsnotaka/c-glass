import type {
  Api,
  AssistantMessage,
  AssistantMessageEventStream,
  Context,
  Model,
  OAuthCredentials,
  OAuthLoginCallbacks,
  Provider,
  SimpleStreamOptions,
  ToolCall,
  ToolResultMessage,
  Usage,
} from "@mariozechner/pi-ai";
import { createAssistantMessageEventStream } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionFactory, ModelRegistry } from "@mariozechner/pi-coding-agent";

type ProviderInput = Parameters<ModelRegistry["registerProvider"]>[1];

const CURSOR = "cursor";
const API = "cursor-agent" as Api;
const WEB = "https://cursor.com";
const BACK = "https://api2.cursor.sh";
const CID = "KbZUR41cY7W6zRSdpSUJ7I7mLYBKOCmB";
const GAP = 5 * 60 * 1000;
const POLL = 500;
const WAIT = 180 * 1000;

const TOOL = {
  delete: 11,
  bash: 15,
  edit: 38,
  ls: 39,
  read: 40,
  grep: 41,
  find: 42,
} as const;

const MSG = {
  user: 1,
  assistant: 2,
} as const;

const FALLBACK = [
  {
    id: "gpt-5.1-codex",
    name: "GPT-5.1 Codex",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 128000,
    maxTokens: 16384,
  },
  {
    id: "claude-4.5-opus-high",
    name: "Claude 4.5 Opus",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 200000,
    maxTokens: 16384,
  },
  {
    id: "composer-1",
    name: "Composer-1",
    reasoning: true,
    input: ["text", "image"],
    contextWindow: 200000,
    maxTokens: 16384,
  },
] as const;

async function sha(text: string) {
  const buf = new TextEncoder().encode(text);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", buf));
}

function wait(ms: number, sig?: AbortSignal) {
  if (!sig) return new Promise((ok) => setTimeout(ok, ms));
  if (sig.aborted) return Promise.reject(new Error("Aborted"));
  return new Promise<void>((ok, bad) => {
    const end = () => {
      clearTimeout(id);
      sig.removeEventListener("abort", stop);
    };
    const done = () => {
      end();
      ok();
    };
    const stop = () => {
      end();
      bad(new Error("Aborted"));
    };
    const id = setTimeout(done, ms);
    sig.addEventListener("abort", stop, { once: true });
  });
}

function exp(token: string) {
  const raw = token.split(".")[1] ?? "";
  if (!raw) return null;
  try {
    const json = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      exp?: unknown;
    };
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

function auth(sig?: AbortSignal) {
  const val = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
  return sha(val).then((hash) => ({
    sig,
    ver: val,
    ch: Buffer.from(hash).toString("base64url"),
    id: crypto.randomUUID(),
  }));
}

function loginUrl(ch: string, id: string, mode = "login") {
  const url = new URL(`${WEB}/loginDeepControl`);
  url.searchParams.set("challenge", ch);
  url.searchParams.set("uuid", id);
  url.searchParams.set("mode", mode);
  return url.toString();
}

async function poll(ver: string, id: string, sig?: AbortSignal) {
  const end = Date.now() + WAIT;
  const url = new URL(`${BACK}/auth/poll`);
  url.searchParams.set("uuid", id);
  url.searchParams.set("verifier", ver);

  while (Date.now() < end) {
    if (sig?.aborted) throw new Error("Aborted");
    const res = await fetch(url, sig ? { signal: sig } : undefined);
    if (res.status === 404) {
      await wait(POLL, sig);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Cursor auth poll failed: ${res.status} ${await res.text().catch(() => "")}`);
    }
    const json = (await res.json()) as {
      accessToken?: unknown;
      refreshToken?: unknown;
      authId?: unknown;
    };
    const access = typeof json.accessToken === "string" ? json.accessToken.trim() : "";
    const refresh = typeof json.refreshToken === "string" ? json.refreshToken.trim() : "";
    if (access && refresh) {
      return {
        access,
        refresh,
        expires: exp(access) ?? Date.now() + 60 * 60 * 1000 - GAP,
        ...(typeof json.authId === "string" && json.authId.trim()
          ? { authId: json.authId.trim() }
          : {}),
      } satisfies OAuthCredentials;
    }
    await wait(POLL, sig);
  }

  throw new Error("Cursor login timed out");
}

export async function loginCursor(cb: OAuthLoginCallbacks) {
  const info = await auth(cb.signal);
  cb.onProgress?.("Open Cursor login in your browser...");
  cb.onAuth({ url: loginUrl(info.ch, info.id) });
  cb.onProgress?.("Waiting for Cursor login...");
  return poll(info.ver, info.id, cb.signal);
}

export async function refreshCursor(credentials: OAuthCredentials) {
  const res = await fetch(`${BACK}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: CID,
      refresh_token: credentials.refresh,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Cursor token refresh failed: ${res.status} ${await res.text().catch(() => "")}`,
    );
  }

  const json = (await res.json()) as {
    access_token?: unknown;
    refresh_token?: unknown;
    shouldLogout?: unknown;
  };

  if (json.shouldLogout === true) {
    throw new Error("Cursor token refresh requested logout");
  }

  const access = typeof json.access_token === "string" ? json.access_token.trim() : "";
  if (!access) throw new Error("Cursor token refresh returned no access token");

  const refresh =
    typeof json.refresh_token === "string" && json.refresh_token.trim()
      ? json.refresh_token.trim()
      : credentials.refresh;

  return {
    ...credentials,
    access,
    refresh,
    expires: exp(access) ?? Date.now() + 60 * 60 * 1000 - GAP,
  } satisfies OAuthCredentials;
}

function usage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  };
}

function trace(id: string) {
  const a = id.replace(/-/g, "").padEnd(32, "0").slice(0, 32);
  const b = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return `00-${a}-${b}-01`;
}

function headers(
  token: string,
  opts?: { sid?: string | undefined; extra?: Record<string, string> },
) {
  const id = crypto.randomUUID();
  return {
    Authorization: `Bearer ${token}`,
    "Connect-Protocol-Version": "1",
    "x-cursor-client-type": "ide",
    "x-cursor-client-device-type": "desktop",
    "x-cursor-client-os": process.platform,
    "x-cursor-client-arch": process.arch,
    "x-cursor-client-version": "glass",
    "x-ghost-mode": "implicit-false",
    "x-new-onboarding-completed": "false",
    ...(opts?.sid ? { "x-session-id": opts.sid } : {}),
    "X-Request-ID": id,
    "X-Amzn-Trace-Id": `Root=${id}`,
    traceparent: trace(id),
    ...opts?.extra,
  };
}

async function unary<T>(url: string, token: string, body: unknown, sid?: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...headers(token, { sid }),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Cursor request failed: ${res.status} ${await res.text().catch(() => "")}`);
  }

  return (await res.json()) as T;
}

function push(buf: Uint8Array, next: Uint8Array) {
  const out = new Uint8Array(buf.length + next.length);
  out.set(buf);
  out.set(next, buf.length);
  return out;
}

async function* streamJson<T>(
  url: string,
  token: string,
  body: unknown,
  opts?: SimpleStreamOptions,
) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...headers(token, { sid: opts?.sessionId }),
      "content-type": "application/connect+json",
    },
    body: JSON.stringify(body),
    ...(opts?.signal ? { signal: opts.signal } : {}),
  });

  if (!res.ok) {
    throw new Error(`Cursor stream failed: ${res.status} ${await res.text().catch(() => "")}`);
  }

  if (!res.body) throw new Error("Cursor stream returned no body");

  const rd = res.body.getReader();
  let buf = new Uint8Array(0);

  while (true) {
    const hit = await rd.read();
    if (hit.done) break;
    buf = push(buf, hit.value);

    while (buf.length >= 5) {
      const flag = buf[0] ?? 0;
      if (flag & 1) throw new Error("Compressed Cursor frames are not supported");
      const len =
        ((buf[1] ?? 0) << 24) | ((buf[2] ?? 0) << 16) | ((buf[3] ?? 0) << 8) | (buf[4] ?? 0);
      if (buf.length < 5 + len) break;
      const raw = buf.slice(5, 5 + len);
      buf = buf.slice(5 + len);
      const text = new TextDecoder().decode(raw);
      if (flag & 2) {
        if (!text) continue;
        const end = JSON.parse(text) as { error?: { message?: string } };
        if (end.error?.message) throw new Error(end.error.message);
        continue;
      }
      if (!text) continue;
      yield JSON.parse(text) as T;
    }
  }
}

function joinUser(content: Context["messages"][number]["content"]) {
  if (typeof content === "string")
    return { text: content, imgs: [] as Array<{ data: string; uuid: string }> };
  let text = "";
  const imgs = [] as Array<{ data: string; uuid: string }>;
  for (const item of content) {
    if (item.type === "text") {
      text += text ? `\n${item.text}` : item.text;
      continue;
    }
    if (item.type === "image") {
      imgs.push({ data: item.data, uuid: crypto.randomUUID() });
    }
  }
  return { text, imgs };
}

function joinAssistant(content: AssistantMessage["content"]) {
  let text = "";
  const think = [] as Array<{ text: string; signature?: string }>;
  for (const item of content) {
    if (item.type === "text") {
      text += text ? `\n${item.text}` : item.text;
      continue;
    }
    if (item.type === "thinking") {
      think.push({
        text: item.thinking,
        ...(item.thinkingSignature ? { signature: item.thinkingSignature } : {}),
      });
    }
  }
  return { text, think };
}

function mapTools(tools: Context["tools"]) {
  if (!tools?.length) return [] as number[];
  const names = new Set(tools.map((item) => item.name));
  const out = [] as number[];
  if (names.has("read")) out.push(TOOL.read);
  if (names.has("bash")) out.push(TOOL.bash);
  if (names.has("edit") || names.has("write")) out.push(TOOL.edit);
  if (names.has("ls")) out.push(TOOL.ls);
  if (names.has("grep")) out.push(TOOL.grep);
  if (names.has("find")) out.push(TOOL.find);
  return out;
}

function textBlocks(content: ToolResultMessage["content"]) {
  let text = "";
  const imgs = [] as Array<{ data: string; uuid: string }>;
  for (const item of content) {
    if (item.type === "text") {
      text += text ? `\n${item.text}` : item.text;
      continue;
    }
    imgs.push({ data: item.data, uuid: crypto.randomUUID() });
  }
  return { text, imgs };
}

function callMap(ctx: Context) {
  const out = new Map<string, ToolCall>();
  for (const msg of ctx.messages) {
    if (msg.role !== "assistant") continue;
    for (const item of msg.content) {
      if (item.type !== "toolCall") continue;
      out.set(item.id, item);
    }
  }
  return out;
}

function one(call?: ToolCall | null) {
  if (!call) return undefined;
  if (call.name === "read") {
    return {
      tool: TOOL.read,
      toolCallId: call.id,
      name: call.name,
      rawArgs: JSON.stringify(call.arguments),
      readFileV2Params: {
        targetFile: String(call.arguments.path ?? ""),
        ...(typeof call.arguments.offset === "number" ? { offset: call.arguments.offset } : {}),
        ...(typeof call.arguments.limit === "number" ? { limit: call.arguments.limit } : {}),
        charsLimit: 50000,
      },
    };
  }
  if (call.name === "bash") {
    return {
      tool: TOOL.bash,
      toolCallId: call.id,
      name: call.name,
      rawArgs: JSON.stringify(call.arguments),
      runTerminalCommandV2Params: {
        command: String(call.arguments.command ?? ""),
      },
    };
  }
  if (call.name === "write") {
    return {
      tool: TOOL.edit,
      toolCallId: call.id,
      name: call.name,
      rawArgs: JSON.stringify(call.arguments),
      editFileV2Params: {
        relativeWorkspacePath: String(call.arguments.path ?? ""),
        contentsAfterEdit: String(call.arguments.content ?? ""),
      },
    };
  }
  return undefined;
}

export function buildCursorChatRequest(
  model: Model<Api>,
  ctx: Context,
  opts?: SimpleStreamOptions,
) {
  const api = typeof opts?.apiKey === "string" ? opts.apiKey.trim() : "";
  const calls = callMap(ctx);
  const convo = [] as Array<Record<string, unknown>>;

  for (const msg of ctx.messages) {
    if (msg.role === "user") {
      const row = joinUser(msg.content);
      convo.push({
        type: MSG.user,
        text: row.text,
        images: row.imgs,
      });
      continue;
    }

    if (msg.role === "assistant") {
      const row = joinAssistant(msg.content);
      if (!row.text && row.think.length === 0) continue;
      convo.push({
        type: MSG.assistant,
        text: row.text,
        ...(row.think.length ? { allThinkingBlocks: row.think } : {}),
      });
      continue;
    }

    const row = textBlocks(msg.content);
    const hit = calls.get(msg.toolCallId);
    convo.push({
      type: MSG.assistant,
      toolResults: [
        {
          toolCallId: msg.toolCallId,
          toolName: msg.toolName,
          toolIndex: 0,
          args: JSON.stringify(hit?.arguments ?? {}),
          rawArgs: JSON.stringify(hit?.arguments ?? {}),
          content: row.text,
          images: row.imgs,
          ...(msg.isError
            ? {
                error: {
                  clientVisibleErrorMessage: row.text || `${msg.toolName} failed`,
                  modelVisibleErrorMessage: row.text || `${msg.toolName} failed`,
                },
              }
            : {}),
          ...(one(hit) ? { toolCall: one(hit) } : {}),
        },
      ],
    });
  }

  return {
    conversation: convo,
    modelDetails: {
      modelName: model.id,
      apiKey: api,
      enableGhostMode: false,
      maxMode: false,
    },
    requestId: crypto.randomUUID(),
    conversationId: opts?.sessionId ?? crypto.randomUUID(),
    isChat: true,
    isAgentic: Boolean(ctx.tools?.length),
    useUnifiedChatPrompt: true,
    allowModelFallbacks: true,
    supportedTools: mapTools(ctx.tools),
    shouldDisableTools: !ctx.tools?.length,
  };
}

function val(input: unknown) {
  if (typeof input === "number") return input;
  if (typeof input !== "string") return -1;
  if (input.endsWith("READ_FILE_V2")) return TOOL.read;
  if (input.endsWith("RUN_TERMINAL_COMMAND_V2")) return TOOL.bash;
  if (input.endsWith("EDIT_FILE_V2")) return TOOL.edit;
  if (input.endsWith("LIST_DIR_V2")) return TOOL.ls;
  if (input.endsWith("RIPGREP_RAW_SEARCH")) return TOOL.grep;
  if (input.endsWith("GLOB_FILE_SEARCH")) return TOOL.find;
  return -1;
}

export function mapCursorTool(input: Record<string, unknown>) {
  const tool = val(input.tool);
  const id =
    typeof input.toolCallId === "string" && input.toolCallId.trim()
      ? input.toolCallId.trim()
      : crypto.randomUUID();

  if (tool === TOOL.read) {
    const args = (input.readFileV2Params ?? {}) as {
      targetFile?: unknown;
      offset?: unknown;
      limit?: unknown;
    };
    return {
      id,
      name: "read",
      args: {
        path: String(args.targetFile ?? ""),
        ...(typeof args.offset === "number" ? { offset: args.offset } : {}),
        ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
      },
    };
  }

  if (tool === TOOL.bash) {
    const args = (input.runTerminalCommandV2Params ?? {}) as { command?: unknown };
    return {
      id,
      name: "bash",
      args: { command: String(args.command ?? "") },
    };
  }

  if (tool === TOOL.edit) {
    const args = (input.editFileV2Params ?? {}) as {
      relativeWorkspacePath?: unknown;
      contentsAfterEdit?: unknown;
      streamingContent?: unknown;
      code?: { code?: unknown } | undefined;
      text?: { text?: unknown } | undefined;
    };
    return {
      id,
      name: "write",
      args: {
        path: String(args.relativeWorkspacePath ?? ""),
        content: String(
          args.contentsAfterEdit ??
            args.streamingContent ??
            args.code?.code ??
            args.text?.text ??
            "",
        ),
      },
    };
  }

  if (tool === TOOL.ls) {
    const args = (input.listDirV2Params ?? {}) as { targetDirectory?: unknown };
    return {
      id,
      name: "ls",
      args: { path: String(args.targetDirectory ?? ".") },
    };
  }

  if (tool === TOOL.find) {
    const args = (input.globFileSearchParams ?? {}) as {
      targetDirectory?: unknown;
      globPattern?: unknown;
    };
    return {
      id,
      name: "find",
      args: {
        path: String(args.targetDirectory ?? "."),
        pattern: String(args.globPattern ?? "*"),
      },
    };
  }

  if (tool === TOOL.grep) {
    const args = (input.ripgrepRawSearchParams ?? {}) as {
      pattern?: unknown;
      path?: unknown;
      headLimit?: unknown;
    };
    return {
      id,
      name: "grep",
      args: {
        pattern: String(args.pattern ?? ""),
        path: String(args.path ?? "."),
        ...(typeof args.headLimit === "number" ? { limit: args.headLimit } : {}),
      },
    };
  }

  return null;
}

function endText(stream: AssistantMessageEventStream, out: AssistantMessage, idx: number | null) {
  if (idx == null) return null;
  const block = out.content[idx];
  if (!block || block.type !== "text") return null;
  stream.push({ type: "text_end", contentIndex: idx, content: block.text, partial: out });
  return null;
}

function endThink(stream: AssistantMessageEventStream, out: AssistantMessage, idx: number | null) {
  if (idx == null) return null;
  const block = out.content[idx];
  if (!block || block.type !== "thinking") return null;
  stream.push({ type: "thinking_end", contentIndex: idx, content: block.thinking, partial: out });
  return null;
}

function zero(model: Model<Api>): AssistantMessage {
  return {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider as Provider,
    model: model.id,
    usage: usage(),
    stopReason: "stop",
    timestamp: Date.now(),
  };
}

export function streamCursor(
  model: Model<Api>,
  ctx: Context,
  opts?: SimpleStreamOptions,
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();

  (async () => {
    const out = zero(model);
    let txt: number | null = null;
    let think: number | null = null;
    const calls = new Map<string, number>();

    try {
      const key = typeof opts?.apiKey === "string" ? opts.apiKey.trim() : "";
      if (!key) throw new Error("Missing Cursor access token. Run OAuth login first.");

      stream.push({ type: "start", partial: out });

      for await (const msg of streamJson<Record<string, unknown>>(
        `${BACK}/aiserver.v1.ChatService/StreamUnifiedChat`,
        key,
        buildCursorChatRequest(model, ctx, opts),
        opts,
      )) {
        const rawThink = msg.thinking as
          | { text?: unknown; signature?: unknown; isLastThinkingChunk?: unknown }
          | undefined;
        if (rawThink?.text) {
          txt = endText(stream, out, txt);
          if (think == null) {
            think =
              out.content.push({
                type: "thinking",
                thinking: "",
                ...(typeof rawThink.signature === "string" && rawThink.signature
                  ? { thinkingSignature: rawThink.signature }
                  : {}),
              }) - 1;
            stream.push({ type: "thinking_start", contentIndex: think, partial: out });
          }
          const block = out.content[think];
          if (block?.type === "thinking") {
            block.thinking += String(rawThink.text);
            stream.push({
              type: "thinking_delta",
              contentIndex: think,
              delta: String(rawThink.text),
              partial: out,
            });
          }
          if (rawThink.isLastThinkingChunk === true) {
            think = endThink(stream, out, think);
          }
        }

        if (typeof msg.text === "string" && msg.text) {
          think = endThink(stream, out, think);
          if (txt == null) {
            txt = out.content.push({ type: "text", text: "" }) - 1;
            stream.push({ type: "text_start", contentIndex: txt, partial: out });
          }
          const block = out.content[txt];
          if (block?.type === "text") {
            block.text += msg.text;
            stream.push({ type: "text_delta", contentIndex: txt, delta: msg.text, partial: out });
          }
        }

        const part = msg.partialToolCall as Record<string, unknown> | undefined;
        if (part) {
          txt = endText(stream, out, txt);
          think = endThink(stream, out, think);
          const hit = mapCursorTool(part);
          if (!hit) continue;
          if (calls.has(hit.id)) continue;
          const idx =
            out.content.push({ type: "toolCall", id: hit.id, name: hit.name, arguments: {} }) - 1;
          calls.set(hit.id, idx);
          stream.push({ type: "toolcall_start", contentIndex: idx, partial: out });
        }

        const raw = (msg.toolCallV2 ?? msg.toolCall) as Record<string, unknown> | undefined;
        if (raw) {
          txt = endText(stream, out, txt);
          think = endThink(stream, out, think);
          const hit = mapCursorTool(raw);
          if (!hit) continue;
          const idx =
            calls.get(hit.id) ??
            out.content.push({
              type: "toolCall",
              id: hit.id,
              name: hit.name,
              arguments: {},
            }) - 1;
          calls.set(hit.id, idx);
          if ((calls.get(hit.id) ?? -1) === idx && idx === out.content.length - 1) {
            stream.push({ type: "toolcall_start", contentIndex: idx, partial: out });
          }
          const block = out.content[idx];
          if (block?.type !== "toolCall") continue;
          block.name = hit.name;
          block.arguments = hit.args;
          const delta = JSON.stringify(hit.args);
          if (delta) {
            stream.push({ type: "toolcall_delta", contentIndex: idx, delta, partial: out });
          }
          stream.push({ type: "toolcall_end", contentIndex: idx, toolCall: block, partial: out });
        }
      }

      txt = endText(stream, out, txt);
      think = endThink(stream, out, think);
      out.stopReason = out.content.some((item) => item.type === "toolCall") ? "toolUse" : "stop";
      stream.push({
        type: "done",
        reason: out.stopReason === "toolUse" ? "toolUse" : "stop",
        message: out,
      });
      stream.end();
    } catch (err) {
      txt = endText(stream, out, txt);
      think = endThink(stream, out, think);
      out.stopReason = opts?.signal?.aborted ? "aborted" : "error";
      out.errorMessage = err instanceof Error ? err.message : String(err);
      stream.push({ type: "error", reason: out.stopReason, error: out });
      stream.end();
    }
  })();

  return stream;
}

function cost() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
}

function model(input: {
  id: string;
  name: string;
  reasoning: boolean;
  input: Array<"text" | "image">;
  contextWindow: number;
  maxTokens: number;
}) {
  return {
    id: input.id,
    name: input.name,
    reasoning: input.reasoning,
    input: input.input,
    cost: cost(),
    contextWindow: input.contextWindow,
    maxTokens: input.maxTokens,
  };
}

async function usable(token: string) {
  const json = await unary<{
    models?: Array<{
      modelId?: string;
      displayModelId?: string;
      displayName?: string;
      displayNameShort?: string;
      aliases?: string[];
      thinkingDetails?: unknown;
    }>;
  }>(`${BACK}/aiserver.v1.AiService/GetUsableModels`, token, { customModelIds: [] });

  return (json.models ?? [])
    .map((item) => {
      const id = String(item.modelId ?? "").trim();
      if (!id) return null;
      return model({
        id,
        name:
          String(item.displayNameShort ?? "").trim() ||
          String(item.displayName ?? "").trim() ||
          String(item.displayModelId ?? "").trim() ||
          id,
        reasoning: item.thinkingDetails != null,
        input: ["text", "image"],
        contextWindow: 200000,
        maxTokens: 16384,
      });
    })
    .filter((item): item is ReturnType<typeof model> => item != null);
}

async function available(token: string) {
  const json = await unary<{
    models?: Array<{
      name?: string;
      serverModelName?: string;
      clientDisplayName?: string;
      supportsThinking?: boolean;
      supportsImages?: boolean;
      contextTokenLimit?: number;
    }>;
  }>(`${BACK}/aiserver.v1.AiService/AvailableModels`, token, {
    isNightly: false,
    includeLongContextModels: true,
    excludeMaxNamedModels: false,
    additionalModelNames: [],
    includeHiddenModels: false,
    forAutomations: true,
  });

  return (json.models ?? [])
    .map((item) => {
      const id = String(item.serverModelName ?? item.name ?? "").trim();
      if (!id) return null;
      return model({
        id,
        name: String(item.clientDisplayName ?? item.name ?? id).trim() || id,
        reasoning: item.supportsThinking === true,
        input: item.supportsImages === true ? ["text", "image"] : ["text"],
        contextWindow:
          typeof item.contextTokenLimit === "number" && item.contextTokenLimit > 0
            ? item.contextTokenLimit
            : 200000,
        maxTokens: 16384,
      });
    })
    .filter((item): item is ReturnType<typeof model> => item != null);
}

export async function listCursorModels(token?: string | null) {
  const key = typeof token === "string" ? token.trim() : "";
  if (!key) return FALLBACK.map((item) => model({ ...item, input: [...item.input] }));
  try {
    const items = await usable(key);
    if (items.length) return items;
  } catch {}
  try {
    const items = await available(key);
    if (items.length) return items;
  } catch {}
  return FALLBACK.map((item) => model({ ...item, input: [...item.input] }));
}

export function createCursorProvider(models?: Array<ReturnType<typeof model>>): ProviderInput {
  return {
    baseUrl: BACK,
    api: API,
    models: (models ?? FALLBACK.map((item) => model({ ...item, input: [...item.input] }))).map(
      (item) => ({
        id: item.id,
        name: item.name,
        reasoning: item.reasoning,
        input: item.input,
        cost: item.cost,
        contextWindow: item.contextWindow,
        maxTokens: item.maxTokens,
      }),
    ),
    oauth: {
      name: "Cursor",
      login: loginCursor,
      refreshToken: refreshCursor,
      getApiKey: (cred: OAuthCredentials) => cred.access,
    },
    streamSimple: streamCursor,
  };
}

export function registerCursorProvider(
  reg: ModelRegistry,
  models?: Array<ReturnType<typeof model>>,
) {
  reg.registerProvider(CURSOR, createCursorProvider(models));
}

export async function syncCursorProvider(reg: ModelRegistry, token?: string | null) {
  registerCursorProvider(reg, await listCursorModels(token));
}

export const cursorExtension: ExtensionFactory = function (pi: ExtensionAPI) {
  pi.registerProvider(CURSOR, createCursorProvider());
};
