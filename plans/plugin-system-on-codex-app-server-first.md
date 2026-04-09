# Plugin System On Top Of Codex App-Server First

Date: 2026-04-07
Status: proposal
Depends on: `plans/codex-app-server-first.md`

## Goal

Define a Glass plugin and extension system that fits the `Codex app-server first` migration instead of fighting it.

This proposal assumes the migration plan remains unchanged:

1. `t3code` remains the source of truth for server, contracts, transport, and orchestration flow.
2. Desktop stays thin.
3. Web talks to the backend over the new native WebSocket API.
4. Pi-era runtime ownership goes away.

The plugin system therefore must be built on top of:

1. the new `apps/server`
2. canonical orchestration events
3. app-owned server settings
4. app-owned web registries

It must not depend on:

1. the old Pi runtime worker
2. Electron IPC as the main business-logic transport
3. Pi extension APIs as the cross-harness abstraction

## The Core Design

Glass should have a two-layer extension model.

### Layer 1: Harness Adapters

Harness adapters are the runtime foundation.

They are not plugins in the product sense. They are infrastructure.

Examples:

1. Codex app-server adapter
2. Claude adapter
3. future Pi adapter, if kept at all
4. future local or enterprise adapters

This layer should continue to follow `t3code` boundaries.

### Layer 2: Capability Packs

Capability packs are the real product extension unit.

A capability pack is a Glass-owned package of behavior and UI contributions that runs above canonical orchestration, not inside provider-native protocols.

A pack can contribute:

1. slash commands
2. skills
3. settings metadata
4. thread actions
5. activity or tool renderer hints
6. workspace automation via a CLI or script
7. optional server-side hooks
8. optional harness-specific bindings

This is the layer that replaces the current Pi-centric idea of "extensions".

## Why This Split Fits The Migration

`plans/codex-app-server-first.md` makes three boundaries explicit:

1. runtime logic moves into `apps/server`
2. desktop should stop owning provider logic
3. web should consume canonical state from the backend

That means the extension system must follow the same boundaries.

If Glass instead copied Pi's extension model directly, it would have these problems:

1. Pi extensions are only meaningful inside the Pi harness path.
2. Pi's full extension UI API is TUI-oriented and not a good cross-harness GUI contract.
3. the migration plan explicitly removes Pi-first runtime code.
4. Codex and Claude do not expose Pi's extension lifecycle or tool APIs.

So the Glass extension system must be built above the harness layer, not inside one specific harness runtime.

## Non-Negotiable Rules

These rules keep the plugin system compatible with the migration plan.

1. Do not add plugin logic to `apps/desktop` beyond opening plugin settings or OS dialogs.
2. Do not patch copied `t3code` provider adapters as the primary extension point.
3. Do not make capability packs provider-native first. Make them orchestration-native first.
4. Do not ship arbitrary workspace frontend code in v1.
5. Do not use Pi extension APIs as the product-level plugin API.
6. Do not bundle MCP servers into the app as the default plugin strategy.
7. Do not create a second transport path parallel to `nativeApi.ts` and `wsNativeApi.ts`.

## Where The Plugin System Lives

### Contracts

Add new Glass-specific contracts after the `t3code` baseline lands.

Suggested file:

1. `packages/contracts/src/extensions.ts`

Suggested types:

1. `ExtensionScope`
2. `ExtensionManifest`
3. `ExtensionDescriptor`
4. `ExtensionCapability`
5. `ExtensionCommand`
6. `ExtensionSkill`
7. `ExtensionAction`
8. `ExtensionSettingsState`
9. `ExtensionCatalogSnapshot`
10. `ExtensionUiContribution`

These are additive. They should not change `t3code` files except for index exports and any required RPC method registration.

### Server

Create a new additive directory in the server app.

Suggested path:

1. `apps/server/src/extensions/`

Suggested services:

1. `Services/ExtensionRegistry.ts`
2. `Services/ExtensionHost.ts`
3. `Services/ExtensionCatalog.ts`
4. `Services/ExtensionSettings.ts`
5. `Services/ExtensionActionRunner.ts`
6. `Services/PackDiscovery.ts`

Suggested layers:

1. `Layers/ExtensionRegistry.ts`
2. `Layers/ExtensionHost.ts`
3. `Layers/ExtensionCatalog.ts`
4. `Layers/ExtensionSettings.ts`
5. `Layers/ExtensionActionRunner.ts`

These services should be wired beside orchestration and provider services, not inside provider adapters.

### Web

Create a new additive directory in the web app.

Suggested path:

1. `apps/web/src/extensions/`

Suggested modules:

1. `extensionCatalog.ts`
2. `extensionRegistry.ts`
3. `extensionRenderers.ts`
4. `extensionSettings.ts`
5. `extensionSlashItems.ts`

These modules should consume extension metadata from the server and join it with app-bundled renderers.

## Discovery Model

Glass should use its own discovery model.

Suggested locations:

