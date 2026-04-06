import { createFileRoute } from "@tanstack/react-router";

import { GlassIconDemosPanel } from "~/components/dev/glass-icon-demos";

import { glassCentralIcons } from "../lib/glass-central-icon-inventory";

export const Route = createFileRoute("/dev/icons")({
  component: DevIconsPage,
});

function DevIconsPage() {
  return (
    <div className="box-border h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain bg-background text-foreground">
      <div className="mx-auto max-w-7xl space-y-10 px-8 py-8 pb-12">
        <header className="space-y-2 border-b border-border pb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Glass central-icons inventory</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Icons from{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              @central-icons-react/round-outlined-radius-2-stroke-1.5
            </code>{" "}
            (alias <code className="rounded bg-muted px-1 py-0.5 text-xs">central-icons</code>).
            Below are the real components from the web bundle Electron loads — each section title is
            the source file path. Native shell assets are listed in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              docs/desktop-glass-icon-inventory.md
            </code>
            .
          </p>
        </header>

        <GlassIconDemosPanel />

        <div>
          <h2 className="mb-3 text-sm font-medium text-foreground">
            Flat list (canonical inventory)
          </h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 font-medium">Preview</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Where it appears</th>
                </tr>
              </thead>
              <tbody>
                {glassCentralIcons.map((row) => (
                  <tr key={row.name} className="border-b border-border/80 last:border-0">
                    <td className="px-4 py-3 align-middle">
                      <row.Cmp className="size-8 text-foreground" aria-hidden />
                    </td>
                    <td className="px-4 py-3 align-middle font-mono text-xs">{row.name}</td>
                    <td className="px-4 py-3 align-middle text-muted-foreground">{row.usage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
