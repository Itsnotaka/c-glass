import { EDITORS, EditorId } from "@glass/contracts";
import { getLocalStorageItem, setLocalStorageItem } from "./hooks/use-local-storage";

const LAST_EDITOR_KEY = "glass:last-editor";

export function resolveAndPersistPreferredEditor(available: readonly EditorId[]) {
  const ids = new Set(available);
  const stored = getLocalStorageItem(LAST_EDITOR_KEY, EditorId);
  const next =
    EDITORS.find((item) => item.id !== "file-manager" && ids.has(item.id))?.id ??
    EDITORS.find((item) => ids.has(item.id))?.id ??
    null;

  if (stored && ids.has(stored) && (stored !== "file-manager" || next === "file-manager")) {
    return stored;
  }
  if (next) setLocalStorageItem(LAST_EDITOR_KEY, next, EditorId);
  return next ?? null;
}
