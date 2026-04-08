# Harness Extension System Research

Date: 2026-04-07
Status: research only

## Question

Can Glass adopt a `pi-mono`-like extension system while moving onto `t3code`-style infrastructure, especially if the primary harnesses are the default ones like Codex app-server and Claude Code?

Related sub-questions:

1. Should the extension model be Pi-style extensions, Pi-style skills, a Glass-specific capability system, or some mix?
2. Should Glass bundle MCP tools or servers?
3. Is `skills + a c-glass-specific cli.ts script` a sensible pattern?
4. Does `pi-mono/packages/web-ui` provide the right architectural precedent, or only a UI precedent?

## Executive Answer

Yes, but not by copying Pi's extension system wholesale.

The best fit is:

1. Use `t3code` as the harness and runtime backbone.
2. Keep Glass-owned canonical events and harness adapters as the core integration seam.
3. Add a Glass capability layer on top of that, instead of making Pi extensions the universal plugin API.
4. Borrow `pi-mono` `web-ui` ideas for UI registries and tool renderers, not for harness orchestration.
5. Use skills for workflow guidance and discovery, and use a project-owned executable surface for real behavior.
6. Do not start by bundling MCP servers inside Glass.

The most practical first version is:

1. `t3code`-style provider and harness adapters.
2. A Glass capability-pack manifest with optional `skill`, `renderer`, `slash command`, and `cli` hooks.
3. A small `glass` or `c-glass` command surface for app-specific actions.
4. Optional Pi extensions only for the Pi harness path, not as the cross-harness abstraction.

## Why This Matters Now

The current repo is already moving toward a `t3code`-first rewrite in `plans/codex-app-server-first.md`.

That note makes three things clear:

1. `t3code` is being treated as the source of truth for runtime flow and package boundaries.
2. The long-term direction is to thin the desktop process and move provider logic out of Pi-specific runtime code.
3. Pi-specific runtime code is expected to shrink or disappear once the server-backed path is live.

That means any new extension system should survive a world where Glass is no longer Pi-first.

## What Glass Already Has

Glass already has two separate seams that look extension-like.

### 1. Harness-Level Abstraction

Glass already models harnesses explicitly in `packages/contracts/src/harness.ts`.

Important facts:

1. `HarnessKind` already includes `pi`, `codex`, and `claudeCode`.
2. `HarnessDescriptor` already exposes capabilities such as `modelPicker`, `thinkingLevels`, `commands`, `extensions`, `interactive`, and `fileAttachments`.
3. The renderer already consumes those capabilities.

Desktop wiring in `apps/desktop/src/main.ts` and `apps/desktop/src/preload.ts` also already assumes harness selection is first-class.

This is very close to the shape needed for a `t3code`-style adapter registry.

### 2. Pi Extension Discovery and Settings UI

Glass also already exposes Pi extension discovery and toggling.

Relevant files:

1. `apps/desktop/src/pi-config-service.ts`
2. `packages/contracts/src/pi.ts`
3. `apps/web/src/components/settings/settings-panels.tsx`

Important facts:

1. Glass reads Pi extension discovery through Pi's `DefaultResourceLoader` and package resolution.
2. It shows discovered extensions and extension errors in the settings UI.
3. It persists enable/disable state using Pi's standard extension path settings.

So Glass already has a Pi-specific extension UX.

### 3. Pi Runtime Still Loads Real Skills and Extensions

Even though config discovery disables skills for the config view, the actual Pi runtime worker still loads the normal Pi resource stack.

Relevant file:

1. `apps/desktop/src/pi-runtime/pi-runtime-worker.ts`

Important facts:

1. The worker creates a real `DefaultResourceLoader`.
2. It calls `pi.createAgentSession(...)` with that loader.
3. It runs `pi.runRpcMode(...)`.

So skills and extensions are still real in the Pi harness path.

### 4. Glass Does Not Support Full Pi Custom UI

Glass has an important limitation today for Pi extensions.

Relevant file:

1. `apps/desktop/src/ext-ui-bridge.ts`

Important facts:

1. `select`, `confirm`, `input`, `editor`, and `notify` are bridged.
2. `ctx.ui.custom()` throws: `"Custom extension UI is not available in Glass"`.
3. Several other TUI-oriented extension UI methods are no-ops.

