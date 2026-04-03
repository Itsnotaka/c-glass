# Emdash Deep Research & Product Comparison

## Executive Summary

**Emdash** (generalaction/emdash) is a provider-agnostic Agentic Development Environment (ADE) desktop app supporting 23+ CLI agents. It features a sophisticated three-pane layout with terminal-based agent interactions, Monaco-powered diff viewing, and project-task hierarchical organization.

**c-glass** is a Cursor-style glass interface web app with a triple-pane workbench (Agents/Chat/Changes), chat bubble-based UI, and @pierre/diffs integration.

---

## 1. Architecture Comparison

### Layout Structure

| Aspect              | Emdash                                                                 | c-glass (Current)                                   |
| ------------------- | ---------------------------------------------------------------------- | --------------------------------------------------- |
| **Layout System**   | `ResizablePanelGroup` (shadcn) with percentage-based sizing (20/60/20) | Custom absolute-positioned panels with pixel widths |
| **Persistence**     | localStorage for panel sizes (`PANEL_LAYOUT_STORAGE_KEY`)              | Client-side state only (not persisted)              |
| **Resize Handles**  | Visual handles with `withHandle` prop, hover states                    | Custom 1px invisible handles                        |
| **Min/Max Sizes**   | Enforced via `minSize`/`maxSize` props on panels                       | Manual clamping in mousemove handlers               |
| **Collapsed State** | Native `collapsible` with `collapsedSize`                              | Boolean toggle (right panel only)                   |

### Panel Hierarchy

**Emdash Workspace Layout** (`src/renderer/views/Workspace.tsx`):

```
ResizablePanelGroup (horizontal)
├── ResizablePanel (left sidebar) - 16-30%
│   └── LeftSidebar
│       ├── Navigation (Home, Skills, MCP, Automations)
│       └── Projects (collapsible folders with tasks)
├── ResizableHandle (with visual indicator)
├── ResizablePanel (main) - 30-60%
│   └── MainContentArea
│       ├── ChatInterface (terminal-based)
│       ├── ProjectMainView
│       ├── SettingsPage
│       └── DiffViewer (full-panel takeover)
├── ResizableHandle
└── ResizablePanel (right sidebar) - 16-50%
    └── RightSidebar
        ├── FileChangesPanel (upper)
        ├── ResizableHandle (vertical)
        └── TaskTerminalPanel (lower)
```

**c-glass Current Layout**:

```
Flex container
├── Aside (left) - Agents list, px width
├── Main (center) - Chat with composer
└── Aside (right, conditional) - Changes/Diffs
```

---

## 2. Sidebar Navigation Patterns

### Emdash LeftSidebar

**Location**: `src/renderer/components/sidebar/LeftSidebar.tsx`

**Key Features**:

- **Hierarchical Structure**: Projects → Tasks (collapsible)
- **Drag-to-Reorder**: Uses `ReorderList` component with framer-motion
- **Sort Modes**: Per-project sorting (Creation Date, Last Active, Alphabetical)
- **Visual States**:
  - Active project: `bg-black/[0.06]`
  - Active task: `bg-black/[0.06]`
  - Hover: `hover:bg-accent`
- **Remote Indicators**: SSH connection status in project rows
- **Quick Actions**: Add task (+ button on hover), archive section

**Project Structure Pattern**:

```tsx
<Collapsible defaultOpen>
  <div className="group/project relative flex items-center gap-1.5">
    <CollapsibleTrigger>
      <FolderOpen /> / <FolderClosed />
    </CollapsibleTrigger>
    <motion.button whileTap={{ scale: 0.97 }}>
      <ProjectItem project={project} />
    </motion.button>
    {/* Sort picker - visible on hover */}
    <span className="opacity-0 group-hover/project:opacity-100">
      <SortModePicker />
    </span>
    <button className="opacity-0 group-hover/project:opacity-100">
      <Plus />
    </button>
  </div>
  <CollapsibleContent>
    <ReorderList items={tasks}>{(task) => <TaskItem task={task} />}</ReorderList>
  </CollapsibleContent>
</Collapsible>
```

### c-glass GlassAgentList

**Current Pattern**:

- Flat sections (Today, Yesterday, etc.)
- No drag-to-reorder
- No project hierarchy
- Direct agent selection

**Gap**: c-glass lacks project-task organization, which is critical for multi-project workflows.

---

## 3. Chat Interface Design

