# Release checklist

Glass desktop releases are driven by [`.github/workflows/release.yml`](../.github/workflows/release.yml). This document summarizes behavior and signing setup; it is adapted from [t3code `docs/release.md`](https://github.com/pingdotgg/t3code/blob/main/docs/release.md) for **this** repo.

## What the workflow does

- **Trigger:** push a tag matching `v*.*.*`, or **workflow_dispatch** with a version string.
- **Preflight** (`ubuntu-24.04`): `pnpm install`, `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`.
- **Build matrix:** macOS **arm64** and macOS **x64** DMG artifacts via `pnpm run build:desktop` and `pnpm run dist:desktop:artifact`.
- **Release:** `softprops/action-gh-release` publishes `Glass v{version}` with DMG, zip, blockmaps, and `latest*.yml` updater metadata (the workflow file also allows `AppImage` / `exe` assets if those builds are added later).
- **Prerelease:** versions that are not plain `X.Y.Z` (for example `1.2.3-alpha.1`) are published as GitHub prereleases; plain semver is `make_latest`.
- **Finalize:** a GitHub App token bumps package versions on `main` (`scripts/update-release-package-versions.ts`) when needed.

Apple signing is **optional**: if all Apple-related secrets are present, `dist:desktop:artifact` runs with `--signed`; otherwise the workflow logs that signing is disabled and still produces unsigned artifacts.

> **Note:** The upstream t3code release pipeline also publishes an npm CLI package. The current Glass workflow does **not** include npm publishing; add a job if you need `@glass/server` (or another package) released to a registry.

## Desktop auto-update

- **Runtime:** `electron-updater` in `apps/desktop/src/main.ts`.
- **Behavior:** no automatic download or install; the UI drives check, download, and restart.
- **Feed:** baked `app-update.yml` / `dev-app-update.yml` (GitHub provider when configured at build time).
- **Private repos / API auth:** set `GLASS_DESKTOP_UPDATE_GITHUB_TOKEN` or `GH_TOKEN` so the updater can use the GitHub API with `private: true`.
- **Mock updates:** `GLASS_DESKTOP_MOCK_UPDATES` with optional `GLASS_DESKTOP_MOCK_UPDATE_SERVER_PORT` for local testing.

Required release assets for real updates generally include platform installers, `latest*.yml`, and `*.blockmap` files (differential downloads). macOS Intel vs Apple Silicon manifests are merged before publish (`scripts/merge-mac-update-manifests.ts`).

## Dry run without signing

1. Ensure Apple signing secrets are empty in the fork (or use a repo without them).
2. Create a test tag, for example `v0.0.0-test.1`, and push it (or use workflow_dispatch).
3. Confirm the GitHub Release lists the expected macOS artifacts.
4. Install and smoke-test.

## Apple signing and notarization (macOS)

Secrets read by the workflow (same names as common electron-builder setups):

- `CSC_LINK` — base64 `.p12`
- `CSC_KEY_PASSWORD`
- `APPLE_API_KEY` — raw `.p8` contents
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

High-level checklist:

1. Developer ID Application certificate; export `.p12`, base64 → `CSC_LINK`, password → `CSC_KEY_PASSWORD`.
2. App Store Connect API key → `APPLE_API_*`.
3. Re-run a tag build; confirm signed + notarized DMGs.

The workflow writes `APPLE_API_KEY` to a temporary `AuthKey_*.p8` path for notarization tooling.

## Ongoing release checklist

1. Confirm `main` is green in CI (`ci.yml`).
2. Merge what you intend to ship.
3. Tag `vX.Y.Z` (or dispatch the workflow).
4. Verify preflight, both mac builds, and the published GitHub Release.
5. Smoke-test downloads; confirm auto-update metadata if applicable.

## Troubleshooting

- **Unsigned mac build when you expected signing:** verify every Apple secret is set and non-empty in the repository secrets used by the workflow.
- **Build fails in signing step:** retry with secrets removed to confirm the unsigned path; re-check certificate and API key values.
- **Updater cannot see releases:** confirm `app-update.yml` owner/repo, asset names, and that private-repo tokens are set when using the GitHub API path.
