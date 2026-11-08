# Storage

The Storage page at `/storage` is a file browser over the uploads folder. The
user can create folders, open them, go back with the breadcrumb, upload one or
more files, and delete files and folders. Files land on disk under the run's
uploads folder.

## Sub-features

- `storage-folder-create` adds a folder from `New Folder`. The folder starts
  with a `.keep` file.
- `storage-folder-nav` opens a folder and returns via `Go to root folder`.
- `storage-folder-delete` deletes a folder after a confirm dialog and removes
  its directory from disk.
- `storage-upload` uploads one or several files into the open folder.
- `storage-file-delete` deletes a single file at once, with no confirm.

## How to get to it (user POV)

- Account menu (`Demo User` in the sidebar footer), then `Storage`.
- ⌘K, then type `Storage`.
- Go to `/storage` directly.

## Driving it with drive.mjs

Preconditions:

- Logged in (driver default). The uploads folder is empty on a fresh launch.

- **Open.** `page.goto("/storage")`.
- **Create folder.** Choose `getByRole("button", { name: /new folder/i })`,
  fill `getByLabel("Folder Name")` with a unique name, then choose
  `getByRole("button", { name: /^create$/i })`. The cell
  `getByRole("cell", { name, exact: true })` appears, and
  `tmp/verify-groot/<run>/uploads/<name>/` exists.
- **Open folder.** Click the button inside that cell. The cell `.keep` is
  visible.
- **Back to root.** Choose `getByRole("button", { name: "Go to root folder" })`.
  The folder cell is visible again.
- **Upload.** Call `page.locator('input[type="file"]').setInputFiles(...)`
  with one or more `{ name, mimeType: "text/plain", buffer }` entries. Each
  name appears as a cell, and the file exists under `uploads/` with the same
  bytes.
- **Delete file.** In the row filtered by the file name, choose
  `.getByRole("button").last()`. The row disappears and the file is gone from
  disk.
- **Delete folder.** Choose the row's last button, then
  `getByRole("button", { name: "Delete" })` in the confirm dialog. The cell
  disappears and the directory is gone from disk.

## Gotchas

- Storage calls are limited to 100 per 15 minutes and uploads to 50, per
  instance.
- The file input is hidden, so use `setInputFiles` rather than clicking
  the upload button. That still goes through the page's real upload handler.
- Row action buttons have no accessible names. `getByRole("button").last()`
  within the row is the delete button. Check the screenshot if the layout
  changes.
- Check the disk under `tmp/verify-groot/<run>/uploads/`, not `local/uploads/`
  (that's the developer's dev folder, which the e2e suite also uses).
