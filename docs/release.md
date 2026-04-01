# Release Checklist

This document covers how to run desktop releases from one tag, first without signing, then with signing.

## What the workflow does

- Trigger: push tag matching `v*.*.*`.
- Runs quality gates first: lint, typecheck, test.
- Builds four artifacts in parallel:
  - macOS `arm64` DMG
  - macOS `x64` DMG
  - Linux `x64` AppImage
  - Windows `x64` NSIS installer
- Publishes one GitHub Release with all produced files.
  - Versions with a suffix after `X.Y.Z` (for example `1.2.3-alpha.1`) are published as GitHub prereleases.
  - Only plain `X.Y.Z` releases are marked as the repository's latest release.
- Includes Electron auto-update metadata (for example `latest*.yml` and `*.blockmap`) in release assets.
- Publishes the CLI package (`apps/server`, npm package `@glass/server`, binary `glass`) with OIDC trusted publishing.
- Signing is optional and auto-detected per platform from secrets.

## Desktop auto-update notes

- Runtime updater: `electron-updater` in `apps/desktop/src/main.ts`.
- Update UX:
  - Background checks run on startup delay + interval.
  - No automatic download or install.
  - The desktop UI shows a rocket update button when an update is available; click once to download, click again after download to restart/install.
- Provider: GitHub Releases (`provider: github`) configured at build time.
- Repository slug source:
  - `GLASS_DESKTOP_UPDATE_REPOSITORY` (format `owner/repo`), if set.
  - otherwise `GITHUB_REPOSITORY` from GitHub Actions.
- Temporary private-repo auth workaround:
  - set `GLASS_DESKTOP_UPDATE_GITHUB_TOKEN` (or `GH_TOKEN`) in the desktop app runtime environment.
  - the app forwards it as an `Authorization: Bearer <token>` request header for updater HTTP calls.
- Required release assets for updater:
  - platform installers (`.exe`, `.dmg`, `.AppImage`, plus macOS `.zip` for Squirrel.Mac update payloads)
  - `latest*.yml` metadata
  - `*.blockmap` files (used for differential downloads)
- macOS metadata note:
  - `electron-updater` reads `latest-mac.yml` for both Intel and Apple Silicon.
  - The workflow merges the per-arch mac manifests into one `latest-mac.yml` before publishing the GitHub Release.

### Local mock updates (development)

Updates only run in **packaged** builds (`getAutoUpdateDisabledReason` rejects dev / unpackaged).

1. **Serve update metadata and binaries** from the repo root:

   ```bash
   bun run start:mock-update-server
   ```

   Default URL: `http://localhost:3000`. Override port with `GLASS_DESKTOP_MOCK_UPDATE_SERVER_PORT`.  
   Default static root: `release-mock/` (override with `GLASS_DESKTOP_MOCK_UPDATE_SERVER_ROOT`). Paths map as `GET /latest-mac.yml` → `release-mock/latest-mac.yml`.

2. **Fill `release-mock/`** with a **newer** build than the app you will launch:
   - Run `bun run dist:desktop:dmg:arm64` (or your platform; see `package.json` `dist:desktop:*` and `scripts/build-desktop-artifact.ts`).
   - Copy from the artifact output directory into `release-mock/`: `latest-mac.yml`, the `.zip` and `.dmg` (and `.blockmap` files) listed in that YAML. Names follow `Glass-${version}-${arch}.${ext}`.
   - On macOS, Squirrel.Mac validates code requirements during install. Local mock auto-updates only work when both the installed app and the newer build are signed with the same identity. Unsigned or ad-hoc local builds can download successfully but will be rejected at install time.

3. **Install an older packaged app** (lower semver than the YAML `version:`), or build once with a lower `GLASS_DESKTOP_VERSION` / `apps/desktop` version.

4. **Launch the older app** with mock feed (overrides GitHub and points `electron-updater` at the generic server):

   ```bash
   GLASS_DESKTOP_MOCK_UPDATES=1 open /path/to/Glass.app
   ```

   Match the mock server port if not `3000`: set `GLASS_DESKTOP_MOCK_UPDATE_SERVER_PORT` to the same value when starting the server and when launching the app.