1. `~/.glass/extensions/`
2. `.glass/extensions/`
3. directories listed in Glass settings
4. package manifests via `package.json#glass.extensions`

Recommended naming:

1. use `extensions` in the UI
2. use `capability pack` or `pack` as the implementation term
3. avoid reusing `.pi/extensions`

This keeps the product vocabulary consistent with the migration away from Pi.

## Pack Format

A capability pack should be mostly declarative in v1.

Suggested structure:

1. `glass.extension.json`
2. `skills/`
3. `server/`
4. `cli/`
5. `assets/`
6. optional `templates/` for MCP or config snippets

Example conceptual structure:

1. `glass.extension.json` for metadata and contributions
2. `skills/*.md` for workflow guidance
3. `server/index.js` or `server/index.ts` for optional backend hooks
4. `cli/index.js` or a package command for real execution
5. `templates/*.json` for generated config snippets

## V1 Manifest Scope

In v1, the manifest should describe contributions that are safe and easy to transport.

Suggested fields:

1. `name`
2. `version`
3. `description`
4. `scope`
5. `enabledByDefault`
6. `supports`
7. `skills`
8. `commands`
9. `actions`
10. `settings`
11. `rendererKeys`
12. `cli`
13. `mcpTemplates`

### `supports`

This should declare compatibility with harnesses and app surfaces.

Example conceptual values:

1. `harnesses: ["codex", "claudeCode"]`
2. `requiresInteractive: true`
3. `requiresWorkspace: true`
4. `requiresCli: true`

### `commands`

These are slash-menu or quick-action entries.

They should be declarative and route to a stable action ID, not to arbitrary UI code.

### `actions`

These are structured server actions.

Each action should define:

1. action ID
2. label
3. input schema reference
4. execution mode
5. thread or workspace scope

### `rendererKeys`

These should point to app-bundled renderer implementations.

This avoids loading arbitrary React or browser code from untrusted plugin folders in v1.

## The Execution Model

Capability packs should not execute directly in the browser in v1.

Instead, they should execute through the server.

### Recommended Execution Modes

1. `builtin` for server-implemented features
2. `cli` for project-owned commands
3. `hook` for server-side plugin callbacks
4. `template` for generated config or files

### Why CLI Matters

A project-owned CLI is the cleanest stable execution surface.

It works well with the migration because:

1. it is harness-agnostic
2. it can be called from server actions
3. it can be reused by skills
4. it can be tested independently of the UI
5. it keeps logic out of the browser bundle

## Recommended CLI Policy

Glass should have a stable command surface.

Suggested commands:

1. `glass ext run <action>`
2. `glass feature <name>`
3. `glass skill <name>`
4. `glass mcp init <template>`

The exact naming can vary, but the important thing is that the CLI becomes the durable execution contract for packs.

## Skills In This System

Skills should sit above capability packs, not replace them.

A skill should:

1. explain when to use a pack
2. explain what command or action to invoke
3. describe setup and expected outputs
4. link to templates, scripts, and workflows

A skill should not be the runtime host.

This gives the model a progressive-disclosure layer without making markdown files responsible for business logic.

## Server Hook Model

V1 should keep hooks narrow.

Do not let packs intercept everything immediately.

Start with these hook points:

1. `server.start`
2. `thread.created`
3. `thread.selected`
4. `turn.started`
5. `turn.completed`
6. `request.opened`
7. `request.resolved`
8. `activity.appended`

These hooks should be based on canonical orchestration events, not provider-native internals.

### Why Canonical Hooks Matter

If hooks attach directly to Codex or Claude internals, every new harness multiplies the plugin surface.

If hooks attach to canonical orchestration events, packs work across harnesses by default.

That is the key architectural win.

## The Renderer Model

The web app should use a registry, inspired by `pi-mono/packages/web-ui`, but owned by Glass.

### Registry Responsibilities

1. map `rendererKey` to a bundled renderer
2. render activity cards
3. render tool summaries
4. render approval or input request surfaces
5. render pack settings rows

### What Packs Can Influence In V1

1. choose a known renderer key
2. provide metadata for labels and summaries
3. provide artifacts or payloads the renderer knows how to display

### What Packs Should Not Do In V1

1. load arbitrary browser code from disk
2. inject compiled React components dynamically
3. own routing or global app shell UI

This keeps the build, security, and packaging story sane during the rewrite.

## Slash Commands

Glass already has a slash registry model in `apps/web/src/components/glass/slash-registry.ts`.

The new plugin system should reuse that idea, but stop treating extension commands as second-class.

Current local behavior filters remote commands with `source !== "extension"`.

In the new system:

1. extension commands should be first-class server catalog items
2. they should be merged into the slash registry intentionally
3. they should route to server actions or CLI actions
4. they should be grouped by pack and capability

Suggested source values in the new world:

1. `app`
2. `skill`
3. `extension`
4. `system`

## Settings UI

The current settings UI already has two useful ideas:

1. harnesses are first-class
2. extensions are first-class

After the migration, the extension settings screen should be redefined.

### Replace The Old Pi Extensions Panel

