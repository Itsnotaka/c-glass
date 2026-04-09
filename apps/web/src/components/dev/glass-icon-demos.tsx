import type { GlassAskState } from "@glass/contracts";
import type { ShellFileHit } from "@glass/contracts";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import {
  Combobox,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
} from "~/components/ui/combobox";
import { Dialog, DialogHeader, DialogPopup, DialogTitle } from "~/components/ui/dialog";
import { GlassSelect } from "~/components/ui/select";
import { Sheet, SheetContent } from "~/components/ui/sheet";
import { SidebarTrigger } from "~/components/ui/sidebar";

import { GlassAgentList } from "~/components/glass/agent-list";
import { GlassAppShell, type GlassAppShellPanels } from "~/components/glass/app-shell";
import { GlassAskTool } from "~/components/glass/ask-tool";
import {
  GlassComposerAttachmentChipDemo,
  GlassComposerToolbarIconDemo,
} from "~/components/glass/chat-composer";
import { GlassComposerFilePreview } from "~/components/glass/composer-file-preview";
import { GlassCommandPalette } from "~/components/glass/command-palette";
import { GlassGitFileRow, GlassGitGroupHeader } from "~/components/glass/git-panel";
import { GlassWorkbenchLayout } from "~/components/glass/layout";
import { GlassOpenPicker } from "~/components/glass/open-picker";
import { GlassChatRowsIconStripDemo } from "~/components/glass/chat-rows";
import { GlassSettingsNavRail } from "~/components/glass/settings-nav-rail";
import { GlassSidebarFooter } from "~/components/glass/sidebar-footer";
import { GlassSidebarHeader } from "~/components/glass/sidebar-header";
import { GlassComposerTokenMenu } from "~/components/glass/slash-menu";
import { GlassUpdatePill } from "~/components/glass/update-pill";
import type { GlassSlashItem, SlashMenuRow } from "~/components/glass/slash-registry";
import { GlassModelPicker } from "~/components/glass/model-picker";
import {
  GlassCombobox,
  GlassComboboxItem,
  GlassComboboxList,
  GlassComboboxPopup,
  GlassComboboxSearchInput,
  GlassComboboxTrigger,
} from "~/components/glass/combobox";
import type { DiffRow } from "~/hooks/use-glass-git";
import type { GlassSidebarSection } from "~/lib/glass-view-model";
import type { RuntimeModelItem } from "~/lib/runtime-models";

function useDemoPanels(): GlassAppShellPanels {
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [leftW, setLeftW] = useState(220);
  const [rightW, setRightW] = useState(280);
  return useMemo(
    () => ({
      leftOpen,
      rightOpen,
      setLeftOpen,
      setRightOpen,
      leftW,
      rightW,
      toggleLeft: () => setLeftOpen((v) => !v),
      toggleRight: () => setRightOpen((v) => !v),
      setLeftWidth: setLeftW,
      setRightWidth: setRightW,
    }),
    [leftOpen, rightOpen, leftW, rightW],
  );
}

const gitRow: DiffRow = {
  id: "g1",
  path: "src/a.ts",
  prevPath: null,
  state: "modified",
  staged: true,
  unstaged: false,
  add: 2,
  del: 1,
};

const slashSkill: GlassSlashItem = {
  id: "demo-skill",
  kind: "skill",
  name: "skill",
  source: "runtime",
  pill: "skill",
  section: "skills",
  run: { type: "insert", value: "skill" },
};

const slashApp: GlassSlashItem = {
  id: "demo-app",
  kind: "app",
  name: "settings",
  source: "app",
  pill: "app",
  section: "app",
  run: { type: "open-settings" },
};

const slashSub: GlassSlashItem = {
  id: "demo-sub",
  kind: "subagent",
  name: "plan",
  source: "runtime",
  pill: "subagent",
  section: "subagents",
  run: { type: "insert", value: "plan" },
};

const slashRows: SlashMenuRow[] = [
  { kind: "header", key: "demo-h", label: "Demo" },
  { kind: "option", item: slashSkill, optionIndex: 0 },
  { kind: "option", item: slashApp, optionIndex: 1 },
  { kind: "option", item: slashSub, optionIndex: 2 },
];

const fileHits: ShellFileHit[] = [
  { path: "/proj/src", name: "src", kind: "dir" },
  { path: "/proj/shot.png", name: "shot.png", kind: "image" },
  { path: "/proj/readme.md", name: "readme.md", kind: "file" },
];

const reasoningModel: RuntimeModelItem = {
  key: "openai/o1",
  provider: "openai",
  id: "o1",
  name: "Reasoning",
  supportsXhigh: true,
  reasoning: true,
};

const askDemo: GlassAskState = {
  sessionId: "demo",
  toolCallId: "t1",
  kind: "select",
  questions: [
    {
      id: "q1",
      text: "Pick an option",
      options: [
        { id: "a", label: "Alpha", shortcut: "a" },
        { id: "b", label: "Beta", other: true },
      ],
      multi: true,
    },
  ],
  current: 1,
  values: {},
  custom: {},
};

