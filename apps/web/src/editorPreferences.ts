import { EDITORS, EditorId } from "@glass/contracts";
import { useMemo } from "react";
import { getLocalStorageItem, setLocalStorageItem, useLocalStorage } from "./hooks/useLocalStorage";

const LAST_EDITOR_KEY = "glass:last-editor";

export function usePreferredEditor(available: readonly EditorId[]) {
  const [last, setLast] = useLocalStorage(LAST_EDITOR_KEY, null, EditorId);

  const cur = useMemo(() => {
    if (last && available.includes(last)) return last;
    return EDITORS.find((item) => available.includes(item.id))?.id ?? null;
  }, [available, last]);

  return [cur, setLast] as const;
}

export function resolveAndPersistPreferredEditor(available: readonly EditorId[]) {
  const ids = new Set(available);
  const stored = getLocalStorageItem(LAST_EDITOR_KEY, EditorId);
  if (stored && ids.has(stored)) return stored;
  const next = EDITORS.find((item) => ids.has(item.id))?.id ?? null;
  if (next) setLocalStorageItem(LAST_EDITOR_KEY, next, EditorId);
  return next ?? null;
}
