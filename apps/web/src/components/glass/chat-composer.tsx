import type {
  GlassPromptInput,
  GlassPromptPathAttachment,
  HarnessDescriptor,
  HarnessKind,
  HarnessModelRef,
  GlassSlashCommand,
  ThinkingLevel,
  ShellFileHit,
  ShellFilePreview,
  ShellPickedFile,
} from "@glass/contracts";
import type { PiModelItem } from "../../lib/runtime-models";
import {
  IconArrowUp,
  IconCrossSmall,
  IconFileBend,
  IconImages1,
  IconPlusLarge,
  IconStop,
} from "central-icons";
import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { readGlass, getGlass } from "../../host";
import { useRuntimeModels } from "../../hooks/use-runtime-models";
import { useThreadSessionStore } from "../../lib/thread-session-store";
import {
  glassComposerAttachmentChip,
  glassComposerAttachmentStrip,
  glassComposerImageGrid,
  glassComposerImageThumbnail,
} from "../../lib/glass-attachment-styles";
import { cn } from "../../lib/utils";
import { useGlassSettings } from "./settings-context";
import { GLASS_EDITOR_SET_EVENT } from "../../lib/glass-runtime-constants";
import { pushComposerDraft } from "../../lib/composer-draft-mirror";
import {
  applyFile,
  applySlash,
  fileMatch,
  mirrorActiveSeg,
  mirrorSegmentsDraft,
  rankFileHits,
  slashMatch,
  type MirrorSeg,
} from "./composer-search";
import { buildSlashMenuRows, mergeSlashItems, type SlashMenuRow } from "./slash-registry";
import { readSlashRecents, recordSlashUse } from "./slash-recents";
import { GlassComposerTokenMenu } from "./slash-menu";
import { GlassModelPicker } from "./model-picker";

type Pick =
  | {
      id: string;
      type: "path";
      name: string;
      path: string;
      kind: ShellPickedFile["kind"];
      size: number;
      mimeType: string | null;
      previewData?: string;
      previewMime?: string | null;
    }
  | {
      id: string;
      type: "inline";
      name: string;
      mimeType: string;
      data: string;
      size: number;
    };

type Cmd = Omit<GlassSlashCommand, "source"> & {
  source: GlassSlashCommand["source"] | "app";
};

const defaultCaps = {
  modelPicker: true,
  thinkingLevels: true,
  commands: true,
  extensions: true,
  interactive: true,
  fileAttachments: true,
} as const;

interface Props {
  variant: "hero" | "dock";
  sessionId?: string | null;
  draft: string;
  onDraft: (value: string) => void;
  onSend: (input: GlassPromptInput) => void;
  onAbort: () => void;
  onModel: (model: PiModelItem) => void;
  onThinkingLevel: (level: ThinkingLevel) => void;
  model: HarnessModelRef | null;
  modelLoading?: boolean;
  busy: boolean;
  harness?: HarnessKind;
  harnessDescriptor?: HarnessDescriptor | null;
}

export interface GlassChatComposerHandle {
  focus: () => void;
}

function same(left: HarnessModelRef | null, right: HarnessModelRef | null) {
  if (left === right) return true;
  if (!left || !right) return false;
  return (
    left.provider === right.provider &&
    left.id === right.id &&
    left.name === right.name &&
    left.reasoning === right.reasoning
  );
}

function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function icon(item: Pick) {
  if (item.type === "inline") return IconImages1;
  if (item.kind === "image") return IconImages1;
  return IconFileBend;
}

function path(input: Pick): GlassPromptPathAttachment | null {
  if (input.type !== "path") return null;
  return { type: "path", path: input.path, name: input.name };
}

function merge(cur: Pick[], next: Pick[]) {
  const seen = new Set(cur.filter((item) => item.type === "path").map((item) => item.path));
  const seenInline = new Set(cur.filter((item) => item.type === "inline").map((item) => item.name));
  return [
    ...cur,
    ...next.filter((item) =>
      item.type === "inline"
        ? !seenInline.has(item.name)
        : item.type !== "path" || !seen.has(item.path),
    ),
  ];
}

