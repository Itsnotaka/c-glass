import type { FileDiffMetadata } from "@pierre/diffs";
import { parsePatchFiles } from "@pierre/diffs";
import { queryOptions } from "@tanstack/react-query";

import { readNativeApi } from "~/native-api";

export interface GitPatchData {
  patch: string;
  diff: FileDiffMetadata | null;
}

export const gitQueryKeys = {
  patch: (cwd: string, path: string) => ["git", "patch", cwd, path] as const,
};

function firstFile(patch: string): FileDiffMetadata | null {
  const text = patch.trim();
  if (text.length < 1) return null;

  try {
    const patches = parsePatchFiles(text);
    for (const patch of patches) {
      const file = patch.files[0];
      if (file) return file;
    }
  } catch {}

  return null;
}

export function gitPatchQueryOptions(input: {
  cwd: string | null;
  path: string;
  enabled?: boolean;
}) {
  return queryOptions({
    queryKey: gitQueryKeys.patch(input.cwd ?? "", input.path),
    queryFn: async () => {
      if (!input.cwd) throw new Error("No workspace");
      const api = readNativeApi();
      if (!api) throw new Error("Native API not found");
      const result = await api.git.getFilePatch({ cwd: input.cwd, path: input.path });
      return {
        patch: result.unifiedDiff,
        diff: firstFile(result.unifiedDiff),
      } satisfies GitPatchData;
    },
    enabled: (input.enabled ?? true) && Boolean(input.cwd),
    staleTime: Infinity,
  });
}
