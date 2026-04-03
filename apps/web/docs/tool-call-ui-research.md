# Tool Call UI & Pi Native Integration Analysis

## Current State Comparison

### Emdash Approach: Terminal-Native

**No explicit tool call cards** - Agents run in actual xterm.js terminals:

```tsx
<TerminalPane
  id={terminalId}
  cwd={task.path}
  providerId={agent} // 'claude', 'codex', etc.
  autoApprove={autoApproveEnabled}
/>
```

Tool calls render as native terminal output:

- Claude Code: native TUI with spinners and progress
- Aider: native ANSI output
- All agents: 100% fidelity to their CLI presentation

**Auto-approve UI** (just a badge):

```tsx
<span className="inline-flex h-7 items-center gap-1.5 rounded-md border bg-muted px-2.5 text-xs">
  <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
  Auto-approve
</span>
```

### c-glass Current: Structured Cards

From `glass-pi-messages.tsx`:

- `ToolCard`: Collapsible showing tool name + JSON args/results
- `BashCard`: Command + terminal output
- `Section`: Code blocks with syntax highlighting

**Problem**: "Card over card with plain JSON" - nested structure with raw JSON presentation

---

## Pi Native vs Electron RPC

### Emdash RPC (Electron-only)

```tsx
// Electron main <> renderer bridge
window.electronAPI.fsRead(taskPath, filePath, maxBytes);
window.electronAPI.fsWriteFile(taskPath, filePath, content);
window.electronAPI.getFileDiff({ taskPath, filePath });
window.electronAPI.ptyInput({ id: terminalId, data });
```

**Pi Native Equivalent**:

Pi exposes a different API surface. Based on your `usePiSession` hook:

```tsx
// Pi native session API (current)
const session = usePiSession(sessionId);
session.send(message);
session.abort();
session.setModel(model);
session.messages; // PiSessionItem[]
```

**Key Difference**: Pi handles the agent lifecycle internally; you receive processed `PiSessionItem` objects rather than raw terminal streams.

---

## Improved Tool Call UI Patterns

### Pattern 1: Semantic Tool Cards (Recommended)

Instead of generic JSON display, parse tool type and render appropriate UI:

```tsx
// Tool type detection from PiToolCallBlock
function ToolCallView({ call, result, error }: ToolCallProps) {
  const name = call.name.toLowerCase();

  // Route to specialized renderer
  if (name.includes("read") || name.includes("view")) {
    return <FileReadCard path={args.path} content={result} />;
  }
  if (name.includes("bash") || name.includes("shell")) {
    return <BashCard command={args.command} output={result} exitCode={exitCode} />;
  }
  if (name.includes("search") || name.includes("grep")) {
    return <SearchCard query={args.query} results={result} />;
  }
  if (name.includes("edit") || name.includes("write")) {
    return <FileEditCard path={args.path} diff={result} />;
  }

  // Fallback to structured JSON view
  return <GenericToolCard call={call} result={result} />;
}
```

### Pattern 2: Terminal-Style Output (Emdash-like)

If Pi exposes raw tool output, render in terminal panel:

```tsx
// Right sidebar: Terminal panel showing live tool execution
<TaskTerminalPanel sessionId={sessionId} variant="dark" showToolCalls={true} />
```

**Benefits**:

- Native ANSI colors and progress
- No custom UI needed per tool
- Familiar CLI experience

### Pattern 3: Inline Approval Flow

For non-auto-approved tools:

```tsx
<ToolCallPending
  tool={call}
  onApprove={() => session.approveTool(call.id)}
  onReject={() => session.rejectTool(call.id)}
  onEdit={(modified) => session.approveWithEdit(call.id, modified)}
/>
```

**UI Structure**:

```
┌─────────────────────────────────────┐
│ 🔧 bash                             │
│ Run tests before committing?        │
│                                     │
│ Command: npm test                   │
│                                     │
│ [Cancel]    [Edit...]    [Approve]  │
└─────────────────────────────────────┘
```

### Pattern 4: Collapsible Timeline (Current Improved)

Keep current structure but improve presentation:

```tsx
<ToolCard>
  {/* Header - always visible */}
  <CollapsibleTrigger>
    <IconToolbox /> {toolName}
    <span className="text-muted-foreground">{summary}</span>
    <StatusIndicator status={status} />
  </CollapsibleTrigger>

  {/* Body - expanded */}
  <CollapsiblePanel>
    {/* Args - simplified, not raw JSON */}
    <ToolArgsView args={args} />

    {/* Result - semantic rendering */}
    <ToolResultView result={result} type={toolName} />
  </CollapsiblePanel>
</ToolCard>
```