### Emdash ChatInterface

**Location**: `src/renderer/components/ChatInterface.tsx`

**Paradigm**: Terminal-based (not chat bubbles)

- Uses xterm.js via `TerminalPane` component
- Each agent runs in native CLI mode
- Full terminal fidelity with colors, progress bars, etc.

**Multi-Chat Architecture**:

```tsx
// Multiple conversations per task
const [conversations, setConversations] = useState<Conversation[]>([]);
const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

// Each conversation gets its own terminal session
const terminalId = useMemo(() => {
  if (activeConversation?.isMain) {
    return makePtyId(agent, "main", task.id);
  }
  return makePtyId(agent, "chat", activeConversationId);
}, [activeConversation, agent, task.id]);
```

**Tab Design**:

- Horizontal scrollable tabs
- Agent logo per tab
- Status indicator per tab
- Close button (hidden when single tab)
- Overflow with fade mask: `[mask-image:linear-gradient(to_right,black_calc(100%_-_16px),transparent)]`

**Auto-Approve Badge**:

```tsx
<span className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-muted px-2.5 text-xs">
  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
  Auto-approve
</span>
```

### c-glass Chat

**Current Pattern**:

- Message bubble-based UI
- Rich text rendering
- Traditional chat UX

**Trade-offs**:
| Aspect | Terminal (Emdash) | Chat Bubbles (c-glass) |
|--------|-------------------|------------------------|
| Agent Fidelity | 100% - native CLI output | Requires parsing/formatting |
| Tool Calls | Native display | Custom rendering needed |
| Progress Bars | Native | Simulated or missing |
| Colors/Formatting | Native ANSI | Manual styling |
| Copy/Paste | Terminal-native | Custom implementation |
| Accessibility | Terminal reader | Better ARIA support |

---

## 4. Diff Viewing Architecture

### Emdash Diff System

**Location**: `src/renderer/components/diff-viewer/`

**Components**:

- `DiffViewer.tsx` - Container with tab switching (Changes/History)
- `DiffPanel.tsx` - View mode toolbar + content area
- `FileDiffView.tsx` - Monaco-based diff editor
- `StackedDiffView.tsx` - Scrollable all-files view
- `FileList.tsx` - Staging interface

**Monaco Integration**:

```tsx
<DiffEditor
  language={fileData.language}
  original={originalContent}
  modified={modifiedDraft}
  theme={monacoTheme}
  options={{
    readOnly: !!baseRef,
    renderSideBySide: diffStyle === "split",
    glyphMargin: true, // For comments
  }}
/>
```

**Features**:

- **Inline Editing**: Modified side is editable
- **Comments**: Line-level comments via glyph margin
- **View Modes**: Stacked (all files) vs File (single file)
- **Diff Styles**: Unified vs Split (persisted to localStorage)
- **Large File Handling**: Size limits with "Load anyway" option
- **Syntax Highlighting**: Language detection from file path

**FileList Staging UI**:

```tsx
// Tracked/Untracked separation
const tracked = fileChanges.filter((f) => f.status !== "added");
const untracked = fileChanges.filter((f) => f.status === "added");

// Group checkboxes for stage all
<div className="flex items-center gap-2">
  <Checkbox checked={trackedAllStaged} />
  <span className="text-xs font-medium tracking-wide">Tracked</span>
</div>;
```

### c-glass Diff System

**Current Pattern**:

- `@pierre/diffs` web component
- Type workaround with `@ts-expect-error`
- Read-only viewing
- Split/unified toggle
- No staging integration

**Gaps**:

1. No inline editing capability
2. No comment/annotation system
3. No Monaco integration (syntax highlighting limited)
4. No staged/untracked separation
5. No "stacked" view mode

---

## 5. Right Sidebar Patterns

### Emdash RightSidebar

**Location**: `src/renderer/components/RightSidebar.tsx`

**Structure**: Vertical split via `ResizablePanelGroup`

```
RightSidebar
├── ResizablePanel (50%) - FileChangesPanel
│   ├── File list with staging
│   └── "Open in Diff Viewer" action
├── ResizableHandle (horizontal)
└── ResizablePanel (50%) - TaskTerminalPanel
    └── Secondary terminal session
```

**Multi-Agent Support**:

- Detects `task.metadata.multiAgent.variants`
- Stacks multiple variants vertically when >1
- Each variant gets its own Changes + Terminal

**Collapsed State**:

```tsx
<aside
  data-state={collapsed ? "collapsed" : "open"}
  className="transition-all duration-200 ease-linear
    data-[state=collapsed]:pointer-events-none"
/>
```

### c-glass Right Panel

**Current Pattern**:

- Single-purpose diff viewer
- No terminal panel
- Collapsible but not resizable vertically
- No multi-agent variant support

---

## 6. Design Tokens & Theming

### Emdash Color System

**CSS Variables** (from `src/renderer/index.css`):

```css
:root {
  --background: 0 0% 100%;
  --foreground: 0 0% 3.9%;
  --card: 0 0% 100%;
  --muted: 0 0% 96.1%;
  --muted-foreground: 0 0% 45.1%;
  --accent: 0 0% 96.1%;
  --border: 0 0% 89.8%;
  --radius: 0.5rem;
}

.dark {
  --background: 215 28% 17%; /* gray-800 */
  --foreground: 220 9% 96%; /* gray-100 */
  --card: 215 28% 17%;
  --muted: 217 23% 27%; /* gray-700 */
  --border: 217 17% 32%;
}

.dark-black {
  --background: 0 0% 0%; /* pure black */
  --card: 0 0% 4%; /* #0a0a0a */
  --border: 0 0% 20%; /* #333333 */
}
```

### c-glass Color System

**Current Pattern** (`src/glass.css`):

- Glass morphism with color-mix()
- Custom diff tokens mapped to oklch
- Subtle gradient backgrounds
- Higher transparency/blur effects

**Comparison**:
| Aspect | Emdash | c-glass |
|--------|--------|---------|
| **Base** | Solid grays (shadcn) | Glass morphism |
| **Dark Mode** | Three tiers (light/dark/dark-black) | Two tiers with transparency |
| **Borders** | Solid 1px | Semi-transparent 0.5-1px |
| **Background** | Flat colors | Radial gradients + blur |

---

## 7. Specific Patterns Worth Adopting

### A. Resizable Panel System

**Emdash Pattern**:

```tsx
// constants/layout.ts
export const DEFAULT_PANEL_LAYOUT: [number, number, number] = [20, 60, 20];
export const LEFT_SIDEBAR_MIN_SIZE = 16;
export const LEFT_SIDEBAR_MAX_SIZE = 30;

// Workspace.tsx
<ResizablePanelGroup onLayout={handlePanelLayout}>
  <ResizablePanel
    defaultSize={defaultPanelLayout[0]}
    minSize={LEFT_SIDEBAR_MIN_SIZE}
    maxSize={LEFT_SIDEBAR_MAX_SIZE}
    collapsible
    collapsedSize={0}
  />
</ResizablePanelGroup>;
```

**Benefits**:

- Percentage-based (responsive)
- Native persistence via `autoSaveId` or custom `onLayout`
- Built-in collapse/expand
- Visual resize handles

### B. File Changes Panel with Staging

**Emdash Pattern** (`FileList.tsx`):

- Color-coded status dots (green=added, yellow=modified, red=deleted)
- Tracked vs Untracked grouping
- Hover-reveal actions (restore, stage checkbox)
- Bulk stage/unstage via group checkboxes

**Visual Hierarchy**:

```
[Checkbox] Stage All

Tracked (3)
  [●] [Checkbox] filename.js  (+12 -3)  [Restore on hover]
  [●] [Checkbox] utils.ts     (+5)      [Restore on hover]

Untracked (2)
  [●] [Checkbox] new.tsx      (new)     [Restore on hover]
```

### C. Conversation Tabs

**Emdash Pattern**:

```tsx
<div className="flex items-center gap-2">
  <div className="flex overflow-x-auto [scrollbar-width:none]">
    {conversations.map((conv) => (
      <button
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs",
          isActive ? "bg-background shadow-sm" : "bg-muted hover:bg-muted/80",
        )}
      >
        <AgentLogo logo={config.logo} className="h-3.5 w-3.5" />
        <span className="max-w-[10rem] truncate">{tabLabel}</span>
        <TaskStatusIndicator status={status} />
        <X className="h-3 w-3" onClick={() => onCloseChat(conv.id)} />
      </button>
    ))}
  </div>
  <button className="h-7 w-7 rounded-md border bg-muted">
    <Plus className="h-3.5 w-3.5" />
  </button>
</div>
```

**Key Details**:

