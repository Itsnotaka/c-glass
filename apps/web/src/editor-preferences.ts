import { EDITORS, EditorId } from "@glass/contracts";
import { getLocalStorageItem, setLocalStorageItem } from "./hooks/use-local-storage";

const LAST_EDITOR_KEY = "glass:last-editor";

export function resolveAndPersistPreferredEditor(available: readonly EditorId[]) {
  const ids = new Set(available);
  const stored = getLocalStorageItem(LAST_EDITOR_KEY, EditorId);
  if (stored && ids.has(stored)) return stored;
  const next = EDITORS.find((item) => ids.has(item.id))?.id ?? null;
  if (next) setLocalStorageItem(LAST_EDITOR_KEY, next, EditorId);
  return next ?? null;
}
