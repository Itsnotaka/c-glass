/**
 * User attachment surfaces.
 * Chat transcript (sent message): bubble cards.
 * Composer (pending): Cursor `ui-prompt-input-image-grid` + `prompt-attachment`.
 */

/** Human message thread — image tile (matches sent-message card weight). */
export const glassUserAttachmentImageCard =
  "w-full overflow-hidden rounded-2xl border border-glass-border/45 bg-glass-bubble/70 shadow-glass-card backdrop-blur-sm sm:w-52";

/** Human message thread — file row. */
export const glassUserAttachmentFileRow =
  "flex min-w-44 max-w-full items-start gap-2 rounded-2xl border border-glass-border/45 bg-glass-bubble/70 px-3 py-2 text-left shadow-glass-card backdrop-blur-sm sm:max-w-72";

/**
 * Composer attachment strip — holds image grid + file chips.
 * Cursor: `prompt-attachment { display:flex; gap:4px }`.
 */
export const glassComposerAttachmentStrip = "flex flex-wrap items-start justify-start gap-1";

/**
 * Composer image grid — Cursor `ui-prompt-input-image-grid`.
 * Grid of thumbnails, wrapping.
 */
export const glassComposerImageGrid = "flex flex-wrap items-start gap-1";

/**
 * Composer image thumbnail — 48×48px (design-system 4px grid).
 * Cursor ref: `ui-prompt-input-image-preview` 64px, scaled to fit Glass tighter spacing.
 */
export const glassComposerImageThumbnail =
  "size-12 shrink-0 overflow-hidden rounded-glass-card border border-glass-border/30 bg-glass-hover/10 transition-[border-color,box-shadow] duration-150 hover:border-glass-stroke-strong/40 hover:shadow-[0_2px_8px_oklch(0_0_0_/_0.15)] dark:hover:shadow-[0_2px_8px_oklch(0_0_0_/_0.35)]";

/** Composer pending file chip — `rounded` (4px per design-system control). */
export const glassComposerAttachmentChip =
  "flex min-w-0 max-w-full items-center gap-2 rounded bg-glass-hover/18 px-2 py-1";
