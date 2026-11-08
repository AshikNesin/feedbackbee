# Settings

Settings is a full-page area at `/settings/<section>` with its own section
sidebar (Account, Appearance, Security, Configuration and more) and a section
search. The Configuration section is a key/value editor for app settings, with
a JSON value editor and a description.

## Sub-features

- `settings-open` lands on `/settings/account` with the heading `Account`.
- `settings-search` presses `/`, types a term, and Enter opens the matching
  section (`dark` → Appearance).
- `settings-nav` switches sections from the `Settings sections` navigation.
- `settings-security` shows `Add passkey` in Security.
- `settings-config-crud` creates a setting, edits its description and JSON
  value, saves, reloads, and deletes it.

## How to get to it (user POV)

- Account menu (`Demo User`), then `Settings`.
- Keyboard shortcut `mod+,` (Ctrl+, on Linux, ⌘, on macOS).
- Go to `/settings` (redirects to `/settings/account`) or any
  `/settings/<section>`.

## Driving it with drive.mjs

Preconditions:

- Logged in (driver default). No configuration settings exist on a fresh
  launch.

- **Open.** `page.goto("/settings")`. The URL ends `/settings/account` and the
  heading `Account` (level 1) is visible.
- **Search.** `page.keyboard.press("/")`, type `dark`. The first
  `getByRole("option")` contains `Appearance`. Press Enter. The URL ends
  `/settings/appearance`.
- **Section nav.** In `getByRole("navigation", { name: "Settings sections" })`
  choose link `Security`. The URL ends `/settings/security` and
  `getByRole("button", { name: /add passkey/i })` is visible.
- **Create setting.** `page.goto("/settings/configuration")`. Choose
  `getByRole("button", { name: /add setting/i })`, fill
  `getByPlaceholder(/featureflags/i)` with a unique key such as
  `verify.setting.<time>`, and choose `getByRole("button", { name: /^create$/i })`.
  A heading with the key appears.
- **Edit and save.** Fill `getByLabel("Description")`, click `.cm-content`,
  press `ControlOrMeta+a`, type `{"enabled": true}`, then choose
  `getByRole("button", { name: /save changes/i })`. The text
  `/updated successfully/i` appears.
- **Persist.** `page.reload()`, choose the button named after the key. The
  Description and `.cm-content` show the saved values. As a second view,
  query `db("select * from kv")` and find the row for the key.
- **Delete.** Choose `getByRole("button", { name: /^delete$/i })`, then
  `Delete` in the `alertdialog`. The text `/no setting selected/i` shows and
  the key's button is gone.

## Gotchas

- The JSON value editor is CodeMirror. `.cm-content` is the one CSS selector
  in this map, because it has no accessible name.
- `/` only opens search while focus is outside a text field.
- How the `kv` table stores a setting's key (prefix, namespace) hasn't been
  checked through this harness yet. Look at the rows before asserting on an
  exact key.