This matters because it means Glass should not build a future extension story around Pi's full custom TUI API.

## What `t3code` Actually Provides

`t3code` is not an extension system in the Pi sense. It is a runtime orchestration system.

Relevant sources:

1. `.pi/codebases/cb-mnp3tsw8-681i/AGENTS.md`
2. `.pi/codebases/cb-mnp3tsw8-681i/apps/server/src/provider/Services/ProviderAdapter.ts`
3. `.pi/codebases/cb-mnp3tsw8-681i/apps/server/src/provider/Layers/ProviderAdapterRegistry.ts`
4. `.pi/codebases/cb-mnp3tsw8-681i/apps/server/src/provider/Layers/ProviderService.ts`
5. `.pi/codebases/cb-mnp3tsw8-681i/apps/server/src/server.ts`

Key findings:

1. `t3code` uses provider adapters as the core seam.
2. It has separate Codex and Claude adapter layers.
3. `ProviderService` fans provider-native events into a canonical stream.
4. The web app receives normalized orchestration events over WebSocket.
5. MCP-related status and tool lifecycle events already exist in `packages/contracts/src/providerRuntime.ts`.

This is an excellent base for harness support, but not yet a plugin model for arbitrary app features.

## What `pi-mono/packages/web-ui` Actually Provides

`pi-mono` `web-ui` is useful, but it is a UI extension surface, not a runtime extension surface.

Relevant sources:

1. `.pi/codebases/cb-mnp3tikd-3wfe/packages/web-ui/README.md`
2. `.pi/codebases/cb-mnp3tikd-3wfe/packages/web-ui/src/ChatPanel.ts`
3. `.pi/codebases/cb-mnp3tikd-3wfe/packages/web-ui/src/tools/renderer-registry.ts`

Key findings:

1. `ChatPanel` accepts a `toolsFactory(...)` hook.
2. Tool renderers can be registered dynamically with `registerToolRenderer(...)`.
3. Runtime providers can be passed into REPL-style tools.
4. The package is centered on message rendering, artifacts, attachments, and custom tool UI.

This is valuable inspiration for Glass's renderer layer, especially if Glass wants:

1. custom tool result cards
2. custom tool-call progress renderers
3. artifact panes
4. per-capability UI extensions

But it does not solve:

1. provider orchestration
2. harness lifecycle
3. cross-harness extension discovery
4. security and packaging policy

So `pi-mono/web-ui` should inform the web-side extension registry only.

## What Pi Extensions and Skills Actually Provide

Relevant sources:

1. Pi docs: `docs/extensions.md`, `docs/skills.md`, `docs/custom-provider.md`
2. Pi examples: `examples/sdk/06-extensions.ts`, `examples/extensions/dynamic-resources/index.ts`, `examples/extensions/bash-spawn-hook.ts`, `examples/extensions/inline-bash.ts`

### Pi Extensions

Pi extensions are much more capable than skills.

Important facts from the docs and examples:

1. Extensions are TypeScript modules loaded through `jiti`, so they work without compilation.
2. Extensions can register tools, commands, providers, shortcuts, flags, and event hooks.
3. Extensions can dynamically contribute skill paths, prompt paths, and theme paths.
4. Extensions can override or register providers with `pi.registerProvider(...)`.
5. Extensions can intercept tool calls and provider requests.

This means the statement "skills are unable to run TypeScript" is true, but incomplete.

The full picture is:

1. skills are markdown capability packages
2. extensions are executable TypeScript
3. extensions can add skills dynamically
4. skills can instruct the model to call scripts or tools

### Pi Skills

Pi skills are deliberately lightweight.

Important facts from `docs/skills.md`:

1. Skills are capability packages centered on `SKILL.md`.
2. They are discovered and described at startup, then loaded on demand.
3. They are not a runtime plugin API.
4. They can reference scripts and helper files by relative path.
5. They are ideal for workflows, setup guidance, and domain-specific instructions.

So skills are not the right place for runtime logic, but they are a good place to teach the model how to use a runtime surface that already exists.

## Architecture Implication

The clean split is:

1. `t3code`-style adapters for runtime and provider behavior.
2. Glass capability packs for app-level feature discovery.
3. Pi extensions only where the Pi harness is active.
4. Skills as workflow overlays, not as the execution engine.

