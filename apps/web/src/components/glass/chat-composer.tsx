import type {
  GlassSkill,
  GlassPromptInput,
  GlassPromptPathAttachment,
  HarnessDescriptor,
  HarnessKind,
  HarnessModelRef,
  GlassSlashCommand,
  ThinkingLevel,
  ShellFileHit,
  ShellFilePreview,
} from "@glass/contracts";
import type { RuntimeModelItem } from "../../lib/runtime-models";
import {
  IconArrowUp,
  IconBranchSimple,
  IconBulletList,
  IconChevronLeft,
  IconChevronRight,
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
import { flushSync } from "react-dom";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useNavigate } from "@tanstack/react-router";
import { readNativeApi } from "../../native-api";
import { useRuntimeModels } from "../../hooks/use-runtime-models";
import { fireGlassHeroFx } from "../../lib/glass-hero-fx-store";
import { useShellState } from "../../hooks/use-shell-cwd";
import type { GlassDraftFile, GlassDraftSkill } from "../../lib/glass-chat-draft-store";
import { useThreadSessionStore } from "../../lib/thread-session-store";
import {
  glassComposerAttachmentChip,
  glassComposerAttachmentStrip,
  glassComposerImageGrid,
  glassComposerImageThumbnail,
} from "../../lib/glass-attachment-styles";
import { cn } from "../../lib/utils";
import { useGlassSettings } from "./settings-context";
import { useStore } from "../../store";
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
import {
  buildSlashMenuRows,
  mergeSlashItems,
  type GlassSlashItem,
  type SlashMenuRow,
} from "./slash-registry";
import { readSlashRecents, recordSlashUse } from "./slash-recents";
import { GlassComposerTokenMenu } from "./slash-menu";
import { GlassModelPicker, type GlassModelPickerHandle } from "./model-picker";
import { applySkill, expandSkills, hydrateSkills, sameSkills, shiftSkills } from "./skill-tokens";
import { GlassWorkspacePicker } from "./workspace-picker";

type Pick = GlassDraftFile;

type Cmd = Omit<GlassSlashCommand, "source"> & {
  id?: string;
  source: GlassSlashCommand["source"] | "app";
};

const defaultCaps = {
  modelPicker: true,
  thinkingLevels: true,
  commands: true,
  interactive: true,
  fileAttachments: true,
} as const;

