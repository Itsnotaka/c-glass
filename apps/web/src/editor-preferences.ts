import * as Schema from "effect/Schema";
import { EDITORS, EditorId } from "@glass/contracts";
import { useLocalStorage } from "./hooks/use-local-storage";

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

  return [last && list.includes(last) ? last : pick(list), setLast] as const;
}
