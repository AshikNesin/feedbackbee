# Sign in and out

A user signs in with email and password at `/login`. The session is an
HTTP-only cookie. Protected pages redirect to `/login` without it, and Log out
in the account menu clears it. Passkeys are also offered, but a headless
browser can't drive them without a virtual authenticator.

## Sub-features

- `auth-login` signs in with the demo user and lands on `/todos`.
- `auth-bad-credentials` stays on `/login` for a wrong email or password.
- `auth-logout` logs out from the account menu and shows `/login`.
- `auth-guard` sends a protected URL (`/todos`) to `/login` when logged out.

## How to get to it (user POV)

- Open any app URL while logged out. You land on `/login` with the heading
  `Welcome back`.
- Once signed in, open the account menu from the sidebar footer (`Demo User`)
  and choose `Log out`.

## Driving it with drive.mjs

Preconditions:

- Baseline seed (demo user exists, `needsSetup: false`).
- Journey exports `login = false` for the login sub-features, so the driver
  doesn't sign in first.

- **Login page.** `page.goto("/login")`. The heading `/welcome back/i` is
  visible.
- **Sign in.** Fill `getByLabel(/email/i)` and `getByLabel(/password/i)` with
  `demo@example.com`, then choose
  `getByRole("button", { name: "Sign In", exact: true })`. The URL becomes
  `/todos`.
- **Bad credentials.** Same with `wrong@example.com` / `wrongpassword`. The
  URL still matches `/login`.
- **Log out.** Signed in: choose
  `getByRole("button", { name: /demo user/i }).last()`, then
  `getByRole("menuitem", { name: /log out/i })`. The URL matches `/login` and
  `Welcome back` is visible.
- **Guard.** After logging out, `page.goto("/todos")`. The URL matches
  `/login`.
- **Session proof.** After signing in, `api("/api/v1/auth/me")` returns 200.
  After logging out it returns 401.

## Gotchas

- Login is limited to 20 attempts per 15 minutes per instance, and bad
  attempts count. A journey that loops on login will lock itself out.
  Relaunch to reset.
- `/setup` (first-user creation) only opens on an empty `users` table. The
  seed always creates the demo user, so this harness can't reach it. Report
  it as unreachable rather than deleting the user.
- Two 401s on `/api/v1/auth/me` before login are the app checking for a
  session. They're expected.
