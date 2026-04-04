/**
 * Upstream styling anchors for Glass slash / mention launchers (Cursor 3.x workbench).
 * Inspect `workbench.desktop.main.css` under Cursor.app `Contents/Resources/app/out/vs/workbench/`.
 *
 * | Cursor selector / token | Purpose |
 * |---|---|
 * | `.ui-slash-menu__content--glass` | Slash popup shell (Glass) |
 * | `.ui-mention-menu-side-preview--glass` | @ mention list + side preview |
 * | `--glass-chat-bubble-background` | Elevated surface fill |
 * | `--glass-window-border-color` | Hairline border |
 *
 * Ported values live in `apps/web/src/glass.css` (e.g. `.glass-slash-menu-popup`) and Tailwind
 * tokens `glass-bubble`, `glass-stroke`, `shadow-glass-popup`.
 */
export const GLASS_SLASH_CURSOR_REFS_VERSION = 1;