- Max-width truncation with `max-w-[10rem]`
- Overflow fade mask
- Status indicator dot
- Hover states for close button

### D. Empty States

**Emdash Pattern** (`SidebarEmptyState`):

```tsx
<div className="mt-auto">
  <SidebarEmptyState
    title="Put your agents to work"
    description="Create a task and run one or more agents on it in parallel."
    actionLabel="Open Folder"
    onAction={onOpenProject}
  />
</div>
```

### E. Activity/Status Indicators

**Emdash Pattern** (`TaskStatusIndicator`):

- Unknown: Gray dot
- Working: Animated pulse
- Success: Green check
- Error: Red X
- Unread badge: Blue dot overlay

---

## 8. Proposed Improvements for c-glass

### High Priority

1. **Replace custom resize with shadcn Resizable**
   - Better UX with visual handles
   - Persistent panel sizes
   - Built-in collapse support

2. **Add Project-Task Hierarchy to Sidebar**
   - Group agents/projects with collapsible sections
   - Drag-to-reorder with persistence
   - Sort mode picker

3. **Monaco Diff Editor Integration**
   - Replace @pierre/diffs with Monaco
   - Add inline editing capability
   - Syntax highlighting for all languages
   - Line-level commenting system

### Medium Priority

4. **File Changes Panel Redesign**
   - Staging checkboxes with bulk actions
   - Tracked/Untracked separation
   - Color-coded status indicators
   - Hover-reveal file actions

5. **Multi-Agent Tabs per Session**
   - Conversation tabs like emdash
   - Each agent gets isolated context
   - Tab-level status indicators

6. **Terminal Integration**
   - Add terminal panel to right sidebar
   - xterm.js for native CLI experience
   - Split view: Changes above, Terminal below

### Low Priority

7. **Theme Extensions**
   - Dark-black mode (pure black)
   - Higher contrast option

8. **Keyboard Shortcuts**
   - Global shortcuts for panel toggle
   - Agent switching (Cmd+Shift+J/K)
   - Terminal focus shortcuts

---

## 9. Code Quality Observations

### Emdash Strengths

- Comprehensive TypeScript types
- Feature flags for gradual rollout
- Local storage persistence patterns
- Event-driven cross-component communication
- Proper cleanup in useEffect hooks

### Emdash Patterns to Emulate

**Event System**:

```tsx
// Global events for cross-cutting concerns
window.dispatchEvent(
  new CustomEvent("emdash:conversations-changed", {
    detail: { taskId: task.id },
  }),
);

// Listener with cleanup
useEffect(() => {
  const handler = (e: Event) => {
    /* ... */
  };
  window.addEventListener("emdash:conversations-changed", handler);
  return () => window.removeEventListener("emdash:conversations-changed", handler);
}, []);
```

**RPC Pattern**:

```tsx
// rpc.db abstraction over electronAPI
const conversations = await rpc.db.getConversations(task.id);
await rpc.db.createConversation({ taskId, title, provider });
```

**Store Pattern**:

```tsx
// activityStore for reactive status
activityStore.subscribe(taskId, (busy) => setIsBusy(busy));
activityStore.handleAgentEvent(event);
```

---

## 10. Migration Path

### Phase 1: Layout Foundation

1. Add `shadcn/ui` Resizable components
2. Replace custom resize handles
3. Implement persisted panel sizes

### Phase 2: Sidebar Enhancement

1. Add hierarchical section support
2. Implement drag-to-reorder
3. Add project/task grouping

### Phase 3: Diff System Upgrade

1. Install Monaco editor
2. Create FileDiffView component
3. Implement staging UI
4. Migrate from @pierre/diffs

### Phase 4: Terminal Integration

1. Add xterm.js
2. Create TaskTerminalPanel
3. Implement vertical split in right sidebar

---

## References

**Emdash Key Files**:

- `src/renderer/views/Workspace.tsx` - Main layout
- `src/renderer/components/sidebar/LeftSidebar.tsx` - Navigation
- `src/renderer/components/ChatInterface.tsx` - Terminal chat
- `src/renderer/components/diff-viewer/` - Diff system
- `src/renderer/components/RightSidebar.tsx` - Right panel
- `src/renderer/constants/layout.ts` - Layout constants

**c-glass Key Files**:

- `src/components/glass/workbench.tsx` - Main workbench
- `src/components/glass/diff-viewer.tsx` - Diff wrapper
- `src/glass.css` - Design tokens