const imgExt = new Map([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
  ["bmp", "image/bmp"],
  ["svg", "image/svg+xml"],
]);

function local(file: ShellPickedFile) {
  return {
    id: `${file.path}:${file.size}`,
    type: "path" as const,
    name: file.name,
    path: file.path,
    kind: file.kind,
    size: file.size,
    mimeType: file.mimeType,
  };
}

function imageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  const name = file.name.toLowerCase();
  const cut = name.lastIndexOf(".");
  if (cut < 0) return false;
  return imgExt.has(name.slice(cut + 1));
}

function imageType(file: File) {
  if (file.type.startsWith("image/")) return file.type;
  const name = file.name.toLowerCase();
  const cut = name.lastIndexOf(".");
  if (cut < 0) return "image/png";
  return imgExt.get(name.slice(cut + 1)) ?? "image/png";
}

function parsePaths(raw: string) {
  const out = raw
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter((item) => item && !item.startsWith("#"))
    .map((item) => {
      if (
        (item.startsWith('"') && item.endsWith('"')) ||
        (item.startsWith("'") && item.endsWith("'"))
      ) {
        return item.slice(1, -1);
      }
      return item;
    });
  return [...new Set(out)];
}

function load(file: File) {
  return new Promise<Pick | null>((resolve) => {
    if (!imageFile(file)) {
      resolve(null);
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const raw = typeof reader.result === "string" ? reader.result : "";
      const cut = raw.indexOf(",");
      if (cut < 0) {
        resolve(null);
        return;
      }
      resolve({
        id: `${file.name}:${file.size}:${Date.now()}`,
        type: "inline",
        name: file.name || "Image",
        mimeType: imageType(file),
        data: raw.slice(cut + 1),
        size: file.size,
      });
    });
    reader.addEventListener("error", () => resolve(null));
    reader.readAsDataURL(file);
  });
}

function attachmentPreviewUrl(item: Pick): string | null {
  if (item.type === "inline") return `data:${item.mimeType};base64,${item.data}`;
  if (item.kind === "image" && item.previewData) {
    return `data:${item.previewMime ?? item.mimeType ?? "image/png"};base64,${item.previewData}`;
  }
  return null;
}

function attachmentIsImage(item: Pick) {
  return item.type === "inline" || item.kind === "image";
}

