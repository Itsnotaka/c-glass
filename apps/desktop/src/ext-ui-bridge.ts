import * as Crypto from "node:crypto";

import { BrowserWindow } from "electron";
import type { ExtensionUIContext } from "@mariozechner/pi-coding-agent";

export const EXT_UI_REQUEST_CHANNEL = "glass:ext-ui.request";
export const EXT_UI_REPLY_CHANNEL = "glass:ext-ui.reply";
export const EXT_UI_NOTIFY_CHANNEL = "glass:ext-ui.notify";
export const EXT_UI_SET_EDITOR_CHANNEL = "glass:ext-ui.set-editor";
export const EXT_UI_COMPOSER_DRAFT_CHANNEL = "glass:ext-ui.composer-draft";

export type ExtUiReq =
  | {
      id: string;
      type: "select";
      title: string;
      options: string[];
      timeout?: number;
    }
  | {
      id: string;
      type: "confirm";
      title: string;
      message: string;
      timeout?: number;
    }
  | {
      id: string;
      type: "input";
      title: string;
      placeholder?: string;
      timeout?: number;
    }
  | {
      id: string;
      type: "editor";
      title: string;
      prefill?: string;
      timeout?: number;
    }
  | {
      id: string;
      type: "get-editor";
    };

export type ExtUiReply = {
  id: string;
  cancelled?: boolean;
  value?: string | boolean;
};

type ReqIn =
  | {
      type: "select";
      title: string;
      options: string[];
      timeout?: number;
    }
  | {
      type: "confirm";
      title: string;
      message: string;
      timeout?: number;
    }
  | {
      type: "input";
      title: string;
      placeholder?: string;
      timeout?: number;
    }
  | {
      type: "editor";
      title: string;
      prefill?: string;
      timeout?: number;
    }
  | {
      type: "get-editor";
    };

type Pending = {
  resolve: (value: ExtUiReply) => void;
  timer: ReturnType<typeof setTimeout> | null;
};

type SendData =
  | ExtUiReq
  | ExtUiReply
  | {
      message: string;
      type: "info" | "warning" | "error";
    }
  | {
      text: string;
    };

function send(channel: string, data: SendData) {
  const cur = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
  if (!cur || cur.isDestroyed()) return false;
  cur.webContents.send(channel, data);
  return true;
}

export class ExtUiBridge {
  private waits = new Map<string, Pending>();
  private draft = "";

  reply(data: ExtUiReply) {
    const item = this.waits.get(data.id);
    if (!item) return;
    if (item.timer) clearTimeout(item.timer);
    this.waits.delete(data.id);
    item.resolve(data);
  }

  notify(message: string, type: "info" | "warning" | "error" = "info") {
    send(EXT_UI_NOTIFY_CHANNEL, { message, type });
  }

  setComposerDraft(text: string) {
    this.draft = text;
  }

  setEditorText(text: string) {
    this.draft = text;
    send(EXT_UI_SET_EDITOR_CHANNEL, { text });
  }

  private req(input: ReqIn) {
    const cur = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null;
    if (!cur || cur.isDestroyed()) {
      return Promise.resolve({ id: "", cancelled: true } satisfies ExtUiReply);
    }

    const id = Crypto.randomUUID();
    return new Promise<ExtUiReply>((resolve) => {
      const timer =
        "timeout" in input && input.timeout
          ? setTimeout(() => {
              this.waits.delete(id);
              resolve({ id, cancelled: true });
            }, input.timeout)
          : null;
      timer?.unref?.();
      this.waits.set(id, { resolve, timer });
      const body = { ...input, id } as ExtUiReq;
      cur.webContents.send(EXT_UI_REQUEST_CHANNEL, body);
    });
  }

  context(): ExtensionUIContext {
    return {
      select: async (title, options, opts) => {
        const out = await this.req({
          type: "select",
          title,
          options,
          ...(opts?.timeout ? { timeout: opts.timeout } : {}),
        });
        return out.cancelled ? undefined : typeof out.value === "string" ? out.value : undefined;
      },
      confirm: async (title, message, opts) => {
        const out = await this.req({
          type: "confirm",
          title,
          message,
          ...(opts?.timeout ? { timeout: opts.timeout } : {}),
        });
        return out.cancelled ? false : out.value === true;
      },
      input: async (title, placeholder, opts) => {
        const out = await this.req({
          type: "input",
          title,
          ...(placeholder ? { placeholder } : {}),
          ...(opts?.timeout ? { timeout: opts.timeout } : {}),
        });
        return out.cancelled ? undefined : typeof out.value === "string" ? out.value : undefined;
      },
      notify: (message, type) => {
        this.notify(message, type);
      },
      onTerminalInput: () => () => {},
      setStatus() {},
      setWorkingMessage() {},
      setHiddenThinkingLabel() {},
      setWidget() {},
      setFooter() {},
      setHeader() {},
      setTitle() {},
      custom: async () => {
        throw new Error("Custom extension UI is not available in Glass");
      },
      pasteToEditor: (text) => {
        this.setEditorText(text);
      },
      setEditorText: (text) => {
        this.setEditorText(text);
      },
      getEditorText: () => this.draft,
      editor: async (title, prefill) => {
        const out = await this.req({
          type: "editor",
          title,
          ...(prefill ? { prefill } : {}),
        });
        return out.cancelled ? undefined : typeof out.value === "string" ? out.value : undefined;
      },
      setEditorComponent() {},
      get theme() {
        return {} as ExtensionUIContext["theme"];
      },
      getAllThemes() {
        return [];
      },
      getTheme() {
        return undefined;
      },
      setTheme() {
        return { success: false, error: "Theme switching is not available in Glass extension UI" };
      },
      getToolsExpanded() {
        return false;
      },
      setToolsExpanded() {},
    };
  }
}