const agentSections: GlassSidebarSection[] = [
  {
    id: "sec",
    label: "Today",
    cwd: "/",
    active: true,
    items: [
      {
        id: "missing-thread",
        kind: "draft",
        title: "Draft chat",
        state: "draft",
        unread: false,
        updatedAt: new Date().toISOString(),
        ago: "now",
        cwd: "/",
      },
    ],
  },
];

function DemoSection(props: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-xl border border-border bg-card/30 p-4">
      <div>
        <h2 className="font-mono text-sm font-medium text-foreground">{props.title}</h2>
        {props.hint ? <p className="mt-1 text-xs text-muted-foreground">{props.hint}</p> : null}
      </div>
      <div className="min-w-0">{props.children}</div>
    </section>
  );
}

function ComboboxUiDemo() {
  return (
    <div className="w-full max-w-sm">
      <Combobox>
        <ComboboxInput placeholder="Search…" />
        <ComboboxPopup>
          <ComboboxList>
            <ComboboxItem value="a">Alpha</ComboboxItem>
            <ComboboxItem value="b">Beta</ComboboxItem>
          </ComboboxList>
        </ComboboxPopup>
      </Combobox>
    </div>
  );
}

function GlassComboboxDemo() {
  const [q, setQ] = useState("");
  return (
    <GlassCombobox value={null} onValueChange={() => {}}>
      <GlassComboboxTrigger>
        <Button type="button" variant="outline" size="sm">
          Glass combobox
        </Button>
      </GlassComboboxTrigger>
      <GlassComboboxPopup>
        <div className="border-b border-glass-stroke/50 p-2">
          <GlassComboboxSearchInput value={q} onChange={setQ} placeholder="Filter" />
        </div>
        <GlassComboboxList>
          <GlassComboboxItem value="x">Item</GlassComboboxItem>
        </GlassComboboxList>
      </GlassComboboxPopup>
    </GlassCombobox>
  );
}

function SlashAndFileMenus() {
  const slashRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLDivElement>(null);
  return (
    <div className="relative z-30 min-h-[26rem] w-full">
      <div ref={slashRef} className="absolute top-2 left-2 size-px" aria-hidden />
      <GlassComposerTokenMenu
        open
        onOpenChange={() => {}}
        anchor={slashRef}
        variant="hero"
        mode="slash"
        query=""
        slashRows={slashRows}
        slashActive={0}
        onSlashHover={() => {}}
        onSlashPick={() => {}}
        hits={[]}
        fileActive={0}
        onFileHover={() => {}}
        onFilePick={() => {}}
        filePick={null}
        preview={null}
        loading={false}
      />
      <div ref={fileRef} className="absolute top-[13rem] left-2 size-px" aria-hidden />
      <GlassComposerTokenMenu
        open
        onOpenChange={() => {}}
        anchor={fileRef}
        variant="hero"
        mode="file"
        query=""
        slashRows={slashRows}
        slashActive={0}
        onSlashHover={() => {}}
        onSlashPick={() => {}}
        hits={fileHits}
        fileActive={0}
        onFileHover={() => {}}
        onFilePick={() => {}}
        filePick={null}
        preview={null}
        loading={false}
      />
    </div>
  );
}