/** Image lightbox — fullscreen preview overlay (Cursor: `ui-prompt-input-image-preview__fullscreen-content`). */
function ImageLightbox(props: { src: string; alt: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={props.onClose}
      onKeyDown={(e) => e.key === "Escape" && props.onClose()}
      role="dialog"
      aria-label="Image preview"
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-white/15 text-white/90 transition-colors hover:bg-white/25"
        onClick={props.onClose}
        aria-label="Close preview"
      >
        <IconCrossSmall className="size-4" />
      </button>
      <img
        alt={props.alt}
        src={props.src}
        className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

/** Image thumbnail — Cursor `ui-prompt-input-image-preview` (64×64 grid cell). */
const ImageChip = memo(function ImageChip(props: { item: Pick; onRemove: () => void }) {
  const [lightbox, setLightbox] = useState(false);
  const Glyph = icon(props.item);
  const src = attachmentPreviewUrl(props.item);

  return (
    <>
      <div className="group relative inline-flex shrink-0" title={props.item.name}>
        <button
          type="button"
          className={cn(glassComposerImageThumbnail, "cursor-pointer")}
          onClick={() => src && setLightbox(true)}
          aria-label={`Preview ${props.item.name}`}
        >
          {src ? (
            <img alt={props.item.name} className="h-full w-full object-cover" src={src} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground/60">
              <Glyph className="size-5" />
            </div>
          )}
        </button>
        <button
          type="button"
          aria-label={`Remove ${props.item.name}`}
          className="absolute -right-1.5 -top-1.5 z-10 flex size-5 items-center justify-center rounded-full bg-black/50 text-white opacity-0 shadow-sm transition-[opacity,background-color] duration-100 hover:bg-black/65 group-hover:opacity-100 focus-visible:opacity-100"
          onClick={props.onRemove}
        >
          <IconCrossSmall className="size-3" />
        </button>
      </div>
      {lightbox && src ? (
        <ImageLightbox src={src} alt={props.item.name} onClose={() => setLightbox(false)} />
      ) : null}
    </>
  );
});

/** File attachment chip — non-image files. */
const FileChip = memo(function FileChip(props: { item: Pick; onRemove: () => void }) {
  const Glyph = icon(props.item);
  return (
    <div className={glassComposerAttachmentChip}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-glass-hover/24 text-muted-foreground/75">
        <Glyph className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium text-foreground/86">
          {props.item.name}
        </span>
        <span className="block truncate text-detail text-muted-foreground/72">
          {size(props.item.size)}
        </span>
      </span>
      <button
        type="button"
        aria-label={`Remove ${props.item.name}`}
        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/65 transition-colors hover:bg-glass-hover/50 hover:text-foreground"
        onClick={props.onRemove}
      >
        <IconCrossSmall className="size-3.5" />
      </button>
    </div>
  );
});

/** Attachment strip — separates images (grid) from file chips. Cursor: `ui-prompt-input-image-grid` + `prompt-attachment`. */
const AttachmentStrip = memo(function AttachmentStrip(props: {
  files: Pick[];
  onRemove: (id: string) => void;
}) {
  const images = props.files.filter(attachmentIsImage);
  const docs = props.files.filter((f) => !attachmentIsImage(f));

  return (
    <div className={cn(glassComposerAttachmentStrip, "px-3 pt-3 pb-2")}>
      {images.length > 0 ? (
        <div className={glassComposerImageGrid}>
          {images.map((item) => (
            <ImageChip key={item.id} item={item} onRemove={() => props.onRemove(item.id)} />
          ))}
        </div>
      ) : null}
      {docs.map((item) => (
        <FileChip key={item.id} item={item} onRemove={() => props.onRemove(item.id)} />
      ))}
    </div>
  );
});

const GlassChatComposerImpl = memo(
  forwardRef<GlassChatComposerHandle, Props>(function GlassChatComposer(props, ref) {
    const glass = readGlass();
    const navigate = useNavigate();
    const settings = useGlassSettings();
    const models = useRuntimeModels(props.model);
    const snap = useThreadSessionStore(
      useMemo(
        () => (state) => (props.sessionId ? state.snaps[props.sessionId] : undefined),
        [props.sessionId],
      ),
    );
    const putSnap = useThreadSessionStore((state) => state.putSnap);
    const refreshSums = useThreadSessionStore((state) => state.refreshSums);
    const area = useRef<HTMLTextAreaElement | null>(null);
    const shellRef = useRef<HTMLDivElement | null>(null);
    const nextCursor = useRef<number | null>(null);
    const draftSink = useRef(props.onDraft);
    draftSink.current = props.onDraft;
    const [cursor, setCursor] = useState(0);
    const [composing, setComposing] = useState(false);
    const [files, setFiles] = useState<Pick[]>([]);
    const [drag, setDrag] = useState(false);
    const [remote, setRemote] = useState<GlassSlashCommand[]>([]);
    const [hits, setHits] = useState<ShellFileHit[]>([]);
    const [preview, setPreview] = useState<ShellFilePreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [closed, setClosed] = useState<string | null>(null);
    const empty = !props.draft.trim() && files.length === 0;
    const caps = props.harnessDescriptor?.capabilities ?? defaultCaps;

    useImperativeHandle(ref, () => ({
      focus: () => {
        area.current?.focus();
      },
    }));

    const locals = useMemo(
      () =>
        (caps.commands
          ? [
              { name: "new", description: "Start a new chat", source: "app" as const },
              { name: "settings", description: "Open settings", source: "app" as const },
            ]
          : []) satisfies Cmd[],
      [caps.commands],
    );

    useEffect(() => {
      const pos = nextCursor.current;
      if (pos === null) return;
      nextCursor.current = null;
      const node = area.current;
      if (!node) return;
      window.requestAnimationFrame(() => {
        node.focus();
        node.setSelectionRange(pos, pos);
        setCursor(pos);
      });
    }, [props.draft]);

    useEffect(() => {
      if (!glass || !props.sessionId || !caps.commands) {
        setRemote([]);
        return;
      }
      let off = false;
      void getGlass()
        .session.commands(props.sessionId)
        .then((items) => {
          if (off) return;
          setRemote(items);
        })
        .catch(() => {
          if (off) return;
          setRemote([]);
        });
      return () => {
        off = true;
      };
    }, [glass, props.sessionId, caps.commands]);

    const slash = useMemo(
      () => (caps.commands ? slashMatch(props.draft, cursor) : null),
      [caps.commands, props.draft, cursor],
    );
    const at = useMemo(
      () => (caps.fileAttachments ? fileMatch(props.draft, cursor) : null),
      [caps.fileAttachments, props.draft, cursor],
    );
    const key = at ? `file:${at.token}` : slash ? `slash:${slash.query}` : null;
    const remotes = useMemo<Cmd[]>(
      () => remote.map((item) => ({ ...item, source: item.source })),
      [remote],
    );
    const [recSnap, setRecSnap] = useState(readSlashRecents);
    const items = useMemo(() => mergeSlashItems(locals, remotes), [locals, remotes]);
    const slashRows = useMemo(
      () => buildSlashMenuRows(items, slash?.query ?? "", recSnap),
      [items, slash?.query, recSnap],
    );
    const options = useMemo(
      () =>
        slashRows.flatMap((r): Extract<SlashMenuRow, { kind: "option" }>[] =>
          r.kind === "option" ? [r] : [],
        ),
      [slashRows],
    );
    const rankedHits = useMemo(() => rankFileHits(hits, at?.query ?? ""), [hits, at?.query]);
    const segs = useMemo(() => mirrorSegmentsDraft(props.draft), [props.draft]);
    const activeSeg = useMemo(
      () => mirrorActiveSeg(segs, cursor, slash, at),
      [segs, cursor, slash, at],
    );

    useEffect(() => {
      if (!key) {
        setClosed(null);
      }
    }, [key]);

    useEffect(() => {
      if (!glass || !at) {
        setHits([]);
        setPreview(null);
        setLoading(false);
        return;
      }
      let off = false;
      setLoading(true);
      void getGlass()
        .shell.suggestFiles(at.query)
        .then((items) => {
          if (off) return;
          setHits(items);
          setLoading(false);
        })
        .catch(() => {
          if (off) return;
          setHits([]);
          setLoading(false);
        });
      return () => {
        off = true;
      };
    }, [at, glass]);

    const open =
      key !== null &&
      key !== closed &&
      (at ? rankedHits.length > 0 || loading : Boolean(slash && options.length > 0));
    const [index, setIndex] = useState(0);

    useEffect(() => {
      const set = (event: Event) => {
        const next = (event as CustomEvent<string>).detail;
        if (typeof next !== "string") return;
        draftSink.current(next);
        nextCursor.current = next.length;
      };
      window.addEventListener(GLASS_EDITOR_SET_EVENT, set as EventListener);
      return () => {
        window.removeEventListener(GLASS_EDITOR_SET_EVENT, set as EventListener);
      };
    }, []);

    useEffect(() => {
      pushComposerDraft(props.draft);
      readGlass()?.desktop.setComposerDraft?.(props.draft);
    }, [props.draft]);

    useEffect(() => {
      setIndex(0);
    }, [at?.token, slash?.query]);

    const filePick = at ? (rankedHits[index] ?? rankedHits[0] ?? null) : null;
    const cmdPick = !at && options[index] ? options[index].item : null;

    useEffect(() => {
      if (!glass || !at || !filePick) {
        setPreview(null);
        return;
      }
      let off = false;
      void getGlass()
        .shell.previewFile(filePick.path)
        .then((item) => {
          if (off) return;
          setPreview(item);
        })
        .catch(() => {
          if (off) return;
          setPreview(null);
        });
      return () => {
        off = true;
      };
    }, [at, filePick, glass]);

    const update = (value: string, pos?: number) => {
      nextCursor.current = pos ?? value.length;
      props.onDraft(value);
    };

    const choose = () => {
      if (at && filePick) {
        const next = applyFile(props.draft, at, filePick);
        setClosed(null);
        update(next.value, next.cursor);
        return;
      }
      if (slash && cmdPick) {
        recordSlashUse(cmdPick.id, cmdPick.kind);
        setRecSnap(readSlashRecents());
        const next = applySlash(props.draft, slash, cmdPick.name);
        setClosed(null);
        update(next.value, next.cursor);
      }
    };

    const append = (rows: ShellPickedFile[]) => {
      if (rows.length === 0) return;
      setFiles((cur) =>
        merge(
          cur,
          rows.map((row) => local(row)),
        ),
      );
      if (!glass) return;

      const need = rows.filter((row) => row.kind === "image").map((row) => row.path);
      if (need.length === 0) return;

      void Promise.all(
        need.map(async (path) => {
          const out = await getGlass()
            .shell.previewFile(path)
            .catch(() => null);
          if (!out || out.kind !== "image" || !out.data) return null;
          return {
            path,
            data: out.data,
            mimeType: out.mimeType,
          };
        }),
      ).then((items) => {
        const map = new Map(
          items
            .filter(
              (
                item,
              ): item is {
                path: string;
                data: string;
                mimeType: string | null | undefined;
              } => Boolean(item),
            )
            .map((item) => [item.path, item]),
        );
        if (map.size === 0) return;

        setFiles((cur) =>
          cur.map((item) => {
            if (item.type !== "path") return item;
            const next = map.get(item.path);
            if (!next) return item;
            return {
              ...item,
              previewData: next.data,
              previewMime: next.mimeType ?? item.mimeType,
            };
          }),
        );
      });
    };

    const submit = () => {
      const raw = props.draft.trim();
      if (!files.length && raw === "/new") {
        props.onDraft("");
        setFiles([]);
        if (!glass) {
          void navigate({ to: "/" });
          return;
        }

        void glass.session
          .create()
          .then((next) => {
            putSnap(next);
            void refreshSums();
            void navigate({ to: "/$threadId", params: { threadId: next.id } });
          })
          .catch(() => {
            void navigate({ to: "/" });
          });
        return;
      }
      if (!files.length && raw === "/settings") {
        props.onDraft("");
        setFiles([]);
        settings.openSettings();
        return;
      }
      if (!raw && files.length === 0) return;
      props.onSend({
        text: props.draft,
        attachments: files
          .map((item) => {
            if (item.type === "inline") {
              return {
                type: "inline" as const,
                name: item.name,
                mimeType: item.mimeType,
                data: item.data,
              };
            }
            return path(item);
          })
          .filter((item): item is NonNullable<GlassPromptInput["attachments"]>[number] =>
            Boolean(item),
          ),
      });
      setFiles([]);
      props.onDraft("");
      setHits([]);
      setPreview(null);
      setClosed(null);
    };

    const pickFiles = () => {
      if (!glass || props.busy) return;
      void getGlass()
        .shell.pickFiles()
        .then((items) => {
          append(items);
        })
        .catch(() => {});
    };

    const drop = async (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDrag(false);
      const list = Array.from(event.dataTransfer.files ?? []);

      const paths = [
        ...list.flatMap((item) => {
          const path = (item as File & { path?: string }).path;
          return typeof path === "string" && path ? [path] : [];
        }),
        ...parsePaths(event.dataTransfer.getData("text/uri-list") || "").filter(
          (item) =>
            item.startsWith("file://") ||
            item.startsWith("/") ||
            item.startsWith("~/") ||
            item.startsWith("./") ||
            item.startsWith("../") ||
            /^[a-z]:[\\/]/i.test(item),
        ),
        ...parsePaths(event.dataTransfer.getData("text/plain") || "").filter(
          (item) =>
            item.startsWith("file://") ||
            item.startsWith("/") ||
            item.startsWith("~/") ||
            item.startsWith("./") ||
            item.startsWith("../") ||
            /^[a-z]:[\\/]/i.test(item),
        ),
      ];

      if (glass && paths.length > 0) {
        const hits = await getGlass()
          .shell.inspectFiles([...new Set(paths)])
          .catch(() => []);
        if (hits.length > 0) {
          append(hits);
          return;
        }
      }

      if (list.length === 0) return;

      const imgs = (await Promise.all(list.map((item) => load(item)))).filter(
        (item): item is Pick => Boolean(item),
      );
      if (imgs.length > 0) {
        setFiles((cur) => merge(cur, imgs));
      }
    };

    const paste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const list = Array.from(event.clipboardData.items ?? [])
        .flatMap((item) => {
          const file = item.kind === "file" ? item.getAsFile() : null;
          return file ? [file] : [];
        })
        .filter((item) => imageFile(item));
      if (list.length > 0) {
        event.preventDefault();
        void Promise.all(list.map((item) => load(item))).then((items) => {
          setFiles((cur) =>
            merge(
              cur,
              items.filter((item): item is Pick => Boolean(item)),
            ),
          );
        });
        return;
      }

      if (!glass) return;

      const raw = event.clipboardData.getData("text/plain") || "";
      const paths = parsePaths(raw).filter(
        (item) =>
          item.startsWith("file://") ||
          item.startsWith("/") ||
          item.startsWith("~/") ||
          item.startsWith("./") ||
          item.startsWith("../") ||
          /^[a-z]:[\\/]/i.test(item),
      );
      if (paths.length === 0) return;

      event.preventDefault();
      void getGlass()
        .shell.inspectFiles(paths)
        .then((items) => {
          if (items.length > 0) {
            append(items);
            return;
          }

          const node = event.currentTarget;
          const start = node.selectionStart ?? 0;
          const end = node.selectionEnd ?? start;
          const next = `${props.draft.slice(0, start)}${raw}${props.draft.slice(end)}`;
          update(next, start + raw.length);
        })
        .catch(() => {
          const node = event.currentTarget;
          const start = node.selectionStart ?? 0;
          const end = node.selectionEnd ?? start;
          const next = `${props.draft.slice(0, start)}${raw}${props.draft.slice(end)}`;
          update(next, start + raw.length);
        });
    };

    const menu = (
      <GlassComposerTokenMenu
        open={open}
        onOpenChange={(next) => {
          if (!next && key) setClosed(key);
        }}
        anchor={shellRef}
        variant={props.variant}
        mode={at ? "file" : "slash"}
        query={at ? at.query : (slash?.query ?? "")}
        slashRows={slashRows}
        slashActive={index}
        onSlashHover={setIndex}
        onSlashPick={(item) => {
          recordSlashUse(item.id, item.kind);
          setRecSnap(readSlashRecents());
          if (!slash) return;
          const next = applySlash(props.draft, slash, item.name);
          setClosed(null);
          update(next.value, next.cursor);
        }}
        hits={rankedHits}
        fileActive={index}
        onFileHover={setIndex}
        onFilePick={(hit) => {
          if (!at) return;
          const next = applyFile(props.draft, at, hit);
          setClosed(null);
          update(next.value, next.cursor);
        }}
        filePick={filePick}
        preview={preview}
        loading={loading}
      />
    );

    return (
      <div
        className={cn(
          props.variant === "hero"
            ? "w-full"
            : "relative isolate pb-2 before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:top-[-96px] before:bg-glass-chat before:mask-[linear-gradient(0deg,#000_0,rgba(0,0,0,0.86)_28%,rgba(0,0,0,0.56)_62%,rgba(0,0,0,0.22)_84%,transparent)]",
        )}
      >
        <div
          className={cn(props.variant === "hero" ? "w-full" : "shrink-0 px-4 pt-2 pb-4 md:px-6")}
        >
          <div className={cn(props.variant === "dock" ? "mx-auto w-full max-w-3xl" : "w-full")}>
            <div className="relative">
              {menu}
              <div
                ref={shellRef}
                data-dragging={drag || undefined}
                className={cn(
                  "overflow-hidden rounded-glass-card border border-glass-stroke-tertiary bg-glass-bubble shadow-glass-card backdrop-blur-[10px] transition-none focus-within:border-glass-stroke-strong",
                  drag && "border-glass-stroke-strong shadow-[0_0_0_2px_var(--glass-ring)]",
                )}
                onDragLeave={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = event.clientX;
                  const y = event.clientY;
                  if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
                    setDrag(false);
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!props.busy) setDrag(true);
                }}
                onDrop={(event) => {
                  if (props.busy) return;
                  void drop(event);
                }}
              >
                {files.length ? (
                  <AttachmentStrip
                    files={files}
                    onRemove={(id) => setFiles((cur) => cur.filter((f) => f.id !== id))}
                  />
                ) : null}
                <div className="relative min-h-10">
                  <div
                    className="glass-composer-mirror font-glass pointer-events-none absolute inset-0 z-0 px-3 pt-3 pb-1 text-body whitespace-pre-wrap break-words"
                    aria-hidden
                  >
                    {composing ? (
                      <span className="text-foreground">{props.draft}</span>
                    ) : (
                      segs.map((seg: MirrorSeg, idx: number) => {
                        const on = activeSeg === idx;
                        const cls =
                          seg.kind === "slash"
                            ? on
                              ? "text-primary"
                              : "text-primary/78"
                            : seg.kind === "mention"
                              ? on
                                ? "text-sky-400"
                                : "text-sky-400/82"
                              : "text-foreground";
                        return (
                          <span key={`${seg.kind}-${seg.start}-${seg.end}`} className={cls}>
                            {seg.text}
                          </span>
                        );
                      })
                    )}
                  </div>
                  <textarea
                    ref={area}
                    value={props.draft}
                    onChange={(event) => {
                      props.onDraft(event.target.value);
                      setCursor(event.target.selectionStart ?? event.target.value.length);
                    }}
                    onClick={(event) => setCursor(event.currentTarget.selectionStart ?? 0)}
                    onKeyUp={(event) => setCursor(event.currentTarget.selectionStart ?? 0)}
                    onSelect={(event) => setCursor(event.currentTarget.selectionStart ?? 0)}
                    onCompositionStart={() => setComposing(true)}
                    onCompositionEnd={() => setComposing(false)}
                    onPaste={paste}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (!props.busy && caps.fileAttachments) setDrag(true);
                    }}
                    onDrop={(event) => {
                      if (props.busy || !caps.fileAttachments) return;
                      void drop(event);
                    }}
                    placeholder={
                      caps.commands && caps.fileAttachments
                        ? "Message… use / for commands, @ for files"
                        : caps.commands
                          ? "Message… use / for commands"
                          : caps.fileAttachments
                            ? "Message… @ for files"
                            : "Message…"
                    }
                    rows={1}
                    className="field-sizing-content font-glass relative z-10 block min-h-10 max-h-56 w-full resize-none bg-transparent px-3 pt-3 pb-1 text-body text-transparent caret-foreground outline-hidden placeholder:text-muted-foreground selection:bg-primary/25"
                    onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
                      if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
                        event.preventDefault();
                        const dir = event.key === "ArrowDown" ? 1 : -1;
                        setIndex((cur) => {
                          const max = (at ? rankedHits.length : options.length) - 1;
                          if (max < 0) return 0;
                          const next = cur + dir;
                          if (next < 0) return max;
                          if (next > max) return 0;
                          return next;
                        });
                        return;
                      }
                      if (open && (event.key === "Tab" || event.key === "Enter")) {
                        event.preventDefault();
                        choose();
                        return;
                      }
                      if (open && event.key === "Escape") {
                        event.preventDefault();
                        if (key) setClosed(key);
                        return;
                      }
                      if (event.key !== "Enter" || event.shiftKey) return;
                      event.preventDefault();
                      if (props.busy) {
                        props.onAbort();
                        return;
                      }
                      submit();
                    }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2 px-2 pt-0 pb-1">
                  <div className="flex min-w-0 items-center gap-1">
                    {caps.fileAttachments ? (
                      <button
                        type="button"
                        disabled={props.busy}
                        onClick={pickFiles}
                        className="flex size-8 items-center justify-center rounded-glass-card text-muted-foreground/62 transition-colors hover:bg-glass-hover hover:text-foreground disabled:opacity-35"
                        aria-label="Add files"
                      >
                        <IconPlusLarge className="glass-composer-icon" />
                      </button>
                    ) : null}
                    {caps.modelPicker ? (
                      <GlassModelPicker
                        items={models.items}
                        status={props.modelLoading ? "loading" : models.status}
                        selection={
                          caps.thinkingLevels
                            ? {
                                model: props.model,
                                thinkingLevel: snap?.thinkingLevel ?? models.thinkingLevel,
                              }
                            : { model: props.model }
                        }
                        disabled={props.busy}
                        variant={props.variant}
                        onSelect={(model) => {
                          props.onModel(model);
                          area.current?.focus();
                        }}
                        {...(caps.thinkingLevels ? { onThinkingLevel: props.onThinkingLevel } : {})}
                      />
                    ) : null}
                  </div>
                  <button
                    type="button"
                    disabled={!props.busy && empty}
                    onClick={() => {
                      if (props.busy) {
                        props.onAbort();
                        return;
                      }
                      submit();
                    }}
                    className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
                    aria-label={props.busy ? "Stop" : "Send"}
                  >
                    {props.busy ? (
                      <IconStop className="glass-composer-icon" />
                    ) : (
                      <IconArrowUp className="glass-composer-icon" />
                    )}
                  </button>
                </div>
                {drag ? (
                  <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-glass-card bg-glass-active/15 backdrop-blur-[2px]">
                    <div className="rounded-glass-pill border border-glass-border/40 bg-glass-bubble px-3 py-2 text-body font-medium text-foreground/84 shadow-glass-card">
                      Drop files to attach
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }),
  (left: Props, right: Props) =>
    left.variant === right.variant &&
    left.sessionId === right.sessionId &&
    left.draft === right.draft &&
    left.busy === right.busy &&
    left.harness === right.harness &&
    left.harnessDescriptor?.kind === right.harnessDescriptor?.kind &&
    same(left.model, right.model),
);

