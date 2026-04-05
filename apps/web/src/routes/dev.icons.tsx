import { createFileRoute } from "@tanstack/react-router";

import { glassCentralIcons } from "../lib/glass-central-icon-inventory";

export const Route = createFileRoute("/dev/icons")({
  component: DevIconsPage,
});

function DevIconsPage() {
  return (
    <div className="min-h-dvh bg-background p-8 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2 border-b border-border pb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Glass central-icons inventory</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Icons imported from{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              @central-icons-react/round-outlined-radius-2-stroke-1.5
            </code>{" "}
            (workspace alias{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">central-icons</code>
            ). This is the UI the Electron desktop loads. Native window icons and bundled editor
            SVGs are not listed here — see{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              docs/desktop-glass-icon-inventory.md
            </code>
            .
          </p>
        </header>

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
  );
}