Current panel meaning:

1. discovered Pi extensions
2. Pi extension errors
3. Pi-specific enable or disable state

New panel meaning:

1. discovered Glass capability packs
2. enabled or disabled state
3. harness compatibility
4. command and skill contributions
5. setup status
6. errors from discovery or execution

This should be backed by server state, not desktop Pi config state.

## MCP Strategy

MCP should be a supported target, not the core plugin runtime.

### What Packs Can Do With MCP

A pack may contribute:

1. an `mcp.json` template
2. install instructions
3. environment-variable docs
4. a server action that scaffolds config
5. UI that surfaces MCP health if the canonical runtime emits it

### What Packs Should Not Do In V1

1. embed and supervise long-lived MCP servers by default
2. make Glass responsible for every external server process
3. create a second independent transport stack

The migration plan is already large enough. MCP should remain an integration target, not the skeleton of the plugin system.

## The Server API Surface

The plugin system should use the same `nativeApi` and `wsNativeApi` path as the rest of the app.

Suggested additions:

1. `extensions.list`
2. `extensions.getCatalog`
3. `extensions.setEnabled`
4. `extensions.runAction`
5. `extensions.getLogs`
6. `extensions.getSettings`
7. `extensions.setSettings`
8. `extensions.subscribeCatalog`

Do not create a plugin-only transport.

## Storage And State

Pack state should be stored server-side.

Recommended ownership:

1. global enable or disable state in server settings
2. project enable or disable state in workspace settings
3. per-thread state in orchestration or persistence if needed
4. pack execution logs in server-owned logs or activity streams

Desktop should not own this state.

## Rollout Plan Aligned To The Migration

### During Phase 1

Do nothing plugin-specific beyond preserving the idea that harnesses and extensions exist in the UI vocabulary.

### During Phase 2

After `apps/server` exists:

1. add `packages/contracts/src/extensions.ts`
2. add `apps/server/src/extensions/` registry and discovery services
3. add a minimal catalog endpoint over WebSocket RPC
4. keep packs declarative only at first

This is the earliest safe point.

### During Phase 3

When desktop becomes thin:

1. move all extension discovery and enable state into server settings
2. remove desktop-owned Pi extension discovery from the product path
3. keep desktop limited to native dialogs if a pack action requires them

### During Phase 4

When web moves to `nativeApi.ts`:

1. add catalog subscription to the web app
2. add extension commands to slash menu data
3. add a new extension settings page backed by server catalog
4. add renderer registry support for pack renderer keys

### During Phase 5

Once the main chat UI is on the new domain model:

1. render pack activities and action results inline in Glass chat UI
2. support pack-specific thread actions
3. support skill surfacing from packs in the composer and slash menu

### During Phase 6

After Pi runtime removal:

1. remove the old Pi extension settings model from the product surface
2. keep only Glass capability packs as the cross-harness extension system
3. if a Pi harness survives, treat Pi extensions as an adapter-specific extra, not the main feature

## V1 Scope Recommendation

Keep v1 small.

V1 should include only:

1. discovery
2. enable or disable state
3. slash commands
4. skills
5. structured server actions
6. CLI-backed actions
7. bundled renderer keys
8. settings UI

V1 should not include:

1. arbitrary frontend code loading
2. full provider-payload interception
3. dynamic route injection
4. app-shell replacement
5. packaged MCP server orchestration
6. TUI-like custom component APIs

## V2 Opportunities

After the migration is stable, Glass can consider:

1. signed or trusted npm-based packs
2. richer hook points around orchestration reactions
3. custom renderer packages
4. pack-defined artifacts panels
5. better MCP lifecycle support
6. enterprise provider or auth packs

But these should come after the server-first rewrite lands cleanly.

## Minimal Example Mental Model

A pack named `workspace-bootstrap` could contribute:

1. a slash command `/bootstrap`
2. a skill explaining when to run bootstrap
3. an action `workspace.bootstrap`
4. a CLI mapping to `glass ext run workspace.bootstrap`
5. a renderer key `setup-script-status`
6. a settings row for default target environment

The server would:

1. discover the pack
2. expose it through `extensions.getCatalog`
3. run its CLI or builtin action when invoked
4. append canonical thread activity entries

The web would:

1. show `/bootstrap` in the slash menu
2. show the skill in the skills section
3. render resulting activity with the `setup-script-status` renderer
4. show pack settings in the extension settings page

This is simple, testable, and aligned with the migration.

## Bottom Line

If Glass follows `plans/codex-app-server-first.md`, then the plugin system should be:

1. server-first
2. orchestration-native
3. desktop-thin
4. web-registry-driven
5. CLI-friendly
6. skills-assisted
7. MCP-aware, but not MCP-built

In practical terms:

1. build harness support with `t3code`
2. add Glass capability packs above it
3. use server actions and a stable CLI for execution
4. use skills for discovery
5. use app-bundled renderers for UI

That gives Glass an extension system that survives the rewrite instead of being another Pi-era compatibility layer.
