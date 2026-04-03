import { IconArrowLeft } from "central-icons";

import { Button } from "../ui/button";
import { useGlassShellView } from "./glass-shell-context";

export function GlassMarketplaceView() {
  const shell = useGlassShellView();

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-8 py-16">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-2 rounded-lg text-muted-foreground hover:bg-glass-hover hover:text-foreground"
        onClick={() => shell.setCenterMode("main")}
      >
        <IconArrowLeft className="size-4 opacity-80" />
        Back
      </Button>
      <div className="max-w-md text-center">
        <h2 className="text-[15px] font-medium tracking-tight text-foreground">Marketplace</h2>
        <p className="mt-3 text-sm/6 text-muted-foreground">
          Integrations and extensions will appear here. This is a placeholder for milestone one.
        </p>
      </div>
    </div>
  );
}
