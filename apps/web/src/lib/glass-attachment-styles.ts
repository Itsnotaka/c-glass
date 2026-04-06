/**
 * User attachment surfaces.
 * Chat transcript (sent message): bubble cards.
 * Composer (pending): Cursor `composer-image-thumbnail` + `prompt-attachment` (gap 4px), not chat bubbles.
 */

/** Human message thread — image tile (matches sent-message card weight). */
export const glassUserAttachmentImageCard =
  "w-full overflow-hidden rounded-2xl border border-glass-border/45 bg-glass-bubble/70 shadow-glass-card backdrop-blur-sm sm:w-52";

/** Human message thread — file row. */
export const glassUserAttachmentFileRow =
  "flex min-w-44 max-w-full items-start gap-2 rounded-2xl border border-glass-border/45 bg-glass-bubble/70 px-3 py-2 text-left shadow-glass-card backdrop-blur-sm sm:max-w-72";

/** Cursor `.prompt-attachment`: `display:flex; gap:4px` — thumbnails top-left, aligned with textarea `px-3`. */
export const glassComposerAttachmentStrip = "flex flex-wrap items-start justify-start gap-1";

/**
 * Composer pending image: small square, rounded, no border (reference: flush thumbnail).
 */
export const glassComposerImageThumbnail =
  "size-10 shrink-0 overflow-hidden rounded-lg transition-[box-shadow] duration-150 hover:shadow-[0_2px_8px_rgb(0_0_0_/_0.15)] dark:hover:shadow-[0_2px_8px_rgb(0_0_0_/_0.35)]";

/** Composer pending file chip — `rounded-glass-control` (6px), no border. */
export const glassComposerAttachmentChip =
  "flex min-w-0 max-w-full items-center gap-2 rounded-glass-control bg-glass-hover/18 px-2 py-2 shadow-glass-card";
