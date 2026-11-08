# @groot/shell

## 3.0.0

### Major Changes

- [#165](https://github.com/AshikNesin/groot/pull/165) [`d58c2a8`](https://github.com/AshikNesin/groot/commit/d58c2a833a71bf8047b257f9bc9e9336a3cebd80) Thanks [@AshikNesin](https://github.com/AshikNesin)! - feat(shell): one storage browser module, `useStorageBrowser()`
  
  The Storage page's state and handlers lived in `useStorageActions()`, which
  returned 25 members to its one caller, and had two bugs: the file selection
  was cleared only when the page itself navigated, so after a link reset
  `?path` "Delete N files?" deleted files from a folder no longer on screen; and
  a single-file delete neither confirmed nor left the selection.
  
  - `useStorageBrowser({ onView? })` (`@groot/shell/pages/storage/hooks/useStorageBrowser`)
    returns `{ files, isLoading, path, crumbs, selection, dialog, actions, fileActions, pending }`.
    The selection is derived from the listing on screen and forgotten on a
    folder change. Every operation runs through `useAction`, so each confirms
    (single-file delete included), toasts and invalidates the same way.
  - `fileActions(file)` is one list of actions that `DesktopFileRow` and
    `MobileFileCard` both render: the mobile card gains Rename and Delete for
    files. Both rows now take `actions` (and `onToggle`, `onNavigate`) instead
    of one callback per action; their checkboxes are labelled `Select <name>`.
  - `useStorage.ts` gains `storageKeys`, `storageApi`, `downloadFile` and
    `viewFile` (they reject instead of toasting); blob handling left the row
    components.
  - Deprecated: `useStorageActions()` (now a wrapper over the browser; its
    `createFolder` and `renameFile` members carry only `isPending`) and
    `handleDownload` / `handleView`.

### Minor Changes

- [#165](https://github.com/AshikNesin/groot/pull/165) [`b3039be`](https://github.com/AshikNesin/groot/commit/b3039befd01979bcdc9f655fcf41e55a47a8e879) Thanks [@AshikNesin](https://github.com/AshikNesin)! - fix(settings): adding an existing setting no longer wipes its value; drafts survive refetches
  
  "Add setting" saved `{}` through the `PUT` upsert, so adding a key that
  already existed replaced its value. The settings page also replaced unsaved
  edits whenever a refetch brought a new server value, and switching settings
  dropped a dirty draft without a word.
  
  - `@groot/core`: `POST /api/v1/settings` (`{ key, value, metadata? }`)
    creates a setting and answers 409 for a key that exists; `PUT` keeps its
    upsert semantics for saving. It writes through the new `KvStore.add(key,
    value, ttlMs?)`, an insert-only write in one statement that resolves false
    when a live entry holds the key.
  - `@groot/shell`: `useAppSettingsData()` is the data (settings, `get`, `save`,
    `create`, `remove`); `create` refuses a key the list holds without a
    request. `useSettingDraft(setting)` is one editor draft with `isDirty`,
    `serverChanged`, `discard()` and `parse()`: a refetch leaves a dirty draft
    alone, and `AppSettings` asks before leaving one. `useAppSettings()` keeps
    its shape on top of the two and is deprecated.

- [#165](https://github.com/AshikNesin/groot/pull/165) [`3541799`](https://github.com/AshikNesin/groot/commit/35417995eefbaddbd0f8bc3b0591b8c3c20f8818) Thanks [@AshikNesin](https://github.com/AshikNesin)! - feat(shell): one mutation-feedback module, `@groot/shell/lib/feedback`
  
  Four idioms for "run, toast, invalidate" worded the same failure four ways:
  a fixed "Unable to update setting" hid "Invalid JSON format", the jobs
  dashboard showed "Bad Gateway", "Failed to fetch" or a raw `SyntaxError`, and
  WebAuthn errors were worded twice. Now:
  
  - `describeError(error, fallback)` words every failure once: the server's
    envelope message (`ApiError.fromServer`), an offline sentence for a request
    that never left (`NetworkError`, which `apiClient` now throws, or a `fetch`
    `TypeError`), a row of the one WebAuthn table (`WEBAUTHN_MESSAGES`,
    `describeWebAuthnError`), the message of a plain `Error` the action threw,
    else the fallback.
  - `useAction(action, { confirm?, success?, errorTitle?, fallback, invalidate?, onSuccess? })`
    returns `{ run, isPending }`: it confirms, runs once at a time, toasts and
    awaits the invalidations. `toastError` and `toastSuccess` are the toasts on
    their own.
  - `PasskeyManager`, the settings page, the jobs dashboard (`useJobActions`,
    `AddJobDialog`, `ScheduleJobDialog`, `ScheduledJobsPanel`) and the Todos
    reference page use it. `useJobActions()` also returns `isPending`.
  - `loginErrorDescription` is a 401 wrapper over `describeError`; a status-line
    `ApiError` (not from the server) now reads as the fallback.
  - New `parseJobData(text)` in `@groot/jobs/client/utils` refuses a payload
    that is not JSON with a sentence.
  - Deprecated: `useToastMutation` and `withJobToast`; both keep working and
    now word errors with `describeError`.

- [#165](https://github.com/AshikNesin/groot/pull/165) [`82718e6`](https://github.com/AshikNesin/groot/commit/82718e6c579bae0269f16d42f4e2a74c4ecdde3b) Thanks [@AshikNesin](https://github.com/AshikNesin)! - feat(ui): one hotkeys module, `@groot/ui/hotkeys`, with one precedence
  
  - **`@groot/ui/hotkeys`** holds the shortcut grammar (`parseShortcut`,
    `matchesShortcut`, `hasModifier`, `formatShortcut`, `isMacPlatform`,
    `useIsMac`), one `isEditable`, `isDialogOpen` and
    `useHotkey(combo, handler, { scope?, inFields?, open?, within?, enabled? })`.
    All hotkeys share one window listener, and a press runs one handler: a
    `"dialog"` hotkey whose dialog is open answers first (so ⌘K closes the
    palette); while any dialog is open nothing else answers; otherwise a
    `"dialog"` hotkey beats a `"global"` one and the most recently bound wins.
    `@groot/ui/command-menu` re-exports the grammar, so its imports keep
    working, and `CommandMenuDialog` binds its combo through `useHotkey`.
  - **`@groot/shell`: nav shortcuts stand down behind dialogs.** A
    `NavDestination.shortcut` is a global hotkey: `mod+,` no longer navigates
    behind the open ⌘K palette or any other open dialog, and a nav shortcut on
    the palette's own combo no longer fires alongside it. The settings search's
    `/` uses the same module.
  - **`@groot/shell`: `isNavActive(pathname, to)`** (`@groot/shell/lib/shell-config`)
    is the one "is this nav destination active" check; the sidebar and
    `Layout`'s full-page test use it.
  - **`@groot/shell`: `ThemeMenu`** (`@groot/shell/components/Layout`) is
    deprecated: nothing renders it (Theme lives in Settings › Appearance and the
    ⌘K Theme group). It is removed in the next major.

- [#165](https://github.com/AshikNesin/groot/pull/165) [`090e53c`](https://github.com/AshikNesin/groot/commit/090e53cd85acbd6cd9f755c96ead35b4d559596f) Thanks [@AshikNesin](https://github.com/AshikNesin)! - fix(shell): reset the React Query cache on every session change
  
  Query keys (`["passkeys"]`, `["app-settings"]`, `["todos"]`) say nothing about
  the user, so after one account signed out and another signed in within the
  5-minute `staleTime`, the second was served the first one's cached data (its
  passkeys on the Security page, for one). `@groot/shell/lib/query-client` now
  owns the client: `createShellQueryClient(overrides?)` carries the defaults
  (`SHELL_QUERY_DEFAULTS`), and `<ShellQueryProvider client={…}>` resets the
  cache whenever the auth store's `generation` changes (sign-in, sign-out and a
  session-invalid 401): inactive queries and the mutation cache are dropped,
  mounted queries lose their data and refetch as the new session.
  `bindQueryClientToSession(client)` does the same for a client provided some
  other way.
  
  Child projects: in `main.tsx`, replace `new QueryClient({...})` and
  `QueryClientProvider` with `createShellQueryClient()` and `ShellQueryProvider`.

### Patch Changes

- [#165](https://github.com/AshikNesin/groot/pull/165) [`d9fcc26`](https://github.com/AshikNesin/groot/commit/d9fcc26278342e6ae725c6cda497400782548715) Thanks [@AshikNesin](https://github.com/AshikNesin)! - fix(shell): a ⌘K tab lists its own group, even when another shares its heading
  
  - **`@groot/shell`:** the palette's group tabs filtered rows by heading, so
    two `CommandGroupEntry`s with the same `heading` but different `id`s showed
    each other's rows under both tabs. Tabs now filter by the group's id
    (`id`, or `heading` when there is none).
  - **`@groot/ui`: `@groot/ui/command` is deprecated.** Its cmdk-based
    `Command`, `CommandDialog`, `CommandInput`, `CommandList`, `CommandEmpty`,
    `CommandGroup`, `CommandSeparator`, `CommandItem`, `CommandFooter` and
    `CommandShortcut` are replaced by the command menu
    (`@groot/ui/command-menu`), which the shell's palette uses, and are removed
    in the next major.
- Updated dependencies [[`b3039be`](https://github.com/AshikNesin/groot/commit/b3039befd01979bcdc9f655fcf41e55a47a8e879), [`d9fcc26`](https://github.com/AshikNesin/groot/commit/d9fcc26278342e6ae725c6cda497400782548715), [`f44c850`](https://github.com/AshikNesin/groot/commit/f44c850f3f632ca54c01f6e265c643020ccfe4f8), [`82718e6`](https://github.com/AshikNesin/groot/commit/82718e6c579bae0269f16d42f4e2a74c4ecdde3b), [`1abd148`](https://github.com/AshikNesin/groot/commit/1abd148fc59353dbc4b3f629af9449ec1eb25896), [`f4022b4`](https://github.com/AshikNesin/groot/commit/f4022b454292fa768d71aea5efd1a496501dfc57), [`494007f`](https://github.com/AshikNesin/groot/commit/494007f804a7ad3c83c2413b2222b1bc9d0b59ac)]:
  - @groot/core@2.2.0
  - @groot/ui@1.3.0

## 2.2.0

### Minor Changes

- [`4fda966`](https://github.com/AshikNesin/groot/commit/4fda966725221f125ccac8eaa4552dfdea5384e5) Thanks [@AshikNesin](https://github.com/AshikNesin)! - The sidebar account menu follows Amp's layout. **Log out** is the first row and is no longer red. Next comes a **Command palette** row (⌘K) that opens the palette, then the app's non-primary destinations, with Settings last, next to the trigger. The menu is wider (`w-64`) and can extend past the sidebar edge. Shortcuts show as plain muted glyphs at each row's trailing edge.
  
  The Theme submenu is no longer in the account menu. Theme stays available in Settings › Appearance and ⌘K. `ThemeMenu` is still exported from `@groot/shell/components/Layout` for apps that render it themselves.
  
  `NavDestination` gains `shortcut` (command-menu syntax, e.g. `"mod+,"`). `Layout` binds the combo globally to navigate to that destination and shows it in the account menu and ⌘K. To get ⌘, for Settings, add `shortcut: "mod+,"` to the Settings entry in `App.tsx`'s `PAGES`.

- [`56dfce8`](https://github.com/AshikNesin/groot/commit/56dfce84d94dae5abb15646fa6067c193beef38f) Thanks [@AshikNesin](https://github.com/AshikNesin)! - The settings page is now a full-page screen with a searchable section sidebar, modeled on ampcode.com/settings. Each section has its own URL: `/settings/account`, `/settings/appearance`, `/settings/security` and `/settings/configuration`. The bare `/settings` path and unknown sections redirect to Account. The sidebar search matches section names, keywords ("dark" finds Appearance) and individual settings. `/` focuses it, ↑/↓ move through the results, Enter opens one and Esc clears it.
  
  New: an Account section (`AccountSettings`) that shows the signed-in user's name, email and ID. `ThemeSettings` is now a single "Theme" row with a segmented Light/Dark/System control. `Settings` takes an optional `sections` prop (`SettingsSection[]`; the default is `DEFAULT_SETTINGS_SECTIONS`) so an app can add or reorder sections.
  
  `NavDestination` gains `fullPage`. On that path and below it, `Layout` renders no sidebar, mobile top bar or `<main>` padding, and keeps the ⌘K palette.
  
  To upgrade, mount Settings on a splat route and mark it full page, for example in `App.tsx`'s `PAGES`:
  
  ```tsx
  { label: "Settings", icon: SettingsIcon, to: "/settings", path: "/settings/*", fullPage: true, element: <Settings /> }
  ```
  
  and route each page with `path={page.path ?? page.to}`. Without the splat route the section URLs fall through to the catch-all redirect.

- [#154](https://github.com/AshikNesin/groot/pull/154) [`4acfa49`](https://github.com/AshikNesin/groot/commit/4acfa49e504c19534ade389a857f843f3b8ea5c9) Thanks [@AshikNesin](https://github.com/AshikNesin)! - feat(kit): upstream the kit fixes and features made first in tiny-agents
  
  - **`@groot/ui`: Fluid motion in the primitives.** New `@groot/ui/motion`
    entry (`spring` tiers, `useModalPresence`, `FluidHighlight`). `Dialog` and
    `AlertDialog` spring in and stay mounted through their exit; `DialogContent`
    gains `size` (`sm` 400px default, `md`, `lg`, `xl`) and `position`
    (`center` / `top`). `TabsList` slides its selected pill (or `line`
    underline) and shows a hover pill; `Tooltip` is an inverted chip that springs
    in and fades out, with a 200ms provider delay; `Select`, `DropdownMenu` and
    `Command` share one gliding row highlight; `CommandDialog` opens top-anchored
    at `lg`, and `Command` gains a `CommandFooter` of keyboard hints. Existing
    props are unchanged. Client tests should set
    `MotionGlobalConfig.skipAnimations = true` (see `tests/client/setup.ts`).
  - **`@groot/ui`: `Breadcrumbs`.** `<Breadcrumbs page={job.name}><Link to="/jobs">Jobs</Link></Breadcrumbs>`
    places the list items and separators, so a separator can't land inside an
    item. Storage (`@groot/shell`) and JobDetail (`@groot/jobs`) use it.
  - **`@groot/shell`: login returns to the page that asked for it.**
    `ProtectedRoute` passes the location to `/login`, and a successful password
    or passkey sign-in goes back there (in-app paths only) instead of `/`.
  - **`@groot/shell`: Inter is no longer imported by `index.css`.** Tailwind
    inlined that `@import` before Vite saw it, so the font files were never
    emitted and production served `index.html` in their place. Import it from
    your client entry instead: `import "@fontsource-variable/inter";` before
    `import "@groot/shell/index.css";`.
  - **`@groot/shell`: fixes.** Auth pages use `min-h-dvh`; the dev demo
    credentials have a space after the label; the page scrollbar follows the
    theme; Storage's icon buttons have accessible names, its select column has a
    screen-reader header, folders show `-` for Modified instead of the epoch,
    folder names have readable contrast, and viewing a UTF-8 text file no longer
    shows mojibake. The row buttons' names include the file name, so an e2e
    locator like `getByRole("cell", { name })` needs `exact: true`. The passkey card title is a level-2 heading.
  - **`@groot/jobs`: accessible state filter.** The overflow state menu sits
    beside the tab list (a tablist may only hold tabs) and has a label.
  - **`@groot/core`: fixes.** Storage downloads of `text/*` with no charset are
    served as `charset=utf-8`. Login re-hashes a password stored with an older
    PBKDF2 iteration count (`needsRehash`).
  - **App: missing build files 404.** The Node SPA fallback answers a request for
    a missing asset (`/assets/*`, common static extensions) with a 404 instead of
    `index.html`, and the client reloads once when a lazy chunk fails to load
    after a deploy.

### Patch Changes

- [#154](https://github.com/AshikNesin/groot/pull/154) [`4acfa49`](https://github.com/AshikNesin/groot/commit/4acfa49e504c19534ade389a857f843f3b8ea5c9) Thanks [@AshikNesin](https://github.com/AshikNesin)! - chore(deps): upgrade dependencies to the versions tiny-agents runs
  
  Every dependency groot shares with tiny-agents now matches its version, so a
  sync no longer conflicts on version ranges.
  
  - **Majors.** Vite+ 1.4 with Vitest 5, Sentry 11 (`@sentry/node`,
    `@sentry/cloudflare` and the build plugins), SimpleWebAuthn 14,
    better-sqlite3 13, jsdom 30, `@testing-library/jest-dom` 7,
    `@hookform/resolvers` 6, `@types/node` 26, changesets 3 (with
    `@changesets/changelog-github` 1) and `openai` 7.
  - **Minors and patches.** React 19.3, radix-ui 1.8, lucide-react 1.61, zod 4.6,
    TanStack Query 5.104, the CodeMirror pins, pi-ai 1.4 and the rest.
  - **Call sites.** Sentry 11 dropped `sendDefaultPii`; its `dataCollection`
    defaults already attach user info, cookies and headers, so both entries just
    drop the option. SimpleWebAuthn 14 renamed `AuthenticatorTransportFuture` to
    `AuthenticatorTransport`.
  - **Changesets 3** skips private packages unless asked, so
    `.changeset/config.json` sets `privatePackages: { version: true, tag: false }`
    to keep versioning the private kit packages (tags still come from the
    release workflow).
- Updated dependencies [[`4acfa49`](https://github.com/AshikNesin/groot/commit/4acfa49e504c19534ade389a857f843f3b8ea5c9), [`4acfa49`](https://github.com/AshikNesin/groot/commit/4acfa49e504c19534ade389a857f843f3b8ea5c9), [`b2ecb45`](https://github.com/AshikNesin/groot/commit/b2ecb452ac2ee6429a6d4c9b460a5df45b7b4a27), [`4acfa49`](https://github.com/AshikNesin/groot/commit/4acfa49e504c19534ade389a857f843f3b8ea5c9), [`bd42693`](https://github.com/AshikNesin/groot/commit/bd426933e3274957888307f580b9949aa9ca6ffb), [`6e83765`](https://github.com/AshikNesin/groot/commit/6e83765462d2d7cab627c572fc20092f073859ba)]:
  - @groot/core@2.1.1
  - @groot/ui@1.2.0

## 2.1.0

### Minor Changes

- [#152](https://github.com/AshikNesin/groot/pull/152) [`b1661dd`](https://github.com/AshikNesin/groot/commit/b1661dd7e885d4a1ba3f64f6297032f6a2516c85) Thanks [@exe-dev-github-integration](https://github.com/apps/exe-dev-github-integration)! - The command palette takes `builtIns` again, and `Layout` takes `commandBuiltIns`. Passing `false` drops the shell's Navigation, Theme and Account groups, for an app that builds its own and would otherwise list them twice. The Fluid command menu rewrite ([#147](https://github.com/AshikNesin/groot/issues/147)) had removed the option.

- [#149](https://github.com/AshikNesin/groot/pull/149) [`0bbf92f`](https://github.com/AshikNesin/groot/commit/0bbf92f21c56d4f7c8a0a874782a6787b8b83f53) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Add first-run setup: create the first user from the browser at `/setup`.

  `@groot/core` adds `GET /api/v1/auth/setup` (`{ needsSetup }`) and
  `POST /api/v1/auth/setup`, which creates the first account and signs it in
  (cookie + token, like login). It answers 403 once any user exists and is
  rate-limited like login. The service gains `hasAnyUser()` and
  `createFirstUser()`; the schema exports `SetupStatus`.

  `@groot/shell` adds the `Setup` page (`@groot/shell/pages/auth/Setup`), the
  `useSetupStatus()` hook and the store's `setup()` action. `Login` redirects to
  `/setup` while no user exists, and `Setup` redirects to `/login` once one
  does. Apps mount it with `<Route path="/setup" element={<Setup />} />`.

- [#147](https://github.com/AshikNesin/groot/pull/147) [`4a97dbe`](https://github.com/AshikNesin/groot/commit/4a97dbef479531c72e160a000c2af0a214225ccb) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Replace the ⌘K command palette UI with the Fluid Functionalism command menu.

  `@groot/ui/command-menu` is a new public subpath (`CommandMenu`,
  `CommandMenuDialog`, `CommandMenuInput`, `CommandMenuTabs`, `CommandMenuList`,
  `CommandMenuItem`, `CommandMenuFooter`, …) vendored from
  fluidfunctionalism.com (MIT) with its support code in `packages/ui/vendor/fluid`.
  It adds a `motion` dependency. `@groot/ui/command` (cmdk) is unchanged and
  still exported.

  `CommandPaletteDialog` now renders the new menu: a fluid hover highlight, group
  tabs, a key-hint footer that names what Enter does, and ⌘K / Ctrl+K bound by
  the dialog itself (the `Layout` listener is gone). `CommandItemEntry` gains
  optional `action`, `description`, `shortcut`, `keywords` and `suggested`
  fields; existing entries keep working unchanged. The shell stylesheet adds the
  Fluid surface, hover and shadow tokens, mapped onto the groot palette.

- [#151](https://github.com/AshikNesin/groot/pull/151) [`1faa763`](https://github.com/AshikNesin/groot/commit/1faa7639c5a63dbb75f53b7006b9d551d78f845c) Thanks [@exe-dev-github-integration](https://github.com/apps/exe-dev-github-integration)! - Upstreamed from tiny-agents: the session guard and client-address fixes.

  - **Session guard.** `jwtAuthMiddleware` now looks up the account behind a valid token. A token for a deleted account gets a 401 coded `SESSION_INVALID` (`sessionInvalid()` in `@groot/core/utils/jwt.utils`, `ErrorCode.SESSION_INVALID`). Before, a removed user's token kept working until it expired. The shell's `apiClient.onUnauthorized` now fires only on that code, so a wrong password or another 401 no longer signs the user out. `ApiError` gains `fromServer`.
  - **Client address.** `clientIp()` now keys on the socket peer. It trusts `X-Forwarded-For` only when the peer is in the new `TRUSTED_PROXIES` (IPv4 and IPv6 addresses or CIDR ranges; unset means loopback and the private ranges, including `fc00::/7`; `none` means no proxy). Before, any client could rotate `X-Forwarded-For` to get past the login rate limit. On Workers, `cf-connecting-ip` is still the client. The rate limiter keys an IPv6 client by its /64. An entry with host bits set (`10.0.0.1/8`) fails at boot.

### Patch Changes

- Updated dependencies [[`0bbf92f`](https://github.com/AshikNesin/groot/commit/0bbf92f21c56d4f7c8a0a874782a6787b8b83f53), [`4a97dbe`](https://github.com/AshikNesin/groot/commit/4a97dbef479531c72e160a000c2af0a214225ccb), [`1faa763`](https://github.com/AshikNesin/groot/commit/1faa7639c5a63dbb75f53b7006b9d551d78f845c)]:
  - @groot/core@2.1.0
  - @groot/ui@1.1.0

## 2.0.0

### Major Changes

- [`0eff25d`](https://github.com/AshikNesin/groot/commit/0eff25daff7315a63e28af7e419e13beac5e7ac9) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Dead exports trimmed from the kit surface.

  - **`titleClass` is no longer exported** from `@groot/ui/typography` (or the `@groot/ui` barrel). It was the `Text` `title` variant's class list with the export left over; use `<Text variant="title">` — identical classes.
  - **The deprecated `CommandPalette` wrapper is removed** from `@groot/shell/components/CommandPalette`; render `CommandPaletteTrigger` and `CommandPaletteDialog` directly.
  - **`CommandPaletteTrigger` drops the `iconOnly` prop** and always renders the icon button — the labeled, input-styled variant had no callers left.

- [`a17ed96`](https://github.com/AshikNesin/groot/commit/a17ed960618f9e4bc38a57d4e8dd3f14bd16e0d7) Thanks [@AshikNesin](https://github.com/AshikNesin)! - The server owns passkey policy; the client renders it.

  - **`@groot/core`**: `GET /api/v1/passkey/list`, `POST /register/verify` and `PATCH /:id` return `PasskeySummary` = `{ id, credentialName, kind, label, backedUp, canDelete, lastUsedAt, createdAt }`. `kind` (`"security-key" | "synced" | "device"`) and `label` come from the new `describePasskey()` in `passkey/webauthn.utils`; `canDelete` is `false` for a user's last passkey, which the server already refused to delete. The raw `userId`, `counter`, `transports`, `deviceType` and `updatedAt` fields are no longer returned; read the `passkeys` table if you need them. No schema change.
  - **`@groot/core`**: `POST /login/verify` no longer accepts `email` (nothing read it; extra keys are ignored), and `verifyAuthentication()` drops the parameter. `POST /login/options` keeps its optional `email`. Removed the unused `VerifyRegistrationDTO`, `VerifyAuthenticationDTO`, `GenerateAuthenticationOptionsDTO` and `UpdatePasskeyNameDTO` types from `passkey/passkey.schema`; use `z.infer<typeof …Schema>`.
  - **`@groot/shell`**: the `Passkey` type in `services/passkey` is the summary above. `PasskeyManager` picks the icon from `kind`, shows `label`, and disables Delete when `canDelete` is false (it used to check a `deviceType === "platform"` value the server never stores, and warned as if the last passkey could be deleted). Removed `passkeyService.isPasskeySupported()` and `passkeyService.isPlatformAuthenticatorAvailable()`; call `window.PublicKeyCredential` directly or use `browserSupportsWebAuthn()` from `@simplewebauthn/browser`.

- [`cac0a3f`](https://github.com/AshikNesin/groot/commit/cac0a3f0222efb6c4442185f7bd51e05252b12c0) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Shell navigation is described once, in `ShellConfig`. `ShellConfig.nav` (`{ label, icon?, to, primary? }[]`) drives the sidebar (`primary` entries), the account menu (the rest) and the ⌘K palette; the `brand` defaults (Groot, `LayoutDashboard`, `/`) and the theme options live in one place each.

  - **Built-ins can't be dropped.** The account menu always has the theme submenu and Log out; ⌘K always ends with Theme and Account (Log out) groups. Log out is one action everywhere: end the session, toast "Signed out", go to `/login` (the palette used to skip the toast).
  - **`Layout`** keeps `header`, `commandGroups`, `padded`, `mainClassName` and `className`. `commandGroups` now **adds** groups between the nav-derived Navigation group and the built-ins instead of replacing the defaults, so drop your own Navigation, Theme and Log out entries. Removed props: `navItems`, `brand`, `userMenuItems` (move entries to `ShellConfig.nav` / `ShellConfig.brand`).
  - **Removed types**: `UserMenuItem` and the `NavItem` re-export (`@groot/shell/components/Layout`); `NavItem`, `NavIcon` and `SidebarBrand` (`@groot/shell/components/SidebarNav`). Use `NavDestination` and `ShellBrand` from `@groot/shell/lib/shell-config`. `SidebarNav` takes `items: NavDestination[]` and a required `brand`; string icon keys (`"check-square"`) are gone, pass the Lucide component.
  - **`useShellConfig()`** returns the config with defaults filled in: `brand` is always complete and `nav` is always an array.
  - **The palette** no longer has the "Dashboard → /" entry; `CommandPaletteDialog`'s `groups` are extra groups, as above.
  - New: `THEME_OPTIONS` (`@groot/shell/lib/theme`) and `useSignOut()` (`@groot/shell/hooks/useSignOut`).

- [`507b6dd`](https://github.com/AshikNesin/groot/commit/507b6dd55f5a3a3a26468e49fae970e7d87406c1) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Page chrome and app settings lose their extra modules.

  - **`PageHeader` is folded into `PageLayout`.** `@groot/shell/components/layout/PageHeader` and the `@groot/shell/components/layout/index` barrel are removed; import `PageLayout` and `PageContainer` from their own files (`@groot/shell/components/layout/PageLayout`). `PageLayout` keeps `title`, `description`, `actions`, `breadcrumb`, `titleAdornment`, `maxWidth` and `className` — everything `PageHeader` rendered.
  - **`@groot/shell/services/settings` is removed** (`settingsService`, `AppSettingMetadata`, `UpsertSettingData`). Its three `apiClient` calls are inlined into `useAppSettings`; the `AppSetting` type moved to `@groot/shell/hooks/useAppSettings`.

- [`8532dc0`](https://github.com/AshikNesin/groot/commit/8532dc003cce91cc872b4a2508e5f5f5c7fc4529) Thanks [@AshikNesin](https://github.com/AshikNesin)! - One client session module; `@groot/shell/lib/api` is pure transport. The transport and the session store no longer import each other, and the sign-in rules live in one place.

  - **`apiClient`** no longer knows about sessions. New `apiClient.onUnauthorized(handler)` reports every 401 as `{ path, sentAt }` and returns an unsubscribe function; the session store installs it. Removed `apiClient.login()`, `apiClient.logout()` and `apiClient.getCurrentUser()`: call `useAuthStore.getState().login()` / `.logout()` / `.checkAuth()`, or `apiClient.post("/auth/login", …)` and `apiClient.get("/auth/me")` directly.
  - **`useAuthStore`** (`@groot/shell/store/auth`) owns sign-in (password or passkey), sign-out, the current user and the 401 rule. `user`, `isAuthenticated`, `hasCheckedAuth`, `generation`, `login`, `loginWithPasskey`, `logout`, `checkAuth` and `clearAuth` keep their names. Changes: `login()` and `loginWithPasskey()` resolve with the user; `loginWithPasskey()` takes no `email` (nothing passed one); `logout()` never rejects; the unused `isLoading` and `error` fields are gone. A 401 now clears the session only when it answers a request sent during the current session, instead of skipping `/auth/me`, `/auth/login` and the `/login` page by path.
  - **`SessionUser`** (`{ id, email, name }`) is exported from `@groot/shell/store/auth`, declared once.
  - **`loginErrorDescription(error, fallback)`** lives in the session store and is re-exported from `@groot/shell/pages/auth/Login`. It reads `ApiError.status`, so a rejected password now shows "Invalid email or password." (the 401 branch never fired after the move to `fetch`); a `TypeError` reads as a network failure, and a cancelled WebAuthn prompt gets its own wording.
  - **`passkeyService.loginWithPasskey()`** is removed from `@groot/shell/services/passkey`: use `useAuthStore.getState().loginWithPasskey()`.
  - Login page copy no longer mentions Express, S3 or audit logs.

- [`becdce4`](https://github.com/AshikNesin/groot/commit/becdce4363122d09dd588cbb8eea3806be8c8ea7) Thanks [@AshikNesin](https://github.com/AshikNesin)! - The storage HTTP interface is narrowed to what the Storage page uses, and paths are validated once, at the edge.

  - **Breaking:** `POST /api/v1/storage/files/upload` takes one or many files (field `file`, repeated, up to 50) plus an optional `folder`, stores each at `<folder><file name>`, and returns `{ uploadedFiles, failedFiles }`. The `filePath` and `contentType` form fields are gone (the content type comes from the file). Migration: send `folder` instead of a full `filePath`; to store under another name, call `storageService.uploadFile()` from server code.
  - **Breaking:** `POST /files/bulk-upload` is removed (it ignored the folder); use `POST /files/upload`. `storageService.bulkUpload()` is renamed `uploadFiles()`.
  - **Breaking:** `GET /files/metadata` and `storageService.getFileMetadata()` are removed; use `storage.head(key)`.
  - **Breaking:** `GET /files` takes `folder` instead of `prefix` and `delimiter`, and always lists one folder level; the empty-delimiter mode is removed. `storageService.listFiles()` takes `{ folder }`.
  - **Breaking:** file paths with a leading, trailing or doubled `/`, or a `.` / `..` segment, are rejected with `400`, as are upload file names containing `/`. Folder paths are normalised to `a/b/` (a trailing `/` is no longer required on `POST /folders` and `DELETE /folders/:folderPath`), and the schemas are now the only place that checks them: `createFolder()` and `deleteFolder()` no longer reject a path without a trailing `/`, so pass one when calling them directly. The schema module exports `filePathSchema`, `folderPathSchema`, `uploadFilesSchema`, `deleteFolderSchema` and `MAX_UPLOAD_FILES`; `getFileMetadataSchema` is removed.
  - New `parseForm(c, schema)` in `@groot/core/utils/controller.utils` validates a multipart or urlencoded body like `parseBody` does JSON.
  - **Breaking (`@groot/shell`):** `useUploadFile()` is replaced by `useUploadFiles()`, which takes `{ files, folder }` and uploads in one request; `useStorageFiles(folder)` sends `folder`. Multi-file uploads on the Storage page now land in the open folder through the single upload route.

### Minor Changes

- [`5fe5d03`](https://github.com/AshikNesin/groot/commit/5fe5d0367001c380b64b4b0ed9583ba7cc0123ee) Thanks [@AshikNesin](https://github.com/AshikNesin)! - `apiClient` takes per-request options. Every verb accepts a trailing
  `{ headers }`, and `apiClient.request(method, path, { params, body, headers,
emptyOk })` covers the rest: extra headers such as a step-up token or an
  idempotency key, and `emptyOk` for an endpoint that may answer with no data
  (as `delete` always allowed). Apps no longer need a second copy of the
  client's 401 handling and `ApiError` parsing to send one header.

- [`b3a2a21`](https://github.com/AshikNesin/groot/commit/b3a2a210251e7557517804feda498a711591eeb8) Thanks [@AshikNesin](https://github.com/AshikNesin)! - One wire-type source per slice: the server publishes its JSON response types once, and clients import them type-only (erased at build) instead of hand-copying shapes that drift.

  - **`@groot/jobs`**: new `@groot/jobs/server/wire-types` — `Job`, `JobSchedule`, `JobLog`, `JobStats`, `BulkRerunResult`, derived from the schema rows with every timestamp as an ISO string. `@groot/jobs/client/types` re-exports them under the same names, so existing imports keep working.
  - **`@groot/core`**: `SessionUser` (`auth.schema`), `PasskeySummary` with string dates (`passkey.schema`), `FileInfo` with a string `lastModified` plus `UploadFilesResult` (`storage.schema`) and `AppSetting` (`app-settings.schema`) are the single sources, each declared in a zod-only leaf so the client's type graph never pulls in server modules. The passkey service now serialises dates itself, matching what JSON always sent; the service modules re-export their wire types for server-side importers.
  - **`@groot/shell`**: local copies removed — `useStorage`'s `StorageFile`/`UploadResult`, `store/auth`'s `SessionUser`, `services/passkey`'s `Passkey` and `useAppSettings`' `AppSetting` are now aliases of the core types. `@groot/shell` gains a (type-only) `@groot/core` dependency.

  `AGENTS.md` documents the rule: type-only imports across the client/server boundary are allowed for wire types; each slice publishes them once, in a web-neutral leaf module, with dates as ISO strings.

### Patch Changes

- [`1f59d1b`](https://github.com/AshikNesin/groot/commit/1f59d1b2190274f9a9cc362049e3ea4b29f26977) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Gitleaks' two generic rules now match quoted literal values only, so ordinary code (`password: z.string()`, `const token = makeToken()`) no longer blocks commits; the demo login's credentials carry an inline `gitleaks:allow`. Sync tooling: a malformed conflict manifest or `boilerplate-sync.json` is reported as such instead of being treated as "nothing pending" / "not found"; `package.json` without a sync baseline is merged instead of getting conflict markers. `groot:setup` rejects names that give no usable slug, renames the Worker whatever its current name, and no longer breaks on `|`, `&` or `\` in the app name.

- [`f6a363f`](https://github.com/AshikNesin/groot/commit/f6a363f2d968f893756c723aa7abc4a172d4791f) Thanks [@AshikNesin](https://github.com/AshikNesin)! - One contract for every storage adapter. The semantics (keys, `put`/`head` agreement, missing keys, `list` order, `limit` and `cursor`, `copy`, content types) are written down in `@groot/core/storage/adapter`, and one contract suite runs against the memory, local and R2 adapters.

  - **Breaking:** `StorageAdapter.delete(keys)` resolves to `void` instead of a count. The R2 adapter no longer heads every key before deleting it. Custom adapters: return nothing from `delete`.
  - **Breaking:** `storageService.deleteFiles()` resolves to `void`, and `DELETE /api/v1/storage/files` answers `204` with no body instead of `{ deletedCount }`. `deleteFolder()` and `DELETE /folders/:folderPath` still return `{ deletedCount }`, the number of objects listed under the prefix.
  - **Breaking:** the `groupByDelimiter` helper in `@groot/core/storage/adapter` is replaced by `listKeys(keys, options)`, which also applies `limit` and `cursor`. The memory and local adapters now page like R2 (at most `limit` entries, default and maximum 1000, with a `cursor` when more exist).
  - Fixed: R2 listings carried no content type (the adapter now asks for `httpMetadata`); the local adapter's `head`/`get` now reject a key that escapes the root instead of returning `null`; the local adapter's `put` reports the extension-derived content type it will serve; `memoryStorage().get()` returns a copy of the bytes.

- Updated dependencies [[`1a38cc2`](https://github.com/AshikNesin/groot/commit/1a38cc221122ba029a6820bcab9ea7f3ca9f402b), [`df27e7b`](https://github.com/AshikNesin/groot/commit/df27e7b99478ad44ee400f69ebd523d23a1ff404), [`a7a0f17`](https://github.com/AshikNesin/groot/commit/a7a0f1739e0de3e8b4770f81033f69cc1ef51863), [`e0a63a9`](https://github.com/AshikNesin/groot/commit/e0a63a9b46d73c1eaadee94280c12fc5f2c5b014), [`28e8bd3`](https://github.com/AshikNesin/groot/commit/28e8bd3a8a45f12ce9474f6dd76b3396603cdcaa), [`1f33ccc`](https://github.com/AshikNesin/groot/commit/1f33cccf00d1074e350194cdb03350fc4544b011), [`0eff25d`](https://github.com/AshikNesin/groot/commit/0eff25daff7315a63e28af7e419e13beac5e7ac9), [`2861fa1`](https://github.com/AshikNesin/groot/commit/2861fa1b43fc745c4a83117d75587ecfcfb5df47), [`9613dad`](https://github.com/AshikNesin/groot/commit/9613dad11d403526d08492a74b3b0546bda1c34e), [`869db96`](https://github.com/AshikNesin/groot/commit/869db96397cac115b16c05c4a4e4bf2cbfd5a1cc), [`1f59d1b`](https://github.com/AshikNesin/groot/commit/1f59d1b2190274f9a9cc362049e3ea4b29f26977), [`a17ed96`](https://github.com/AshikNesin/groot/commit/a17ed960618f9e4bc38a57d4e8dd3f14bd16e0d7), [`f6a363f`](https://github.com/AshikNesin/groot/commit/f6a363f2d968f893756c723aa7abc4a172d4791f), [`becdce4`](https://github.com/AshikNesin/groot/commit/becdce4363122d09dd588cbb8eea3806be8c8ea7), [`29c96e1`](https://github.com/AshikNesin/groot/commit/29c96e120320efe5da8d04bfa75caaeb97a9409a), [`b3a2a21`](https://github.com/AshikNesin/groot/commit/b3a2a210251e7557517804feda498a711591eeb8)]:
  - @groot/ui@1.0.0
  - @groot/core@2.0.0

## 1.1.0

### Minor Changes

- [#140](https://github.com/AshikNesin/groot/pull/140) [`68254db`](https://github.com/AshikNesin/groot/commit/68254db6c9f7f4378a93cb8f5c89746877295bb2) Thanks [@AshikNesin](https://github.com/AshikNesin)! - New default look: a warm monochrome theme, ported from tiny-agents, applied consistently across every primitive and page. Every app that syncs `packages/**` picks it up, so review your pages after syncing. The rules are in `docs/features/dls.md` ("Shape and size").

  - **Theme tokens** (`@groot/shell` `index.css`): off-white / near-black surfaces with a faint warm cast, foreground-derived hairline borders, an achromatic primary, and a larger `--radius` (0.75rem). In dark mode `--muted` and `--secondary` sit one step above `--card`, so hover and selected fills show on cards. The sidebar tokens now hold real values (the sidebar uses them). Each theme sets `color-scheme`, the body uses `100dvh`, and scrollbars get a quiet thumb. CodeMirror's background, gutter and active line follow the tokens.
  - **One control scale** (`@groot/ui`): `Button`, `Input`, `SelectTrigger`, `InputGroup` and `TabsList` share heights (`sm` h-7, default h-9, `lg` h-10) and are `rounded-xl` at every size. `Button` default is h-9, `lg` h-10, `icon` size-9, `icon-lg` size-10; `Input` and `InputGroup` are h-9. Outline buttons are transparent, so they take the surface they sit on.
  - **Surfaces**: `Card` `rounded-2xl`. `Dialog` and `AlertDialog` (and so `useConfirm`) are viewport-capped flex columns, `rounded-3xl` with `p-6`, over a `bg-black/40` backdrop without blur; their footers drop the grey band and negative margins, so drop any compensating spacing. New `DialogBody` scrolls tall content between a pinned header and footer. Dropdown menus and the select menu are `rounded-xl` with `rounded-lg`, roomier items; the command palette uses the dialog radius; tooltips `rounded-lg`; `Alert` `rounded-xl`; toasts `rounded-xl`.
  - **Toasts follow the theme**: `Toaster` reads the `dark` class on `<html>`, so rich-color toasts are no longer light on a dark page.
  - **Contrast**: destructive text on `Badge` and `StatusBadge` mixes in the foreground so it reaches 4.5:1 on its red tint.
  - `GrootUIProvider` takes a `toaster` prop (sonner `ToasterProps`, e.g. `position`).
  - **Shell chrome**: `SidebarNav` uses the sidebar tokens, a hairline border and `h-9 rounded-xl` rows; the collapsed rail now keeps search and the account menu. The page background is `bg-background` instead of `bg-muted/40`, and the mobile top bar is opaque. Settings search, list rows, the new-setting form and the JSON editor frame follow the control scale; the storage table frame matches `Card`. `ThemeMenu` is exported from `@groot/shell/components/Layout`.
  - **`@groot/jobs`**: page-header and job-detail actions use the default size; the filter toolbar (tabs, search, Queue, Date) is one height; the job type picker looks like a select; job dialogs scroll their forms in `DialogBody`; JSON, log and error blocks are `rounded-xl`.

### Patch Changes

- Updated dependencies [[`68254db`](https://github.com/AshikNesin/groot/commit/68254db6c9f7f4378a93cb8f5c89746877295bb2)]:
  - @groot/ui@0.8.0

## 1.0.0

### Major Changes

- [#135](https://github.com/AshikNesin/groot/pull/135) [`6002a46`](https://github.com/AshikNesin/groot/commit/6002a46dabe53ab067472cfa03862d18e1d9fcdc) Thanks [@AshikNesin](https://github.com/AshikNesin)! - **@groot/shell:** the API client is now plain `fetch`; axios is gone. `apiClient.client` (the axios instance) no longer exists, and failed requests throw `ApiError` (`status`, `code`, `details`, `url`) instead of an axios error. `error.message` still carries the server's message.

  **@groot/core:** `migrateD1()` applies Drizzle's generated SQL migrations to a D1 database from inside the Worker (wrangler-compatible `d1_migrations` bookkeeping), so the Workers entry migrates on its first request and `wrangler deploy` is the whole deploy. `pnpm db:generate` now also writes `apps/web/drizzle/index.ts`, the list the Worker imports. The unused `send-push-notification` dependency is dropped.

### Patch Changes

- [`c1e5177`](https://github.com/AshikNesin/groot/commit/c1e5177f72bce07990e72f6678a210b62005d472) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Fix the JSON editor crashing on mount with "Unrecognized extension value in extension set": pnpm overrides now keep one copy of each `@codemirror/*` core package (the root pinned `@codemirror/state` 6.7.0 while `@codemirror/view` resolved 6.7.1). Switch from `@tailwindcss/postcss` to `@tailwindcss/vite` so the Inter font files from `@fontsource-variable/inter` are bundled; under PostCSS their relative `url()`s never resolved and production served `index.html` in their place.

- [`191f6a6`](https://github.com/AshikNesin/groot/commit/191f6a6ea0efe632f8bf8fc3221f81ab01e9d0c9) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Fix the sidebar losing its layout after the switch to `@tailwindcss/vite`: that plugin scans for classes from Vite's root (`apps/web`), so classes used only in `packages/*` were dropped from the CSS. The shell stylesheet now sets Tailwind's source base back to the repo root.

- Updated dependencies [[`6209997`](https://github.com/AshikNesin/groot/commit/620999778ed329ee20b55f810f80b368db158dd4), [`8ab9eee`](https://github.com/AshikNesin/groot/commit/8ab9eeee9b3029330f8f70d06e6cf31b3f3eb42f)]:
  - @groot/ui@0.7.3

## 0.11.0

### Minor Changes

- [`72ce54c`](https://github.com/AshikNesin/groot/commit/72ce54c32d03c89018fddb5487b4b64662953d2c) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Add ShellProvider so apps can override shared shell branding and login marketing copy without modifying synced shell components.

### Patch Changes

- [`aba55a5`](https://github.com/AshikNesin/groot/commit/aba55a5205f5c05137f1203af639f8b2e5dcd108) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Login and auth UX fixes from a production friction audit:

  - Login failure toast maps 401 to "Invalid email or password." instead of surfacing the raw Axios message ("Request failed with status code 401"); network failures get a friendly line too. Same for passkey sign-in.
  - Logout from the user menu shows a "Signed out" toast.
  - The login page's right brand panel follows dark mode (`dark:bg-card`) instead of rendering a pure-white slab next to the dark form.
  - Dropdown submenus open with a small `sideOffset` so they no longer overlap their parent menu.

  - The command palette now closes on outside click / overlay tap (it opted
    into `dismissOnOutsideClick`); previously only Escape or running a
    command dismissed it.

- [`7b86607`](https://github.com/AshikNesin/groot/commit/7b86607a4147a66373e1e5c3b8457d81e25a50e6) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Add a passkey sign-in option to the login page.

- [#132](https://github.com/AshikNesin/groot/pull/132) [`664f989`](https://github.com/AshikNesin/groot/commit/664f989db27179fd61059a1002506c27c8264023) Thanks [@exe-dev-github-integration](https://github.com/apps/exe-dev-github-integration)! - Import `Settings`'s `PageLayout` from the case-safe `@groot/shell/components/layout/index` barrel instead of the deep file. 129a729 fixed a macOS case-collision (bare `@groot/shell/components/layout` resolves to `components/Layout.tsx`) by moving the last two barrel importers to deep paths, which dropped the `layout/index.ts` barrel from every typechecked program and turned the typecheck-coverage guard red (`183/184`). The barrel is documented public kit surface (docs/guides/development.md), so it stays shipped and re-enters the typecheck graph through a real import.

- [`e3614e4`](https://github.com/AshikNesin/groot/commit/e3614e4bce049f0cb71ee28bcb24cfeed05fd110) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Add persisted light, dark, and system theme preferences across the shell.

- Updated dependencies [[`aba55a5`](https://github.com/AshikNesin/groot/commit/aba55a5205f5c05137f1203af639f8b2e5dcd108)]:
  - @groot/ui@0.7.2

## 0.10.3

### Patch Changes

- [#123](https://github.com/AshikNesin/groot/pull/123) [`297f957`](https://github.com/AshikNesin/groot/commit/297f957bc0fcda60dcb63deb770bda7860e92b7e) Thanks [@exe-dev-github-integration](https://github.com/apps/exe-dev-github-integration)! - Complete the typecheck graph: add a client typecheck script and CI step, and a coverage guard that fails when a source file belongs to no checked project. Repo-owned `.d.ts` files under the covered roots are typechecked in a dedicated skipLibCheck:false pass instead of counting toward coverage unchecked. The two live fixes touch kit source: the jobs client re-export path in `packages/jobs/src/client/types.ts`, the `cn` import in `packages/shell/src/components/PasskeyManager.tsx`, and the tooltip entry added to the `packages/ui/src/index.ts` barrel (tooltip.tsx existed since e997f40 but was never exported from the barrel before this PR), so the three kit packages carry the same patch as the root.

- Updated dependencies [[`297f957`](https://github.com/AshikNesin/groot/commit/297f957bc0fcda60dcb63deb770bda7860e92b7e), [`73677b0`](https://github.com/AshikNesin/groot/commit/73677b01da2163aca4d8c78c35f637b124a58b5e)]:
  - @groot/ui@0.7.1

## 0.10.2

### Patch Changes

- [`960a9c1`](https://github.com/AshikNesin/groot/commit/960a9c15e059e49b2edcfb837875c9efc399190d) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Add DLS composition components: DataField/DataFields, StatTile, listRowClass

  Ships the recurring higher-order patterns the DLS audit found hand-rolled across groot and the child projects (nesins-finance-api alone had 9 files of drifting dt/dd display fields; list-row hover treatments appeared in 86 child files).

  - `@groot/ui/display` (new): `DataField` (label/value pair, `dt`/`dd`, meta-label typography) + `DataFields` (responsive 2→4 col grid wrapper). The display counterpart to form-`Field` from `@groot/ui/form`.
  - `@groot/ui/stat-tile` (new): `StatTile` — meta label + optional icon + `statClass` value, with a clickable/active variant for filter-stats (JobsStats' pattern).
  - `@groot/ui/list-row` (new): `listRowClass` / `listRowGridClass` — the interactive list-row treatments as class constants (`tableColumnHeaderClass` precedent; rows stay semantic elements). Unblocks child projects against the new transition-colors gate rule on next sync.
  - Consumers reconciled: JobOverview (local `Field` deleted), JobDetail singleton section, JobsStats (inline tile → `StatTile`), JobsTable (both row variants), ScheduledJobsPanel, Todos, PasskeyManager.
  - Docs: `docs/features/dls.md` gains a composition-components section (with the pull-don't-push doctrine); `docs/features/client.md` rules table extended.

- [`e95a091`](https://github.com/AshikNesin/groot/commit/e95a09100a8459eab096df4d414ba081d8454112) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Introduce the DLS: a closed type scale, Kumo-adapted rules, and enforcement

  Establishes the repo's Design Language System as a written spec plus enforced rules — built on the existing stack (Tailwind v4 + Radix/shadcn + cva), with Cloudflare's Kumo as reference, not dependency.

  - `@groot/ui/typography` (new): `Text` component + exported classes — `titleClass`, `h1Class`, `statClass`, `displayClass`, `monoClass`, `metaLabelClass`. The type scale is now closed; pages never pick `text-*` sizes ad hoc. `tableColumnHeaderClass` now equals `metaLabelClass` (one definition of the meta-label idiom).
  - 4 new gate rules in `scripts/check-design-tokens.ts` (9 total): `tracking-modified` (no `tracking-*`, except `metaLabelClass`), `font-bold` (banned; `font-semibold` is max), `transition-colors-hover` (instant color hover in pages; primitives exempt as the motion layer), `inline-mono-full-step` (inline mono at `text-[0.9em]`). `allow` lists now support directory-prefix entries.
  - Drift reconciled: `tracking-tight` removed from 8 headings; local meta-label copies in jobs → `tableColumnHeaderClass`; inline `font-mono text-sm` → `text-[0.9em]`; `transition-colors/all` removed from 18 page/shell sites (primitives keep theirs). Login h1 uses `h1Class`; marketing h2 uses `displayClass`.
  - Docs: `docs/features/dls.md` (spec + rationale + rejected alternatives); rules table extended in `docs/features/client.md`; AGENTS.md index link.
  - Agent skill: `.agents/skills/groot-dls/SKILL.md` — the distilled non-negotiables for AI sessions.

- Updated dependencies [[`960a9c1`](https://github.com/AshikNesin/groot/commit/960a9c15e059e49b2edcfb837875c9efc399190d), [`e95a091`](https://github.com/AshikNesin/groot/commit/e95a09100a8459eab096df4d414ba081d8454112)]:
  - @groot/ui@0.7.0

## 0.10.1

### Patch Changes

- Updated dependencies [[`9e5602a`](https://github.com/AshikNesin/groot/commit/9e5602a68d11df36357165df982f71cb8d6c2a79)]:
  - @groot/ui@0.6.0

## 0.10.0

### Minor Changes

- [`18e3200`](https://github.com/AshikNesin/groot/commit/18e3200e3a34db550672c49aa2c5683a4f261b11) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Codebase simplification pass — dead code, duplication, API surface

  Audit-driven cleanup, no behavior changes. Verified green across every layer: typecheck, lint, 211 unit tests, full build, 6 e2e tests. All removals were verified to have zero real consumers via import-graph resolution.

  Dead code (~1,300 LOC across 22 files):

  - date/shell lib helpers with zero callers (25→9 date fns; dropped `formatCurrency`, `debounce`, `truncate`, `getInitials`)
  - one-line Prisma pass-throughs in auth/passkey services; never-wired `auth.deleteUser`, `storage.copyFile`, 6 storage DTO aliases
  - vestigial breadcrumb subsystem (zero `addBreadcrumb` callers), dead `createLogger`/`logPerformance`/`parseLimit`/`useBulkUpload`/`todoJobOptions`
  - 4 orphan ui primitives: `alert`, `pagination`, `select`, `tooltip` (423 lines, zero real importers)

  Duplication:

  - The jobs client `Job`/`ScheduledJob` types now alias the server adapter's `QueueJob`/`ScheduledJobInfo` instead of maintaining a second drifting 19-field shape
  - `withJobToast` helper replaces 15 identical try/toast/catch blocks in `useJobs`/`useJobDetail`
  - `TextInputDialog` consolidates the CreateFolder/Rename dialogs

  Also fixes pre-existing breaks on main: the job-logger level gate was typed `pino.LevelWithSilent` (root tsc exited 2), the pretest hook resolved the DEV database when NODE_ENV wasn't set (now `NODE_ENV=test` everywhere; `ensure-test-db.ts` refuses to run when `TEST_DATABASE_URL` is unset), and login + todos e2e specs drifted from the UI copy.

### Patch Changes

- Updated dependencies [[`18e3200`](https://github.com/AshikNesin/groot/commit/18e3200e3a34db550672c49aa2c5683a4f261b11)]:
  - @groot/ui@0.5.0

## 0.9.1

### Patch Changes

- [`d03042b`](https://github.com/AshikNesin/groot/commit/d03042b6798461138fccb5d1881b2f9e80521153) Thanks [@AshikNesin](https://github.com/AshikNesin)! - feat: render job-data links inline within the JSON view

  Replaces the separate Structured/JSON toggle in `JobJsonBlock` with a single
  read-only JSON panel that highlights resolver-matched values as clickable
  links. Link ranges are computed while pretty-printing (`stringifyWithLinks`)
  and rendered as CodeMirror decorations that navigate on click.

  - `JobJsonBlock` no longer toggles between `JobDataView` and raw JSON; it always
    shows JSON with inline link highlights.
  - `CodeMirrorEditor` gains `linkRanges` and `onLinkClick` props to drive
    `Decoration.mark` ranges + click handling, plus a `.cm-json-link` style.

## 0.9.0

### Minor Changes

- [`399ee35`](https://github.com/AshikNesin/groot/commit/399ee35d36a4bae5fcd3df68b481170d6f68da53) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Make the page shell the single owner of page chrome, and adopt the shared primitives across shell pages.

  - **`PageHeader` / `PageLayout` gain `breadcrumb` and `titleAdornment` slots**, and `description` widens from `string` to `ReactNode`. Detail pages previously copy-pasted `PageHeader`'s `<h1>` classes because there was nowhere to put a breadcrumb trail or a status pill.
  - **`Section` gains `meta` and `actions` slots** and now renders a `text-sm` heading, matching the "label + count" pattern that pages were hand-rolling. It had no consumers before.
  - **`Storage` now renders through `PageLayout`**, dropping its own `max-w-7xl` container and `text-2xl font-medium` `<h1>` (which disagreed with every other page title). Its breadcrumb uses the `Breadcrumb` primitive and its file list uses `Table`/`TableRow`/`TableCell` instead of a raw `<table>`.
  - **`AppSettings` and `PasskeyManager` now use `Card`** instead of hand-rolled `rounded-xl border border-border bg-card` divs, so the Settings page no longer has visibly different card edges than the rest of the app (`Card` uses a ring, not a border).
  - **Destructive confirmations now use `useConfirm()`** in `AppSettings` and `PasskeyManager`, replacing two bespoke `Dialog`s that could be dismissed by an overlay click. `useAppSettings` no longer returns the now-unused `showDeleteDialog` / `setShowDeleteDialog` / `requestDelete`.
  - `ProtectedRoute` uses `LoadingSpinner` instead of a hand-rolled spinner div; redundant `mr-2` margins on icons inside gap-spaced menu items are removed.

### Patch Changes

- Updated dependencies [[`399ee35`](https://github.com/AshikNesin/groot/commit/399ee35d36a4bae5fcd3df68b481170d6f68da53)]:
  - @groot/ui@0.4.0

## 0.8.0

### Minor Changes

- [`c097350`](https://github.com/AshikNesin/groot/commit/c0973502ae2e731094876e05dcfc9b3db6b3ccfc) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Re-export `NavItem` from `Layout` so app consumers can import it from the same path they pass `navItems` to.

## 0.7.0

### Minor Changes

- [#105](https://github.com/AshikNesin/groot/pull/105) [`5efcd19`](https://github.com/AshikNesin/groot/commit/5efcd19c4d87de3afc47c32d8aae8fe2bd20e525) Thanks [@exe-dev-github-integration](https://github.com/apps/exe-dev-github-integration)! - Refine shell loading and hydration states: read the sidebar collapsed preference synchronously from `localStorage` (fixes the collapse flash on reload), give `<main>` a min-height for a stable footprint while content loads, and show a centered spinner during the initial auth check instead of a blank screen.

### Patch Changes

- [#107](https://github.com/AshikNesin/groot/pull/107) [`0051546`](https://github.com/AshikNesin/groot/commit/005154619ee39ca399a96bcea02ba0fbbcfd3e91) Thanks [@AshikNesin](https://github.com/AshikNesin)! - PageHeader actions now wrap on narrow viewports (fixes mobile overflow), and the vite client config dedupes its `@groot/*` alias list into a single const shared by the build and the test runner.

## 0.6.2

### Patch Changes

- Updated dependencies [[`90c30e0`](https://github.com/AshikNesin/groot/commit/90c30e02b09c3e355bd8a0aa0f431006dd55431b)]:
  - @groot/ui@0.3.0

## 0.6.1

### Patch Changes

- [#102](https://github.com/AshikNesin/groot/pull/102) [`011c6d5`](https://github.com/AshikNesin/groot/commit/011c6d5595ea9e4fff8911f56e497e497aecb380) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Fix pg-boss jobs list showing blank metadata; replace native confirm with a styled dialog

  The jobs dashboard table was missing data for pg-boss (Postgres) jobs: the
  "Started" column showed "—", "Created" showed "N/A", retry counts read 0, and
  expire/keep-until/dead-letter were empty — for _every_ job in the list (active
  jobs most visibly, since they always have a `started_on`). The stats counts at
  the top of the page were correct; only the per-row metadata was broken.

  Root cause: the raw-SQL dashboard queries (`getJobs`/`getJobsByState`/
  `getFailedJobs`) aliased columns to lower-case keys (`startedon`), but the
  shared `normalizeBossJob` reads pg-boss's camelCase shape (`startedOn`), so
  every camelCase field resolved to `undefined` → null/empty/0. Only
  `getJobById` (pg-boss's own accessor) was correct, which is why the detail
  page showed the right values. Fixed by aliasing the raw-SQL projection to
  camelCase (double-quoted so Postgres preserves case), matching the shape
  `normalizeBossJob` reads, so both paths agree.

  Also replaces every native `window.confirm()` — jobs page (bulk re-run,
  purge-by-state, delete job, cancel scheduled job) and storage page (delete
  files, delete folder) — with a new shared `ConfirmProvider`/`useConfirm`, a
  thin imperative convenience layer over a Radix `AlertDialog` primitive (a port
  of shadcn's `alert-dialog`). Both live under `@groot/ui/primitives` so callers
  know they are composed/Radix-backed, not direct shadcn re-exports. Using
  AlertDialog gives correct confirm semantics: the dialog can ONLY be closed by
  the action/cancel buttons or Escape (not by clicking the overlay), so a
  confirmation can never be dismissed accidentally. `Button` now exports a named
  `ButtonProps` so the alert-dialog action/cancel slots compose with the shared
  button variants (destructive, outline).

- Updated dependencies [[`011c6d5`](https://github.com/AshikNesin/groot/commit/011c6d5595ea9e4fff8911f56e497e497aecb380)]:
  - @groot/ui@0.2.2

## 0.6.0

### Minor Changes

- [#98](https://github.com/AshikNesin/groot/pull/98) [`b9906ec`](https://github.com/AshikNesin/groot/commit/b9906ec95ba2702d5f7f3176333e65be30a2ff8f) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Make the shell Layout/SidebarNav/CommandPalette/Storage app-configurable

  The shell app shell (Layout, SidebarNav, CommandPalette) and the Storage page
  now accept optional props so child apps can brand the shell and extend the
  command palette / user menu without forking the components. All new props are
  optional with defaults that preserve the existing groot behavior, so the
  boilerplate's own app is unchanged.

  - `Layout`: `navItems`, `brand`, `userMenuItems`, `commandGroups` props. The
    sidebar offset (`lg:pl-56`/`lg:pl-16`) and the mobile top bar are now gated
    on `header === undefined` so a custom header no longer double-pads the page.
    The footer user dropdown is driven by `userMenuItems` (default = the prior
    Storage/Jobs/Settings + Log out entries) and supports `to`/`href`/`onSelect`
    entries with optional separators and destructive styling.
  - `SidebarNav`: `NavItem.icon` accepts a `LucideIcon` directly (in addition to
    the existing string keys). New `brand` prop (`{ label, icon?, to? }`) replaces
    the hardcoded "Groot" label/logo.
  - `CommandPalette`: `CommandPaletteDialog({ groups })` accepts custom
    `CommandGroupEntry[]` (default = the prior Navigation + Account groups).
  - `Storage`: optional `onView?: (file: StorageFile) => void` lets an app
    intercept "View" clicks for an in-app viewer (falls back to the existing
    open-in-new-tab behavior). The bulk-upload input was wired but never
    triggered by any button (dead code); the single Upload input is now
    `multiple` and routes 1-file vs multi-file uploads internally.

## 0.5.0

### Minor Changes

- [`b0a391b`](https://github.com/AshikNesin/groot/commit/b0a391b85274ab8cf2f6837b8dda4dadf6f716a1) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Redesign settings UI with a dub-inspired card layout

  The Settings page, AppSettings, and PasskeyManager components have been
  reworked into a cleaner card-based layout inspired by Dub. The redundant
  desktop top toolbar in the Layout was also removed since the sidebar
  already provides navigation.

### Patch Changes

- [`b0a391b`](https://github.com/AshikNesin/groot/commit/b0a391b85274ab8cf2f6837b8dda4dadf6f716a1) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Improve form field spacing and consistency

  The shared `form.tsx` primitives now apply more consistent spacing
  between fields. Updated the job dialogs (Add/Edit/Schedule) and
  AppSettings form to use the improved form components for uniform
  vertical rhythm across forms.

- Updated dependencies [[`b0a391b`](https://github.com/AshikNesin/groot/commit/b0a391b85274ab8cf2f6837b8dda4dadf6f716a1)]:
  - @groot/ui@0.2.1

## 0.4.0

### Minor Changes

- [#74](https://github.com/AshikNesin/groot/pull/74) [`1e85141`](https://github.com/AshikNesin/groot/commit/1e851410f1b5cdce9a6bcafd269da4f091c99245) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Add `loginWithPasskey` to the shell auth store

  `useAuthStore` now exposes `loginWithPasskey(email?)`, which runs the WebAuthn
  ceremony via the existing `passkeyService.loginWithPasskey` and — on success —
  sets `isAuthenticated`/`user` and bumps `generation`, mirroring password login.

  Previously apps that wanted passkey login had to fork the store and track a
  separate `username` field. Now any app can `<PasskeyManager>` + call
  `loginWithPasskey` directly from `@groot/shell/store/auth`, keeping a single
  auth store. No change to existing fields or behavior.

- [#74](https://github.com/AshikNesin/groot/pull/74) [`225280b`](https://github.com/AshikNesin/groot/commit/225280b0899784e6fd92a363adb141dc7647bd24) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Add `header` / `padded` / `mainClassName` / `className` slots to the shell `Layout`

  `<Layout/>` now accepts:

  - `header?: ReactNode` — render a custom header/nav (e.g. an app `<Navbar/>`)
    instead of the default shell header (logo + command palette + user menu).
  - `padded?: boolean` (default `true`) — toggle `<main>`'s default padding. Set
    `false` when pages own their own padding via `PageContainer`.
  - `mainClassName?` / `className?` — extra classes merged onto `<main>` / the
    outer wrapper.

  Fully backward compatible: `<Layout/>` with no props behaves exactly as before.
  Lets apps brand the shell without forking the whole layout component.

## 0.3.1

### Patch Changes

- [`5f9eddd`](https://github.com/AshikNesin/groot/commit/5f9eddd7bba05222c378578a7d0900dac53d52a2) Thanks [@AshikNesin](https://github.com/AshikNesin)! - refactor: unify cross-package imports on @groot/\* aliases

  Standardizes import style so cross-directory imports always use the
  package alias (`@groot/core/*`, `@groot/shell/*`, `@groot/jobs/*`) while
  same-directory imports stay relative (`./`). Previously these were mixed —
  even within a single file (e.g. `../kv` next to `@groot/core/logger`) —
  making import style inconsistent across the codebase.

  ## @groot/core

  - Converted all cross-directory `../` imports to `@groot/core/*` aliases
    across `ai`, `auth`, `config`, `kv`, `middlewares`, `notification`,
    `passkey`, `settings`, `storage`, and `utils`.
  - Same-directory `./` imports left unchanged.
  - Prisma `../../generated/prisma/client` imports in `database/` kept
    relative (no alias maps to the generated output outside `src/`).

  ## @groot/shell

  - Converted cross-directory `../` imports to `@groot/shell/*` aliases
    across `components`, `hooks`, `lib`, `pages/storage`, `services`, and
    `store`.

  ## @groot/jobs

  - Converted cross-directory `../` imports to `@groot/jobs/client/*`
    aliases across the client `components/`.

## 0.3.0

### Minor Changes

- [`83b3a6f`](https://github.com/AshikNesin/groot/commit/83b3a6f1ce34a28299b00f18645faabf3e9569a8) Thanks [@AshikNesin](https://github.com/AshikNesin)! - refactor: unify API client, form handling, and server response flow

  A cross-cutting refactor of how the frontend talks to the API and how
  controllers shape responses, plus a shared Form primitive.

  ## @groot/core

  - Removed the `*System` namespace barrels (`AISystem`, `AuthSystem`,
    `ErrorSystem`, `KVSystem`, plus the passkey/settings/storage equivalents).
    Callers now use direct named imports instead of convenience namespaces.
  - Added `utils/controller.utils.ts` with `requireUser(req)` and
    `validatedBody<T>(req)` helpers, replacing repeated inline `req.user` /
    `req.body as` boilerplate across controllers.
  - Added `utils/api-response.utils.ts` to standardize controller response
    shapes.
  - Extracted shared Zod field shapes (`emailField`, `passwordField`) in
    `auth.validation.ts` so the client can reuse them for form validation
    (single source of truth).
  - Streamlined `error-handler`, `error-response`, `route-handler`, and
    `validation` middlewares.

  ## @groot/ui

  - Added a `Form` component (`form.tsx`) with `react-hook-form` integration and
    field helpers.

  ## @groot/shell

  - Reworked `lib/api.ts` (the `apiClient`) for simpler, more consistent request
    handling.
  - Added `useToastMutation` hook to standardize mutation + toast feedback.
  - Refactored `Login`, storage dialogs (`CreateFolderDialog`, `RenameDialog`),
    `PasskeyManager`, `AppSettings`, and the `useStorage` / `useAppSettings`
    hooks to build on the new Form component and apiClient.

  ## @groot/jobs

  - Refactored the client API layer (`api.ts`), `useJobs`, `useJobDetail`, and
    `JobsTable` to align with the new apiClient patterns.

### Patch Changes

- Updated dependencies [[`83b3a6f`](https://github.com/AshikNesin/groot/commit/83b3a6f1ce34a28299b00f18645faabf3e9569a8)]:
  - @groot/ui@0.2.0

## 0.2.0

### Minor Changes

- [#64](https://github.com/AshikNesin/groot/pull/64) [`ae54b49`](https://github.com/AshikNesin/groot/commit/ae54b4920f39b2dbd9432298855210cb4752cd57) Thanks [@AshikNesin](https://github.com/AshikNesin)! - refactor: reorganize codebase architecture

  - Flattened the `packages/` directory, merging `server`, `logger`, and `database` into `core`.
  - Renamed `client` to `shell`.
  - Moved boilerplate `auth`, `settings`, and `storage` modules out of `apps/web/src/client/pages` and into `@groot/shell`.
  - Replaced all legacy paths with their new equivalents in all codebase documentation, tests, and comments.

### Patch Changes

- Updated dependencies [[`ae54b49`](https://github.com/AshikNesin/groot/commit/ae54b4920f39b2dbd9432298855210cb4752cd57)]:
  - @groot/ui@0.1.0

## 0.1.0

### Minor Changes

- [#60](https://github.com/AshikNesin/groot/pull/60) [`0473401`](https://github.com/AshikNesin/groot/commit/0473401aacc5ccd4e67e8def92e98b30ecd72a9a) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Extract all jobs code into a dedicated `@groot/jobs` package

  The entire jobs vertical — pg-boss backend infrastructure, HTTP admin API,
  job logger, the dashboard UI, client types, and API methods — now lives in a
  single `@groot/jobs` package with two flat entry points:

  - `@groot/jobs/server/*` — pg-boss queue/worker/queries, routes, job logger
  - `@groot/jobs/client/*` — dashboard UI, `jobsApi`, types

  Business-specific handlers (`todo.jobs.ts`) and bootstrap wiring stay in
  `apps/web/`. This consolidates jobs code that was previously spread across
  `@groot/core` (`core/job`, `shared/jobs`, `core/logger`), `@groot/shell`
  (`types/jobs`, apiClient methods), and `apps/web` (dashboard UI).

  **Breaking — migration required for downstream repos:**

  - `createJobLogger` / `JobLogStream` / `createJobLogStream` moved from
    `@groot/core/core/logger` → `@groot/jobs/server/logger`. The
    `@groot/core/core/logger` re-exports are removed.
  - The 17 job methods were removed from `apiClient` (`@groot/shell/lib/api`).
    Use `jobsApi` from `@groot/jobs/client` instead.
  - `JobName` changed from an enum (with hardcoded `TODO_*` values) to
    `type JobName = string`. App-specific job names live with their handlers.
  - Server-side imports of job infra must move from
    `@groot/core/core/job/*` and `@groot/core/shared/jobs/*` to
    `@groot/jobs/server/*` (use explicit subpaths like `/worker`, `/logger`,
    `/routes` for the server bundle).
  - The jobs dashboard UI moved from `apps/web/src/client/pages/jobs/` to
    `@groot/jobs/client`. Import pages via `@groot/jobs/client`.

  The `database → logger → job-stream → database` module cycle is resolved as
  a side effect (job-stream left `@groot/core/core/logger`). `pg-boss` is no
  longer a dependency of `@groot/core` (it now lives in `@groot/jobs`).