## Can Glass Have a Pi-Like Extension System on Top of `t3code`?

Yes, but the right version is a Glass-specific capability system with Pi compatibility, not Pi extensions as the universal primitive.

A good mental model is:

1. `t3code` gives the transport and orchestration spine.
2. Glass adds a capability-pack layer above that spine.
3. Pi integration becomes one harness adapter among several.
4. Pi extensions remain available inside the Pi harness path.
5. Cross-harness features live in Glass capability packs.

## Proposed Glass Capability-Pack Model

A capability pack should be the product-level extension unit.

A pack can optionally contain:

1. metadata manifest
2. slash commands
3. skill files
4. web renderers
5. project CLI bindings
6. harness-specific adapters
7. optional Pi extension entrypoints for the Pi harness only

### Why This Is Better Than Reusing Pi Extensions Everywhere

1. Codex app-server and Claude Code are not Pi extension hosts.
2. Pi extension APIs assume Pi runtime semantics and, in some cases, Pi UI semantics.
3. Glass is already moving away from Pi-first runtime ownership.
4. A Glass-owned capability layer can target all harnesses consistently.

### Suggested Shape

A first-pass pack could expose only declarative metadata plus small adapters.

For example, conceptually:

1. `name`, `description`, `scope`
2. `skills/`
3. `renderers/`
4. `commands/`
5. `cli/`
6. optional `pi/extension.ts`
7. optional `mcp/` recipes or templates

That would let Glass support:

1. app-native UI and settings
2. cross-harness discovery
3. harness-specific behavior where needed
4. progressive adoption during the rewrite

## Should Glass Bundle MCP Tools or Servers?

Probably not at first.

### Reasons Not To Bundle Them By Default

1. MCP servers have auth, environment, and trust implications.
2. Bundling them couples app releases to external tool behavior.
3. Different harnesses already have different MCP configuration models.
4. Packaging MCP servers into the desktop app makes upgrades and debugging harder.
5. It blurs the boundary between "Glass feature" and "workspace toolchain".

### Better Approach

Treat MCP as external, but supported.

Glass should:

1. detect or reference workspace MCP configuration
2. surface MCP state and failures in the UI
3. provide pack-level templates, presets, or recipes
4. optionally generate config stubs
5. avoid owning the lifetime of every MCP server in v1

This lines up well with `t3code`, which already has MCP-related event types in its contracts and provider adapters.

## Is `skills + a c-glass exclusive cli.ts script` a Good Idea?

Yes, with one adjustment: the `cli.ts` should be a stable app-owned command surface, not an ad hoc escape hatch.

This is probably the strongest short-term pattern.

### Recommended Split

1. Skills explain when and why to use a feature.
2. The CLI performs real work.
3. The web app renders results nicely.
4. Harness adapters decide how that feature is exposed to each harness.

### Why This Works Well

1. Skills are good at progressive disclosure.
2. A CLI gives you deterministic behavior and a stable interface.
3. The same CLI can be called from Pi, Codex, Claude Code, tests, and future automation.
4. It reduces the need for per-harness custom code.

### Important Constraint

Do not make the skill itself the executable system.

Instead:

1. the skill documents usage
2. the CLI does the work
3. a harness tool or command invokes the CLI

## Should That CLI Use `just-bash`?

Maybe, but it should not be the default assumption.

### When `just-bash` Makes Sense

From the current npm docs, `just-bash` is a TypeScript bash environment with an in-memory writable filesystem and optional network controls.

That is attractive if Glass wants:

1. a safer shell-like execution environment
2. deterministic script behavior
3. temporary writes that do not touch the real repo by default
4. custom app-owned shell commands

### When `just-bash` Is Probably the Wrong Default

1. if the feature needs real filesystem side effects
2. if the feature is really just a normal Node command
3. if Glass already has real bash access through the harness
4. if adding a simulated shell creates two competing shell semantics in the product

### Recommendation on `just-bash`

Start simpler.

1. Build a normal Node CLI first.
2. Make it accept JSON or structured subcommands.
3. Call it from harness tools or shell commands.
4. Introduce `just-bash` later only if Glass specifically needs sandboxed shell semantics.

For most product features, a plain Node CLI will be easier to reason about than a second shell runtime.

## Best Near-Term Architecture

### Layer 1: Harness Adapters

Use `t3code`'s model.

