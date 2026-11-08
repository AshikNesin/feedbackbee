# Client

A Vite + React 19 SPA that consumes the Hono API through a small `fetch`
client and React Query.

## Routing & layout

Routes are defined in `apps/web/src/client/App.tsx` (React Router 7):

| Route                   | Component            | From                                   | Auth      |
| ----------------------- | -------------------- | -------------------------------------- | --------- |
| `/login`                | `Login`              | `@groot/shell/pages/auth/Login`        | Public    |
| `/setup`                | `Setup`              | `@groot/shell/pages/auth/Setup`        | Public    |
| `/` → `/todos` (index)  | `Todos`              | `apps/web/src/client/pages/todo/Todos` | Protected |
| `/storage`              | `Storage`            | `@groot/shell/pages/storage/Storage`   | Protected |
| `/jobs`, `/jobs/:jobId` | `Jobs` / `JobDetail` | `@groot/jobs/client`                   | Protected |
| `/settings/*`           | `Settings`           | `@groot/shell/pages/settings/Settings` | Protected |

`/setup` is first-run setup: while no user exists, `Login` redirects there and
it creates the first account (`POST /auth/setup`) and signs in. Once a user
exists it redirects to `/login`. `useSetupStatus()`
(`@groot/shell/hooks/useSetupStatus`) reads `GET /auth/setup` for both.

`/settings` is a full-page screen (no app sidebar) with one sub-route per
section: `/settings/account`, `appearance`, `security` and `configuration`.
The bare path and unknown sections redirect to the first section. Its left
sidebar has a search (`/` to focus) that matches section names, their
keywords and individual settings. Pass `sections` (`SettingsSection[]`,
default `DEFAULT_SETTINGS_SECTIONS`) to add or reorder sections; each has an
`id` (the URL segment), `label`, `group`, `icon`, `description`,
`keywords`, `items` and `element`.

Any other path redirects to `/`. The router sits inside nuqs's `NuqsAdapter`
(URL state) and `GrootUIProvider` (`@groot/ui/provider`), which mounts the
toaster and the `ConfirmProvider` that `useConfirm()` needs.

`App` calls `checkAuth()` on mount. `ProtectedRoute` shows a spinner until it
settles, then redirects unauthenticated users to `/login`. `Layout` renders
the sidebar, the account menu, the ⌘K palette and an `<Outlet>` for nested
routes.

## Navigation (`ShellConfig`)

`<ShellProvider config={…}>` (`@groot/shell/lib/shell-config`) describes the
shell once:

| Field   | Drives                                                                                                                                                                                                                                                                                                          |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brand` | `{ label, icon?, to? }`: the sidebar, mobile bar and login logo; defaults to Groot, `LayoutDashboard`, `/`                                                                                                                                                                                                      |
| `nav`   | `{ label, icon?, to, primary?, fullPage?, shortcut? }[]`: `primary` entries are sidebar rows, the rest account-menu rows; all are ⌘K commands. `fullPage` pages bring their own chrome; `shortcut` (e.g. `"mod+,"`) is a global hotkey (not while a dialog such as ⌘K is open) shown in the account menu and ⌘K |
| `login` | `{ tagline?, description?, features? }`: the login brand panel                                                                                                                                                                                                                                                  |

The account menu follows Amp's layout. It opens upward with **Log out** first
(one action: end the session, toast, go to `/login`), then a **Command
palette** row (⌘K), then the non-primary destinations in config order, so the
last one (Settings) sits next to the trigger. Theme lives in Settings ›
Appearance and the ⌘K Theme group, not in the account menu. ⌘K also gets an
Account group. On a `fullPage` destination's path (and below it), `Layout`
renders no sidebar, mobile bar or `<main>` padding, only the ⌘K palette and
the page. `Layout` takes `commandGroups` for app-specific ⌘K groups
(listed between Navigation and Theme), `header` to replace the sidebar and
mobile bar with your own, and `padded`, `mainClassName`, `className`.

The ⌘K palette is the Fluid Functionalism command menu
(`@groot/ui/command-menu`): type to filter, ↑/↓ to move, ←/→ to switch the
group tabs, Enter to run. A `CommandItemEntry` takes `label`, `icon` and
`onSelect`, plus optional `description` (muted text, also searched),
`shortcut` (display-only caps, e.g. `"mod+shift+n"`; bind it with
`useHotkey` from `@groot/ui/hotkeys`), `keywords`, `action`
(what the footer calls Enter, e.g. "Go to Settings"), `suggested` (listed
under Suggestions while the query is empty) and `variant: "destructive"`.

`App.tsx` keeps a `PAGES` list of `NavDestination & { element }`: it is both
`ShellConfig.nav` and the routes, so a page with a place in the navigation is
declared once. An entry's optional `path` overrides the route path (Settings
uses `/settings/*` for its section sub-routes). Routes without a nav entry
(`jobs/:jobId`) are written out as usual.

## Transport and session

`apiClient` (`@groot/shell/lib/api`) is pure transport on `fetch`: it prefixes
`/api/v1`, sends the cookie (`credentials: "include"`), JSON-encodes bodies
(`FormData` goes as multipart), unwraps the `{ success, data }` envelope and
throws an `ApiError` (`status`, `code`, `message`, `details`, `url`,
`fromServer`) for any non-2xx response; `fromServer` is true when the message
came from the server's error envelope rather than the status line. A request
that never reached the server rejects with a `NetworkError` (a `TypeError`). `get`, `post`, `put` and `patch` also throw (code `NO_DATA`)
when a 2xx envelope has no `data`, so only `delete` suits an endpoint that
answers `204`. `postForm` uploads and `getBlob` downloads. It knows nothing
about sessions: `apiClient.onUnauthorized(handler)` reports each 401 with its
`path` and `sentAt` time.

The session is `useAuthStore` (`@groot/shell/store/auth`, Zustand). The server
keeps the JWT in an HttpOnly `token` cookie, so the store holds only the user:

| Member                                          | Does                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `user`, `isAuthenticated`, `hasCheckedAuth`     | The signed-in `SessionUser` (`{ id, email, name }`); whether `checkAuth()` settled              |
| `login(email, password)` / `loginWithPasskey()` | Sign in (`POST /auth/login`, or the WebAuthn ceremony); resolve with the user, or reject        |
| `setup({ email, password, name? })`             | First-run setup (`POST /auth/setup`): create the first account and sign in; 403 once one exists |
| `logout()`                                      | `POST /auth/logout`, then ends the local session; never rejects                                 |
| `checkAuth()`                                   | Resolves the session from the cookie on app load (`GET /auth/me`)                               |
| `generation`, `clearAuth()`                     | Bumped on every sign-in/out; end the local session without a server call                        |
| `loginErrorDescription(error, fallback)`        | The sign-in failure wording: a 401 is "Invalid email or password.", the rest is `describeError` |

The store installs the 401 hook: a 401 for a request sent during the current
session clears it, so `ProtectedRoute` redirects to `/login`. A 401 for a
request sent before the last sign-in or sign-out is ignored.

Response types come from the server, imported type-only (for example
`SessionUser` from `@groot/core/auth/auth.schema`), never hand-copied; see the
wire-type rule in [`AGENTS.md`](../../AGENTS.md).

## Data fetching

- The `QueryClient` comes from `createShellQueryClient(overrides?)`
  (`@groot/shell/lib/query-client`), which owns the defaults
  (`SHELL_QUERY_DEFAULTS`): queries stay fresh for 5 minutes, live in the
  cache for 30, refetch on window focus and reconnect, and retry once.
  Mutations never retry, because a repeated POST can create a duplicate.
  Overrides merge per section (`{ queries: { retry: false } }` in tests).
- `main.tsx` mounts it with `<ShellQueryProvider client={…}>`, which resets
  the cache whenever the auth store's `generation` changes: every sign-in,
  sign-out and session-invalid 401. Query keys (`["passkeys"]`,
  `["app-settings"]`, `["todos"]`) say nothing about the user, so without the
  reset the next account would be served the last one's data. Inactive
  queries and the mutation cache are dropped; mounted queries lose their data
  at once and refetch as the new session. A client provided some other way
  can call `bindQueryClientToSession(client)` instead.
- Feature hooks (e.g. `useTodos`) own the query and its key; mutations run
  through `useAction` (below), which invalidates the keys it is given.

## Mutation feedback

`@groot/shell/lib/feedback` is the one way a page runs a user action and
words its outcome:

| Export                                    | Does                                                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useAction(action, options)`              | Returns `{ run(vars), isPending }`. `run` asks `confirm` first if given, ignores a second call while one is under way (`busy`), runs the action, toasts, awaits the `invalidate` keys, then calls `onSuccess`. It never rejects |
| `describeError(error, fallback)`          | The sentence for a failure (table below)                                                                                                                                                                                        |
| `describeWebAuthnError(error)`            | The `WEBAUTHN_MESSAGES` row for a WebAuthn failure, or `undefined`                                                                                                                                                              |
| `toastError(error, { title, fallback })`  | Log the error and toast it, worded by `describeError`                                                                                                                                                                           |
| `toastSuccess(content)`                   | A success toast: a title, or `{ title, description }`                                                                                                                                                                           |
| `OFFLINE_MESSAGE`, `WEBAUTHN_MESSAGES`    | The offline sentence and the WebAuthn wording table                                                                                                                                                                             |
| `ActionOptions`, `ActionResult`, `Action` | The option, result and return types                                                                                                                                                                                             |

`useAction` options: `confirm?` (`ConfirmOptions`, or a function of the vars
returning one or `null`), `success?` (a toast, or a function of the result and
vars), `errorTitle?` (default "Something went wrong"), `fallback` (a string or
a function of the vars), `invalidate?` (`QueryKey[]`, or a function of the
result and vars) and `onSuccess?`. `run` resolves `{ ok: true, data }`, or
`{ ok: false, reason }` with `reason` `"cancelled"`, `"busy"` or `"failed"`
(with the `error`). It needs `GrootUIProvider` and a `QueryClientProvider`.

```tsx
const remove = useAction((id: number) => todosApi.remove(id), {
  success: { title: "Deleted", description: "Todo removed" },
  errorTitle: "Error",
  fallback: "Unable to delete todo",
  invalidate: [TODOS_KEY],
});
<Button onClick={() => void remove.run(todo.id)} disabled={remove.isPending} />;
```

`describeError(error, fallback)` picks the first that applies:

| Error                                                                 | Wording                     |
| --------------------------------------------------------------------- | --------------------------- |
| `ApiError` with `fromServer` (the server's envelope message)          | That message                |
| Any other `ApiError` (a status line such as "Bad Gateway")            | `fallback`                  |
| `NetworkError`, or a `TypeError` from `fetch` ("Failed to fetch")     | `OFFLINE_MESSAGE`           |
| A WebAuthn failure (`NotAllowedError`, `NotSupportedError`, …)        | Its `WEBAUTHN_MESSAGES` row |
| A plain `Error` the action threw (`new Error("Invalid JSON format")`) | Its message                 |
| Anything else (`SyntaxError`, a programming `TypeError`)              | `fallback`                  |

So an action refuses with words by throwing a plain `Error`, and anything it
did not word itself falls back to the caller's sentence. `useToastMutation`
(`@groot/shell/hooks/useToastMutation`) and the jobs `withJobToast` are
deprecated in favour of `useAction`; both now word errors with
`describeError`.

## App settings

The Configuration section (`AppSettings`, `@groot/shell/components/AppSettings`)
keeps data and editor apart:

- `useAppSettingsData()` (`@groot/shell/hooks/useAppSettingsData`) is the data:
  `settings`, `isLoading`, `isError`, `refresh()`, `get(key)`,
  `save(key, value, description?)` (a `PUT` upsert),
  `create(key, value?, description?)` and `remove(key)`. Each call refreshes
  the list before it resolves and rejects on failure. `create` refuses a key
  the list holds without a request, and `POST /settings` answers 409 for a key
  the server holds, so creating never overwrites a value.
- `useSettingDraft(setting)` (`@groot/shell/hooks/useSettingDraft`) is one
  setting's editable JSON and description with `isDirty`, `serverChanged`,
  `discard()` and `parse()` (throws "Invalid JSON format"). A refetch updates
  a clean draft and leaves a dirty one alone; selecting another setting with
  unsaved edits asks first.
- `useAppSettings()` is the old combined hook, deprecated and kept with its
  shape on top of these two.

## UI system

Primitives live in [`@groot/ui`](../../packages/ui) (shadcn-style, on Radix
and cva); page chrome (`PageLayout`, `PageContainer`, `Section`) lives in
`@groot/shell/components/layout/`. Tailwind v4 is configured CSS-first in
`packages/shell/src/index.css`, which also defines the tokens. Which primitive
to use for what, the type scale, tokens and motion rules are in the
[DLS](./dls.md), enforced by `pnpm check:tokens`.

`main.tsx` calls `initTheme()` (`@groot/shell/lib/theme`) before the first
render, so the stored theme applies without a flash. The default is dark;
call `setDefaultTheme()` before `initTheme()` to change it.

## Layering (import rules)

| Layer                | Import path            | Purpose           | Synced? |
| -------------------- | ---------------------- | ----------------- | ------- |
| `@groot/ui`          | `@groot/ui/button`     | Design primitives | Yes     |
| `@groot/shell`       | `@groot/shell/lib/api` | Client infra      | Yes     |
| `@groot/jobs/client` | `@groot/jobs/client`   | Jobs dashboard    | Yes     |
| `apps/web/…/pages`   | `./pages/todo/Todos`   | Business features | No      |

`ui/` can't import `shell`/`pages`; `shell/` can't import `pages/`.

## Extending the client

1. Add the page to `PAGES` in `App.tsx` (route, sidebar or account-menu row
   and ⌘K entry in one line), or a plain `<Route>` if it has no nav entry.
2. Create a React Query hook in the feature's `hooks/` that calls `apiClient`
   (paths are relative to `/api/v1`).
3. Compose the UI in `pages/` with `PageLayout` and the `@groot/ui`
   primitives.
4. For global state, prefer Zustand slices or React Query caches over ad-hoc
   contexts.