interface Props {
  variant: "hero" | "dock";
  sessionId?: string | null;
  draft: string;
  files?: Pick[];
  skills?: GlassDraftSkill[];
  onFiles?: (files: Pick[]) => void;
  onSkills?: (skills: GlassDraftSkill[]) => void;
  onDraft: (value: string) => void;
  onSend: (
    input: GlassPromptInput,
  ) => Promise<{ clear: boolean } | false> | { clear: boolean } | false;
  onAbort: () => void;
  onModel: (model: RuntimeModelItem) => void;
  onThinkingLevel: (level: ThinkingLevel) => void;
  model: HarnessModelRef | null;
  modelLoading?: boolean;
  busy: boolean;
  harness?: HarnessKind;
  harnessDescriptor?: HarnessDescriptor | null;
  onPlanMode?: () => void;
  /** Dock thread: show plan chip and allow turning plan mode off from the composer. */
  planActive?: boolean;
  onPlanToggle?: () => void;
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

function shot(text: string, files: Pick[]) {
  const line = text
    .split("\n")
    .map((item) => item.trim())
    .find(Boolean);
  if (line) return line;
  return files[0]?.name ?? "";
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

type LightboxItem = { id: string; src: string; alt: string };

/** Image lightbox — fullscreen gallery overlay (`ui-prompt-input-image-preview__fullscreen-content` ref).
 *  Built on Base UI `Dialog` (Portal → Backdrop + Viewport → Popup). The Viewport has
 *  `pointer-events-none` so clicks on the dim area pass through to the Backdrop and dismiss the dialog,
 *  while the Popup carries `pointer-events-auto` so the image and controls stay interactive. The portal
 *  also escapes the composer shell's `backdrop-filter` containing block, which would otherwise anchor
 *  `position: fixed` descendants to the composer instead of the viewport. Same gallery pattern as
 *  `Root + GridItem + Portal + Backdrop + Popup` with shared `activeIndex`. */
function ImageLightbox(props: {
  gallery: LightboxItem[];
  index: number | null;
  onIndexChange: (next: number) => void;
  onClose: () => void;
}) {
  const { gallery, index, onIndexChange, onClose } = props;
  const total = gallery.length;
  const open = index !== null && index >= 0 && index < total;
  const current = open ? gallery[index] : null;

  const goPrev = () => {
    if (index === null || total < 2) return;
    onIndexChange((index - 1 + total) % total);
  };
  const goNext = () => {
    if (index === null || total < 2) return;
    onIndexChange((index + 1) % total);
  };

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
        <DialogPrimitive.Viewport className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
          <DialogPrimitive.Popup
            aria-label="Image preview"
            className="pointer-events-auto relative flex max-h-full max-w-full items-center justify-center outline-none transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0"
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                goPrev();
              } else if (event.key === "ArrowRight") {
                event.preventDefault();
                goNext();
              }
            }}
          >
            {current ? (
              <img
                key={current.id}
                alt={current.alt}
                src={current.src}
                className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
              />
            ) : null}
          </DialogPrimitive.Popup>

          <DialogPrimitive.Close
            aria-label="Close preview"
            className="pointer-events-auto absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/15 text-white/90 transition-colors hover:bg-white/25"
          >
            <IconCrossSmall className="size-4" />
          </DialogPrimitive.Close>

          {total > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous image"
                className="pointer-events-auto absolute left-4 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white/90 transition-colors hover:bg-white/25"
                onClick={goPrev}
              >
                <IconChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next image"
                className="pointer-events-auto absolute right-4 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white/90 transition-colors hover:bg-white/25"
                onClick={goNext}
              >
                <IconChevronRight className="size-5" />
              </button>
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-detail text-white/90 backdrop-blur-sm">
                {(index ?? 0) + 1} / {total}
              </div>
            </>
          ) : null}
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Image thumbnail — `ui-prompt-input-image-preview` reference (64×64 grid cell).
 *  Acts as a `GridItem` trigger: clicking opens the shared gallery lightbox owned by `AttachmentStrip`. */
