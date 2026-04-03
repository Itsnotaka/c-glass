"use client";

import { useGlassProviderAuthStore } from "../../lib/glass-provider-auth-store";
import { GlassProviderKeyDialog } from "./glass-provider-key-dialog";

export function GlassProviderShellOverlay() {
  const req = useGlassProviderAuthStore((state) => state.req);
  const submit = useGlassProviderAuthStore((state) => state.submit);

  return (
    <GlassProviderKeyDialog
      open={req !== null}
      provider={req?.provider ?? ""}
      mode={req?.mode ?? "api_key"}
      oauthSupported={req?.oauthSupported}
      onSubmit={submit}
    />
  );
}
