import * as Schema from "effect/Schema";
import { useMemo } from "react";
import { EDITORS, EditorId } from "@glass/contracts";
import {
  getLocalStorageItem,
  setLocalStorageItem,
  useLocalStorage,
} from "./hooks/use-local-storage";

const LAST_EDITOR_KEY = "glass:last-editor";

function pick(list: readonly EditorId[]) {
  const ids = new Set(list);
  return (
    EDITORS.find((item) => item.id !== "file-manager" && ids.has(item.id))?.id ??
    EDITORS.find((item) => ids.has(item.id))?.id ??
    null
  );
}

export function usePreferredEditor(list: readonly EditorId[]) {
  const [last, setLast] = useLocalStorage<EditorId | null, EditorId | null>(
    LAST_EDITOR_KEY,
    null,
    Schema.NullOr(EditorId),
  );

  const cur = useMemo(() => {
    if (last && list.includes(last)) return last;
    return pick(list);
  }, [last, list]);

  return [cur, setLast] as const;
}

export function resolveAndPersistPreferredEditor(available: readonly EditorId[]) {
  const stored = getLocalStorageItem(LAST_EDITOR_KEY, EditorId);
  const next = pick(available);

  if (
    stored &&
    available.includes(stored) &&
    (stored !== "file-manager" || next === "file-manager")
  ) {
    return stored;
  }

  if (next) setLocalStorageItem(LAST_EDITOR_KEY, next, EditorId);
  return next ?? null;
}