const ImageChip = memo(function ImageChip(props: {
  item: Pick;
  onRemove: () => void;
  onOpen: () => void;
  hasPreview: boolean;
}) {
  const Glyph = icon(props.item);
  const src = attachmentPreviewUrl(props.item);

  return (
    <div className="group relative inline-flex shrink-0" title={props.item.name}>
      <button
        type="button"
        className={cn(glassComposerImageThumbnail, props.hasPreview && "cursor-pointer")}
        onClick={() => {
          if (props.hasPreview) props.onOpen();
        }}
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

/** Attachment strip — separates images (grid) from file chips (`ui-prompt-input-image-grid` + `prompt-attachment`).
 *  Owns the shared lightbox state so all image chips open the same gallery and the user can cycle through them. */
const AttachmentStrip = memo(function AttachmentStrip(props: {
  files: Pick[];
  onRemove: (id: string) => void;
}) {
  const images = props.files.filter(attachmentIsImage);
  const docs = props.files.filter((f) => !attachmentIsImage(f));
  const gallery = useMemo<LightboxItem[]>(
    () =>
      images.flatMap((item) => {
        const src = attachmentPreviewUrl(item);
        return src ? [{ id: item.id, src, alt: item.name }] : [];
      }),
    [images],
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const openIndex = openId ? gallery.findIndex((entry) => entry.id === openId) : -1;
  const previewIds = useMemo(() => new Set(gallery.map((entry) => entry.id)), [gallery]);

  // If the open image was removed (or its preview disappeared), close the lightbox.
  useEffect(() => {
    if (openId && openIndex < 0) setOpenId(null);
  }, [openId, openIndex]);

  return (
    <div className={cn(glassComposerAttachmentStrip, "px-3 pt-3 pb-2")}>
      {images.length > 0 ? (
        <div className={glassComposerImageGrid}>
          {images.map((item) => (
            <ImageChip
              key={item.id}
              item={item}
              hasPreview={previewIds.has(item.id)}
              onRemove={() => props.onRemove(item.id)}
              onOpen={() => setOpenId(item.id)}
            />
          ))}
        </div>
      ) : null}
      {docs.map((item) => (
        <FileChip key={item.id} item={item} onRemove={() => props.onRemove(item.id)} />
      ))}
      {gallery.length > 0 ? (
        <ImageLightbox
          gallery={gallery}
          index={openIndex >= 0 ? openIndex : null}
          onIndexChange={(next) => setOpenId(gallery[next]?.id ?? null)}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  );
});

const GlassChatComposerImpl = memo(
  forwardRef<GlassChatComposerHandle, Props>(function GlassChatComposer(props, ref) {
    const api = readNativeApi();
    const navigate = useNavigate();
    const settings = useGlassSettings();
    const shell = useShellState();
    const models = useRuntimeModels(props.model);
    const snap = useThreadSessionStore(
      useMemo(
        () => (state) => (props.sessionId ? state.snaps[props.sessionId] : undefined),
        [props.sessionId],
      ),
    );
    const metaBranch = useStore(
      useMemo(
        () => (state) =>
          props.sessionId
            ? (state.threads.find((item) => item.id === props.sessionId)?.branch ?? null)
            : null,
        [props.sessionId],
      ),
    );
    const area = useRef<HTMLTextAreaElement | null>(null);
    const modelPickerRef = useRef<GlassModelPickerHandle | null>(null);
    const shellRef = useRef<HTMLDivElement | null>(null);
    const nextCursor = useRef<number | null>(null);
    const draftSink = useRef(props.onDraft);
    draftSink.current = props.onDraft;
    const draftRef = useRef(props.draft);
    draftRef.current = props.draft;
    const [cursor, setCursor] = useState(0);
    const [composing, setComposing] = useState(false);
    const [localFiles, setLocalFiles] = useState<Pick[]>([]);
    const [localSkills, setLocalSkills] = useState<GlassDraftSkill[]>([]);
    const [defs, setDefs] = useState<GlassSkill[]>([]);
    const [skillReady, setSkillReady] = useState(false);
    const [drag, setDrag] = useState(false);
    const [hits, setHits] = useState<ShellFileHit[]>([]);
    const [preview, setPreview] = useState<ShellFilePreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [closed, setClosed] = useState<string | null>(null);
    const [git, setGit] = useState<string | null>(null);
    const files = props.files ?? localFiles;
    const marks = props.skills ?? localSkills;
    const skillSink = useRef<(skills: GlassDraftSkill[]) => void>(() => undefined);
    const marksRef = useRef(marks);
    marksRef.current = marks;
    const empty = !props.draft.trim() && files.length === 0;
    const caps = props.harnessDescriptor?.capabilities ?? defaultCaps;
    const branch = metaBranch ?? git;

    const writeFiles = (next: Pick[] | ((cur: Pick[]) => Pick[])) => {
      const value = typeof next === "function" ? next(files) : next;
      if (props.onFiles) {
        props.onFiles(value);
        return;
      }
      setLocalFiles(value);
    };

    const writeSkills = (
      next: GlassDraftSkill[] | ((cur: GlassDraftSkill[]) => GlassDraftSkill[]),
    ) => {
      const value = typeof next === "function" ? next(marks) : next;
      if (props.onSkills) {
        props.onSkills(value);
        return;
      }
      setLocalSkills(value);
    };
    skillSink.current = writeSkills;

    useEffect(() => {
      if (props.onFiles) return;
      setLocalFiles([]);
    }, [props.onFiles, props.sessionId]);

    useEffect(() => {
      if (props.onSkills) return;
      setLocalSkills([]);
    }, [props.onSkills, props.sessionId]);

    useEffect(() => {
      const cwd = shell.cwd;
      if (props.variant !== "hero" || !api || !cwd) {
        setGit(null);
        return;
      }
      return api.git.onStatus({ cwd }, (next) => {
        setGit(next.isRepo ? next.branch : null);
      });
    }, [api, props.variant, shell.cwd]);

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
              ...(caps.modelPicker
                ? [{ name: "model", description: "Choose model", source: "app" as const }]
                : []),
              { name: "plan", description: "Switch to plan mode", source: "app" as const },
            ]
          : []) satisfies Cmd[],
      [caps.commands, caps.modelPicker],
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

    const slash = useMemo(
      () => (caps.commands ? slashMatch(props.draft, cursor) : null),
      [caps.commands, props.draft, cursor],
    );
    const at = useMemo(
      () => (caps.fileAttachments ? fileMatch(props.draft, cursor) : null),
      [caps.fileAttachments, props.draft, cursor],
    );
    const key = at ? `file:${at.token}` : slash ? `slash:${slash.query}` : null;
    const slashOpen = slash !== null;
    const [recSnap, setRecSnap] = useState(readSlashRecents);
    const remote = useMemo(
      () =>
        defs.map(
          (item): Cmd => ({
            id: item.id,
            name: item.name,
            description: item.description ?? "",
            source: "skill",
          }),
        ),
      [defs],
    );
    const items = useMemo(() => mergeSlashItems(locals, remote), [locals, remote]);
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
    const slashMarks = useMemo(
      () => [
        ...marks.map((item) => ({ start: item.start, end: item.end })),
        ...(slash ? [{ start: slash.start, end: slash.end }] : []),
      ],
      [marks, slash],
    );
    const segs = useMemo(
      () => mirrorSegmentsDraft(props.draft, slashMarks),
      [props.draft, slashMarks],
    );
    const activeSeg = useMemo(
      () => mirrorActiveSeg(segs, cursor, slash, at),
      [segs, cursor, slash, at],
    );

    useEffect(() => {
      if (!api) return;
      let off = false;
      void api.server
        .listSkills()
        .then((next) => {
          if (off) return;
          setDefs(next);
          setSkillReady(true);
        })
        .catch(() => undefined);
      return () => {
        off = true;
      };
    }, [api]);

    useEffect(() => {
      if (!api || !slashOpen) return;
      let off = false;
      void api.server
        .listSkills()
        .then((next) => {
          if (off) return;
          setDefs(next);
          setSkillReady(true);
        })
        .catch(() => undefined);
      return () => {
        off = true;
      };
    }, [api, slashOpen]);

    useEffect(() => {
      if (!skillReady) return;
      const next = hydrateSkills(props.draft, marks, defs);
      if (sameSkills(next, marks)) return;
      skillSink.current(next);
    }, [defs, marks, props.draft, skillReady]);

    useEffect(() => {
      if (!key) {
        setClosed(null);
      }
    }, [key]);

    useEffect(() => {
      if (!api || !at || !shell.cwd) {
        setHits([]);
        setPreview(null);
        setLoading(false);
        return;
      }
      let off = false;
      setLoading(true);
      void api.projects
        .searchEntries({ cwd: shell.cwd, query: at.query || ".", limit: 50 })
        .then((result) => {
          if (off) return;
          setHits(
            result.entries.map((item) => ({
              path: item.path,
              name: item.path.split("/").at(-1) ?? item.path,
              kind:
                item.kind === "directory"
                  ? "dir"
                  : item.path.match(/\.(png|jpe?g|gif|webp|bmp|svg)$/i)
                    ? "image"
                    : "file",
            })),
          );
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
    }, [api, at, shell.cwd]);

    const open =
      key !== null &&
      key !== closed &&
      (at ? rankedHits.length > 0 || loading : Boolean(slash && options.length > 0));
    const [index, setIndex] = useState(0);

    useEffect(() => {
      const set = (event: Event) => {
        const next = (event as CustomEvent<string>).detail;
        if (typeof next !== "string") return;
        skillSink.current(shiftSkills(draftRef.current, next, marksRef.current));
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
      const bridge = window.desktopBridge as
        | (typeof window.desktopBridge & { setComposerDraft?: (text: string) => void })
        | undefined;
      bridge?.setComposerDraft?.(props.draft);
    }, [props.draft]);

    useEffect(() => {
      setIndex(0);
    }, [at?.token, slash?.query]);

    const filePick = at ? (rankedHits[index] ?? rankedHits[0] ?? null) : null;
    const cmdPick = !at && options[index] ? options[index].item : null;

    useEffect(() => {
      setPreview(null);
    }, [at, filePick]);

    const update = (value: string, pos?: number, nextSkills?: GlassDraftSkill[]) => {
      nextCursor.current = pos ?? value.length;
      writeSkills(nextSkills ?? shiftSkills(props.draft, value, marks));
      props.onDraft(value);
    };

    const spot = () => area.current?.selectionStart ?? cursor;

    const runNow = (item: GlassSlashItem) => {
      if (files.length > 0) return false;
      const hit = slashMatch(props.draft, spot());
      if (!hit) return false;
      const t = item.run.type;
      if (t === "insert") return false;
      recordSlashUse(item.id, item.kind);
      setRecSnap(readSlashRecents());
      const cleared = `${props.draft.slice(0, hit.start)}${props.draft.slice(hit.end)}`;
      flushSync(() => update(cleared, hit.start));
      writeFiles([]);
      if (t === "navigate" && item.run.value) {
        void navigate({ to: item.run.value });
        return true;
      }
      if (t === "new-chat") {
        void navigate({ to: "/" });
        return true;
      }
      if (t === "open-settings") {
        settings.openSettings();
        return true;
      }
      if (t === "open-model-picker") {
        if (!caps.modelPicker) return false;
        queueMicrotask(() => modelPickerRef.current?.open());
        return true;
      }
      if (t === "plan-mode") {
        props.onPlanMode?.();
        return true;
      }
      return false;
    };

    const choose = () => {
      if (at && filePick) {
        const hit = fileMatch(props.draft, spot());
        if (!hit) return;
        const next = applyFile(props.draft, hit, filePick);
        setClosed(null);
        update(next.value, next.cursor);
        return;
      }
      if (slash && cmdPick) {
        const hit = slashMatch(props.draft, spot());
        if (!hit) return;
        if (runNow(cmdPick)) return;
        recordSlashUse(cmdPick.id, cmdPick.kind);
        setRecSnap(readSlashRecents());
        setClosed(null);
        if (cmdPick.kind === "skill") {
          const next = applySkill(props.draft, hit, { id: cmdPick.id, name: cmdPick.name }, marks);
          update(next.value, next.cursor, next.skills);
          return;
        }
        const next = applySlash(props.draft, hit, cmdPick.name);
        update(next.value, next.cursor);
      }
    };

    const submit = async () => {
      const raw = props.draft.trim();
      if (!files.length && raw === "/new") {
        props.onDraft("");
        writeFiles([]);
        writeSkills([]);
        void navigate({ to: "/" });
        return;
      }
      if (!files.length && raw === "/settings") {
        props.onDraft("");
        writeFiles([]);
        writeSkills([]);
        settings.openSettings();
        return;
      }
      if (!files.length && raw === "/model" && caps.modelPicker) {
        props.onDraft("");
        writeFiles([]);
        writeSkills([]);
        queueMicrotask(() => modelPickerRef.current?.open());
        return;
      }
      if (!files.length && raw === "/plan") {
        props.onDraft("");
        writeFiles([]);
        writeSkills([]);
        props.onPlanMode?.();
        return;
      }
      if (!raw && files.length === 0) return;
      if (props.variant === "hero") {
        const text = shot(props.draft, files);
        if (text) fireGlassHeroFx(text);
      }
      let text = props.draft;
      if (marks.length > 0 && api) {
        const next = await api.server.listSkills().catch(() => null);
        if (next) {
          setDefs(next);
          setSkillReady(true);
          text = expandSkills(props.draft, marks, next);
        }
      }
      const res = await props.onSend({
        text,
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
      if (res === false) return;
      setHits([]);
      setPreview(null);
      setClosed(null);
      if (!res.clear) return;
      writeFiles([]);
      writeSkills([]);
      props.onDraft("");
    };

    const pickFiles = () => {
      if (props.busy) return;
      const node = document.createElement("input");
      node.type = "file";
      node.accept = "image/*";
      node.multiple = true;
      node.addEventListener("change", () => {
        const files = Array.from(node.files ?? []);
        void Promise.all(files.map((item) => load(item))).then((items) => {
          writeFiles((cur) =>
            merge(
              cur,
              items.filter((item): item is Pick => Boolean(item)),
            ),
          );
        });
      });
      node.click();
    };

    const drop = async (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDrag(false);
      const list = Array.from(event.dataTransfer.files ?? []);

      if (list.length === 0) return;

      const imgs = (await Promise.all(list.map((item) => load(item)))).filter(
        (item): item is Pick => Boolean(item),
      );
      if (imgs.length > 0) {
        writeFiles((cur) => merge(cur, imgs));
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
          writeFiles((cur) =>
            merge(
              cur,
              items.filter((item): item is Pick => Boolean(item)),
            ),
          );
        });
        return;
      }

      return;
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
          const hit = slashMatch(props.draft, spot());
          if (!hit) return;
          if (runNow(item)) return;
          recordSlashUse(item.id, item.kind);
          setRecSnap(readSlashRecents());
          setClosed(null);
          if (item.kind === "skill") {
            const next = applySkill(props.draft, hit, { id: item.id, name: item.name }, marks);
            update(next.value, next.cursor, next.skills);
            return;
          }
          const next = applySlash(props.draft, hit, item.name);
          update(next.value, next.cursor);
        }}
        hits={rankedHits}
        fileActive={index}
        onFileHover={setIndex}
        onFilePick={(hit) => {
          const file = fileMatch(props.draft, spot());
          if (!file) return;
          const next = applyFile(props.draft, file, hit);
          setClosed(null);
          update(next.value, next.cursor);
        }}
        filePick={filePick}
        preview={preview}
        loading={loading}
      />
    );

    const placeholderText =
      caps.commands && caps.fileAttachments
        ? props.variant === "hero"
          ? "Plan, Build, / for commands, @ for context"
          : "Message… use / for commands, @ for files"
        : caps.commands
          ? "Message… use / for commands"
          : caps.fileAttachments
            ? "Message… @ for files"
            : "Message…";

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
              {props.variant === "hero" ? (
                <div className="mb-2 flex w-full min-w-0 items-center justify-between gap-3 px-0.5">
                  <div className="min-w-0 flex-1">
                    <GlassWorkspacePicker variant="composer" />
                  </div>
                  {branch ? (
                    <div className="flex min-w-0 flex-1 justify-end">
                      <span
                        className="font-glass inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-glass-control px-2 py-0.5 text-detail text-muted-foreground/82"
                        title={branch}
                      >
                        <IconBranchSimple className="size-3.5 shrink-0 opacity-60" />
                        <span className="min-w-0 truncate">{branch}</span>
                      </span>
                    </div>
                  ) : null}
                </div>
              ) : null}
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
                    onRemove={(id) => writeFiles((cur) => cur.filter((f) => f.id !== id))}
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
                      const value = event.target.value;
                      writeSkills(shiftSkills(props.draft, value, marks));
                      props.onDraft(value);
                      setCursor(event.target.selectionStart ?? value.length);
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
                    placeholder={placeholderText}
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
                      void submit();
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
                        ref={modelPickerRef}
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
                    {props.variant === "dock" && props.planActive ? (
                      <button
                        type="button"
                        disabled={props.busy}
                        className={cn(
                          "font-glass glass-plan-mode-chip--on inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border pl-2 pr-1 text-body shadow-glass-card outline-none backdrop-blur-md transition-colors",
                          "hover:border-glass-stroke-strong hover:bg-glass-hover focus-visible:outline-none focus-visible:ring-0 disabled:pointer-events-none disabled:opacity-50",
                        )}
                        onClick={() => props.onPlanToggle?.()}
                        aria-pressed
                        aria-label="Turn off plan mode"
                        title="Turn off plan mode (⇧Tab)"
                      >
                        <IconBulletList className="size-3 shrink-0 opacity-90" />
                        <span className="max-w-[10rem] truncate">Plan</span>
                        <IconCrossSmall className="size-3 shrink-0 opacity-80" />
                      </button>
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
                      void submit();
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
    left.files === right.files &&
    left.busy === right.busy &&
    left.harness === right.harness &&
    left.harnessDescriptor?.kind === right.harnessDescriptor?.kind &&
    left.planActive === right.planActive &&
    same(left.model, right.model),
);

export const GlassChatComposer = GlassChatComposerImpl;
GlassChatComposer.displayName = "GlassChatComposer";

const demoModel: RuntimeModelItem = {
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