5. **Optional:** build with `--mock-updates` so `app-update.yml` already references `http://localhost:<port>` (see `scripts/build-desktop-artifact.ts` `createBuildConfig`). You still need `GLASS_DESKTOP_MOCK_UPDATES=1` at runtime if you want to force the mock feed over a GitHub publish config.

## 0) npm OIDC trusted publishing setup (CLI)

The workflow publishes the CLI with `bun publish` from `apps/server` after bumping
the package version to the release tag version.

Checklist:

1. Confirm npm org/user owns package `@glass/server` (or publish under your scoped org first if needed).
2. In npm package settings, configure Trusted Publisher:
   - Provider: GitHub Actions
   - Repository: this repo
   - Workflow file: `.github/workflows/release.yml`
   - Environment (if used): match your npm trusted publishing config
3. Ensure npm account and org policies allow trusted publishing for the package.
4. Create release tag `vX.Y.Z` and push; workflow will:
   - set `apps/server/package.json` version to `X.Y.Z`
   - build web + server
   - run `bun publish --access public`

## 1) Dry-run release without signing

Use this first to validate the release pipeline.

1. Confirm no signing secrets are required for this test.
2. Create a test tag:
   - `git tag v0.0.0-test.1`
   - `git push origin v0.0.0-test.1`
3. Wait for `.github/workflows/release.yml` to finish.
4. Verify the GitHub Release contains all platform artifacts.
5. Download each artifact and sanity-check installation on each OS.

## 2) Apple signing + notarization setup (macOS)

Required secrets used by the workflow:

- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_API_KEY`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`

Checklist:

1. Apple Developer account access:
   - Team has rights to create Developer ID certificates.
2. Create `Developer ID Application` certificate.
3. Export certificate + private key as `.p12` from Keychain.
4. Base64-encode the `.p12` and store as `CSC_LINK`.
5. Store the `.p12` export password as `CSC_KEY_PASSWORD`.
6. In App Store Connect, create an API key (Team key).
7. Add API key values:
   - `APPLE_API_KEY`: contents of the downloaded `.p8`
   - `APPLE_API_KEY_ID`: Key ID
   - `APPLE_API_ISSUER`: Issuer ID
8. Re-run a tag release and confirm macOS artifacts are signed/notarized.

Notes:

- `APPLE_API_KEY` is stored as raw key text in secrets.
- The workflow writes it to a temporary `AuthKey_<id>.p8` file at runtime.

## 3) Azure Trusted Signing setup (Windows)

Required secrets used by the workflow:

- `AZURE_TENANT_ID`
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TRUSTED_SIGNING_ENDPOINT`
- `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME`
- `AZURE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME`
- `AZURE_TRUSTED_SIGNING_PUBLISHER_NAME`

Checklist:

1. Create Azure Trusted Signing account and certificate profile.
2. Record ATS values:
   - Endpoint
   - Account name
   - Certificate profile name
   - Publisher name
3. Create/choose an Entra app registration (service principal).
4. Grant service principal permissions required by Trusted Signing.
5. Create a client secret for the service principal.
6. Add Azure secrets listed above in GitHub Actions secrets.
7. Re-run a tag release and confirm Windows installer is signed.

## 4) Ongoing release checklist

1. Ensure `main` is green in CI.
2. Bump app version as needed.
3. Create release tag: `vX.Y.Z`.
4. Push tag.
5. Verify workflow steps:
   - preflight passes
   - all matrix builds pass
   - release job uploads expected files
6. Smoke test downloaded artifacts.

## 5) Troubleshooting

- macOS build unsigned when expected signed:
  - Check all Apple secrets are populated and non-empty.
- Windows build unsigned when expected signed:
  - Check all Azure ATS and auth secrets are populated and non-empty.
- Build fails with signing error:
  - Retry with secrets removed to confirm unsigned path still works.
  - Re-check certificate/profile names and tenant/client credentials.