Each harness adapter should own:

1. process lifecycle
2. provider-native protocol handling
3. canonical event translation
4. interactive request mapping
5. capability reporting

### Layer 2: Glass Capability Packs

Each capability pack should describe:

1. what the feature is
2. which harnesses it supports
3. which UI renderers it adds
4. which skills it contributes
5. which commands or CLI bindings it exposes

### Layer 3: Renderer Registry

Borrow from `pi-mono/web-ui`.

Have a registry for:

1. tool-call renderers
2. tool-result renderers
3. artifact viewers
4. settings panels where needed

### Layer 4: Skills

Use skills for:

1. domain workflows
2. workspace-specific procedures
3. discoverability
4. reusable operator guidance

Do not use skills as the runtime plugin system.

### Layer 5: Project CLI

Add a narrow command surface such as:

1. `glass feature <name>`
2. `glass tool <name>`
3. `glass ext <pack> <action>`

The key requirement is stability, not the exact name.

## What Not To Do

1. Do not make Pi extensions the main plugin API for Codex and Claude harnesses.
2. Do not assume Pi custom extension UI is portable into Glass.
3. Do not bundle a large set of MCP servers into the app as the initial extension strategy.
4. Do not make skills responsible for executable behavior beyond invoking stable tools or scripts.
5. Do not couple the new extension model to the current Pi-only desktop runtime if the rewrite is already moving toward `t3code`.

## Recommended Decision

Glass should adopt this policy:

1. `t3code` infrastructure is the runtime and harness backbone.
2. Glass capability packs are the cross-harness extension model.
3. Pi extensions are supported only as Pi-harness-specific adapters.
4. Skills are encouraged as the discovery and workflow layer.
5. A small Glass-owned CLI is the preferred executable surface for project-specific features.
6. MCP should be supported as external configuration, not aggressively bundled.

## Concrete First Iteration

A realistic first iteration would be:

1. Finish the `t3code`-style server and harness migration first.
2. Add a renderer registry inspired by `pi-mono/web-ui`.
3. Define a minimal capability-pack manifest.
4. Let packs contribute skills and slash commands.
5. Add one small Glass-owned CLI surface for structured actions.
6. Keep Pi extension support only on the Pi harness path during the transition.

## Bottom Line

If the goal is "use default harnesses like Claude and Codex app-server, but still add special things," then the right answer is not "make every harness behave like Pi."

The right answer is:

1. let harnesses stay harness-native
2. normalize them through a Glass-owned runtime layer
3. add app-owned capability packs above that layer
4. use skills for guidance
5. use a stable CLI or tool surface for real execution

That gives Glass a Pi-like authoring experience without locking the product to Pi's runtime model.

## Source Notes

Local repo files inspected:

1. `plans/codex-app-server-first.md`
2. `apps/desktop/src/main.ts`
3. `apps/desktop/src/preload.ts`
4. `apps/desktop/src/pi-config-service.ts`
5. `apps/desktop/src/pi-runtime/pi-runtime-worker.ts`
6. `apps/desktop/src/ext-ui-bridge.ts`
7. `apps/web/src/components/settings/settings-panels.tsx`
8. `packages/contracts/src/harness.ts`
9. `packages/contracts/src/pi.ts`
10. `packages/contracts/src/session.ts`

External sources inspected:

1. `pingdotgg/t3code` `AGENTS.md`
2. `pingdotgg/t3code` `apps/server/src/provider/Services/ProviderAdapter.ts`
3. `pingdotgg/t3code` `apps/server/src/provider/Layers/ProviderAdapterRegistry.ts`
4. `pingdotgg/t3code` `apps/server/src/provider/Layers/ProviderService.ts`
5. `pingdotgg/t3code` `packages/contracts/src/providerRuntime.ts`
6. `badlogic/pi-mono` `packages/web-ui/README.md`
7. `badlogic/pi-mono` `packages/web-ui/src/ChatPanel.ts`
8. Pi docs `docs/extensions.md`, `docs/skills.md`, `docs/custom-provider.md`
9. Pi examples `examples/sdk/06-extensions.ts`, `examples/sdk/04-skills.ts`
10. Pi examples `examples/extensions/dynamic-resources/index.ts`, `examples/extensions/bash-spawn-hook.ts`, `examples/extensions/inline-bash.ts`