/** Every production surface that imports `central-icons` (same bundle as Electron). */
export function GlassIconDemosPanel() {
  const shell = useDemoPanels();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className="space-y-6">
      <DemoSection
        title="components/glass/settings-nav-rail.tsx"
        hint="settings-panels.tsx uses the same IconArrowRotateCounterClockwise on “Reset Pi defaults” (same glyph as Restore here)."
      >
        <div className="max-w-xs rounded-lg border border-border bg-glass-surface">
          <GlassSettingsNavRail />
        </div>
      </DemoSection>

      <DemoSection title="components/glass/app-shell.tsx">
        <div className="h-[min(22rem,70vh)] overflow-hidden rounded-lg border border-border">
          <GlassAppShell
            left={<div className="p-2 text-detail text-muted-foreground">Chats</div>}
            center={<div className="p-2 text-detail">Editor</div>}
            right={<div className="p-2 text-detail text-muted-foreground">Changes</div>}
            title="Demo"
            changesCount={3}
            panels={shell}
            onBack={() => {}}
          />
        </div>
      </DemoSection>

      <DemoSection title="components/glass/layout.tsx (GlassWorkbenchLayout)">
        <div className="h-48 overflow-hidden rounded-lg border border-border">
          <GlassWorkbenchLayout
            leftSidebar={<div className="p-2 text-detail text-muted-foreground">Agents</div>}
            center={<div className="p-2 text-detail">Chat</div>}
            rightSidebar={<div className="p-2 text-detail text-muted-foreground">Diff</div>}
          />
        </div>
      </DemoSection>

      <DemoSection title="components/glass/open-picker.tsx">
        <GlassOpenPicker variant="hero" />
      </DemoSection>

      <DemoSection
        title="components/glass/update-pill.tsx"
        hint="In Electron, update states show ArrowRotateClockwise and CloudDownload. In web dev the pill may be empty."
      >
        <div className="max-w-xs rounded-lg border border-border p-2">
          <GlassUpdatePill />
        </div>
      </DemoSection>

      <DemoSection title="components/glass/sidebar-header.tsx">
        <div className="max-w-xs rounded-lg border border-border bg-glass-surface">
          <GlassSidebarHeader onNewChat={() => {}} />
        </div>
      </DemoSection>

      <DemoSection title="components/glass/composer-file-preview.tsx">
        <div className="h-48 max-w-md overflow-hidden rounded-lg border border-border">
          <GlassComposerFilePreview item={null} preview={null} />
        </div>
      </DemoSection>

      <DemoSection title="components/glass/sidebar-footer.tsx">
        <div className="max-w-xs rounded-lg border border-border bg-glass-surface py-2">
          <GlassSidebarFooter />
        </div>
      </DemoSection>

      <DemoSection
        title="components/glass/command-palette.tsx"
        hint="Press Mod+Shift+P — palette lists PlusLarge, SettingsGear2, Sidebar icons."
      >
        <GlassCommandPalette panels={shell} onNewChat={() => {}} />
      </DemoSection>

      <DemoSection
        title="components/glass/slash-menu.tsx (GlassComposerTokenMenu)"
        hint="Slash row uses SparklesSoft, SettingsGear2, Bolt; file row uses Folder1, Images1, FileBend, ChevronRight."
      >
        <SlashAndFileMenus />
      </DemoSection>

      <DemoSection
        title="components/glass/model-picker.tsx"
        hint="Open the model menu — Brain, Checkmark1Small, ChevronRight in list and thinking submenu."
      >
        <div className="max-w-sm rounded-lg border border-border p-2">
          <GlassModelPicker
            items={[reasoningModel]}
            status="ready"
            selection={{
              model: { provider: reasoningModel.provider, id: reasoningModel.id },
              thinkingLevel: "medium",
            }}
            variant="settings"
            onSelect={() => {}}
            onThinkingLevel={() => {}}
          />
        </div>
      </DemoSection>

      <DemoSection title="components/glass/git-panel.tsx (rows)">
        <div className="max-w-md rounded-lg border border-border p-2">
          <GlassGitGroupHeader dir="src" count={1} open onToggle={() => {}} />
          <GlassGitFileRow
            file={gitRow}
            selected={false}
            viewed={false}
            onSelect={() => {}}
            onToggleViewed={() => {}}
            onRevert={() => {}}
          />
        </div>
      </DemoSection>

      <DemoSection title="components/glass/chat-composer.tsx (toolbar + chips)">
        <div className="space-y-3">
          <GlassComposerToolbarIconDemo />
          <GlassComposerAttachmentChipDemo />
        </div>
      </DemoSection>

      <DemoSection title="components/glass/chat-rows.tsx">
        <div className="max-w-xl overflow-hidden rounded-lg border border-border">
          <GlassChatRowsIconStripDemo />
        </div>
      </DemoSection>

      <DemoSection title="components/glass/ask-tool.tsx">
        <div className="max-w-lg rounded-lg border border-border p-3">
          <GlassAskTool state={askDemo} onReply={() => {}} />
        </div>
      </DemoSection>

      <DemoSection title="components/glass/agent-list.tsx">
        <div className="max-w-xs rounded-lg border border-border bg-glass-surface">
          <GlassAgentList sections={agentSections} selectedId={null} onSelectAgent={() => {}} />
        </div>
      </DemoSection>

      <DemoSection
        title="components/ui/dialog.tsx"
        hint="Opens on demand so the modal overlay (z-50) does not cover the rest of this page."
      >
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            Open dialog demo
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogPopup className="max-w-sm" showCloseButton>
              <DialogHeader>
                <DialogTitle>Dialog</DialogTitle>
              </DialogHeader>
              <p className="px-6 pb-6 text-body text-muted-foreground">
                Close uses IconCrossSmall.
              </p>
            </DialogPopup>
          </Dialog>
        </div>
      </DemoSection>

      <DemoSection
        title="components/ui/sheet.tsx"
        hint="Opens on demand so the backdrop (z-50) does not block the icon inventory."
      >
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
            Open sheet demo
          </Button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="right" className="w-72 p-6">
              Sheet close uses IconX.
            </SheetContent>
          </Sheet>
        </div>
      </DemoSection>

      <DemoSection title="components/ui/combobox.tsx">
        <ComboboxUiDemo />
      </DemoSection>

      <DemoSection title="components/glass/combobox.tsx">
        <GlassComboboxDemo />
      </DemoSection>

      <DemoSection title="components/ui/select.tsx (GlassSelect)">
        <GlassSelect
          value="a"
          onValueChange={() => {}}
          options={[{ value: "a", label: "Option A" }]}
        />
      </DemoSection>

      <DemoSection title="components/ui/sidebar.tsx (SidebarTrigger)">
        <SidebarTrigger />
      </DemoSection>

      <DemoSection title="components/ui/sonner.tsx (toast)">
        <Button type="button" variant="outline" size="sm" onClick={() => toast.success("Saved")}>
          Show success toast (CircleCheck + Loader while pending)
        </Button>
      </DemoSection>
    </div>
  );
}