export const GlassChatComposer = GlassChatComposerImpl;
GlassChatComposer.displayName = "GlassChatComposer";

const demoModel: PiModelItem = {
  key: "openai/gpt",
  provider: "openai",
  id: "gpt",
  name: "GPT",
  supportsXhigh: false,
  reasoning: false,
};

/** Dev `/dev/icons`: composer toolbar icons (same markup as `GlassChatComposer`). */
export function GlassComposerToolbarIconDemo() {
  return (
    <div className="flex w-full max-w-md items-center justify-between gap-2 rounded-glass-card border border-glass-border/45 bg-glass-bubble/55 px-2 py-1 shadow-glass-card">
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-glass-card text-muted-foreground/62 transition-colors hover:bg-glass-hover hover:text-foreground"
          aria-label="Add files"
        >
          <IconPlusLarge className="glass-composer-icon" />
        </button>
        <GlassModelPicker
          items={[demoModel]}
          status="ready"
          selection={{
            model: { provider: demoModel.provider, id: demoModel.id, name: demoModel.name },
          }}
          disabled={false}
          variant="hero"
          onSelect={() => {}}
        />
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-label="Stop"
        >
          <IconStop className="glass-composer-icon" />
        </button>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-label="Send"
        >
          <IconArrowUp className="glass-composer-icon" />
        </button>
      </div>
    </div>
  );
}

const demoPathPick: Pick = {
  id: "d1",
  type: "path",
  name: "demo.ts",
  path: "/a/demo.ts",
  kind: "file",
  size: 120,
  mimeType: "text/plain",
};

const demoInline: Pick = {
  id: "d2",
  type: "inline",
  name: "shot.png",
  mimeType: "image/png",
  data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  size: 100,
};

/** Dev `/dev/icons`: attachment chips (file + inline image). */
export function GlassComposerAttachmentChipDemo() {
  return (
    <div className="flex max-w-md flex-col gap-3">
      <AttachmentStrip files={[demoInline, demoPathPick]} onRemove={() => {}} />
    </div>
  );
}