---

## Specific Improvements for c-glass

### 1. Replace JSON Display with Structured Views

**Current** (raw JSON):

```tsx
<Section text={props.row.args} code lang="json" minimal />
<Section text={props.row.result} code lang="json" minimal />
```

**Improved** (semantic):

```tsx
// File read tool
<FileReadView
  path="src/components/button.tsx"
  lines={content.split('\n')}
  highlightRange={[12, 24]}
/>

// Bash tool
<BashView
  command="npm test"
  output={output}
  exitCode={0}
  truncated={false}
/>

// Search tool
<SearchResultsView
  query="function Button"
  matches={[
    { path: "src/a.tsx", line: 12, preview: "export function Button()" },
    { path: "src/b.tsx", line: 8, preview: "function ButtonVariant()" }
  ]}
/>
```

### 2. Add Tool Call Approval UI

If Pi supports tool approval workflow:

```tsx
function ToolApprovalCard({ tool, onResolve }: Props) {
  const [editedArgs, setEditedArgs] = useState(tool.args);

  return (
    <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-4">
      <div className="flex items-center gap-2 text-orange-600">
        <IconAlertCircle />
        <span className="font-medium">Approval Required</span>
      </div>

      <ToolCallPreview tool={tool} args={editedArgs} />

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={() => onResolve("reject")}>
          Reject
        </Button>
        <Button variant="outline" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button onClick={() => onResolve("approve", editedArgs)}>Approve</Button>
      </div>
    </div>
  );
}
```

### 3. Terminal Integration for Raw Output

Add terminal panel to right sidebar for CLI-native experience:

```tsx
// Right sidebar vertical split
<ResizablePanelGroup direction="vertical">
  <ResizablePanel>
    <FileChangesPanel />
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel>
    <PiTerminalPanel sessionId={sessionId} showToolCalls={true} />
  </ResizablePanel>
</ResizablePanelGroup>
```

**PiTerminalPanel** would:

- Subscribe to Pi session live output
- Render ANSI colors via xterm.js
- Show tool execution progress
- Allow interactive approval in terminal

---

## Pi Native API Questions

To implement these improvements, need to understand Pi's capabilities:

1. **Does Pi expose raw tool output streams?** Or only processed `PiSessionItem` objects?

2. **Does Pi support tool approval workflows?** Can you intercept and approve/reject tools?

3. **What fields are available in `PiToolCallBlock`?**
   - Is there structured output beyond `args` and `result` strings?
   - Can you determine tool category from the call?

4. **Does Pi have a terminal/pty mode?** Similar to running CLI agents directly?

5. **Can you send tool results back to Pi?** For editing tool arguments before approval?

---

## Recommended Implementation Path

### Phase 1: Semantic Tool Rendering (Immediate)

Parse tool names and render appropriate UI:

```tsx
const TOOL_PATTERNS = {
  fileRead: /read|view|cat|show/i,
  fileWrite: /write|edit|modify|create/i,
  bash: /bash|shell|exec|run/i,
  search: /search|grep|find/i,
};

function SmartToolCard({ row }: { row: PiToolRow }) {
  const type = detectToolType(row.name);

  switch (type) {
    case "fileRead":
      return <FileReadCard {...parseFileRead(row)} />;
    case "bash":
      return <BashCard {...parseBash(row)} />;
    // ... etc
  }
}
```

### Phase 2: Terminal Panel (If Pi supports streams)

Add terminal view to right sidebar for raw CLI experience.

### Phase 3: Approval Flow (If Pi supports it)

Implement pending/approved/rejected states with action buttons.

---

## References

**Emdash Terminal**:

- `src/renderer/components/TerminalPane.tsx` - xterm.js wrapper
- `src/renderer/components/TaskTerminalPanel.tsx` - Terminal management

**c-glass Current**:

- `src/components/glass/glass-pi-messages.tsx` - Message rendering
- `src/components/glass/use-pi-session.ts` - Pi session hook

**Key Pattern from emdash**:

```tsx
// Terminal-first means no custom tool UI needed
// Agent renders its own tool calls natively
<TerminalPane providerId="claude" autoApprove={true} />
```
