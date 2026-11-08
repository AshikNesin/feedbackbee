import { useRef } from "react";
import { toastError, toastSuccess } from "@groot/shell/lib/feedback";
import { downloadFile, viewFile, type StorageFile } from "./useStorage";
import { useStorageBrowser } from "./useStorageBrowser";

/**
 * Download a file via a programmatic blob URL; toasts the outcome, never rejects.
 *
 * @deprecated Use `actions.download(file)` from `useStorageBrowser()`, or
 * `downloadFile(filePath, name)` from `./useStorage` (it rejects instead of toasting).
 */
export async function handleDownload(filePath: string, name: string): Promise<void> {
  try {
    await downloadFile(filePath, name);
    toastSuccess({ title: "Downloaded", description: "File downloaded successfully" });
  } catch (error) {
    toastError(error, { title: "Download failed", fallback: "Unable to download file" });
  }
}

/**
 * Open a file in a new tab; toasts a failure, never rejects.
 *
 * @deprecated Use `actions.view(file)` from `useStorageBrowser()`, or
 * `viewFile(filePath)` from `./useStorage` (it rejects instead of toasting).
 */
export async function handleView(filePath: string): Promise<void> {
  try {
    await viewFile(filePath);
  } catch (error) {
    toastError(error, { title: "View failed", fallback: "Unable to view file" });
  }
}

/** A stand-in for a listing entry the caller named by key and name only. */
function fileFor(files: StorageFile[], key: string, name: string): StorageFile {
  return (
    files.find((file) => file.key === key) ?? {
      key,
      name,
      size: 0,
      lastModified: new Date(0).toISOString(),
      isDirectory: false,
    }
  );
}

/**
 * The old flat surface of the Storage page, kept on top of `useStorageBrowser`.
 * It gains the browser's fixes: the selection only counts files of the open
 * folder, and a single-file delete confirms and leaves the selection.
 * `createFolder` and `renameFile` now carry only `isPending`.
 *
 * @deprecated Use `useStorageBrowser()`, which returns
 * `{ files, path, crumbs, selection, dialog, actions, fileActions, pending }`.
 */
export function useStorageActions() {
  const browser = useStorageBrowser();
  const { files, path, selection, dialog, actions, pending } = browser;
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const renameTarget =
    dialog?.kind === "rename" ? { key: dialog.file.key, name: dialog.file.name } : null;

  return {
    files,
    isLoading: browser.isLoading,
    refetchFiles: actions.refresh,
    breadcrumbs: browser.crumbs,
    fileCount: selection.fileCount,
    currentPath: path,
    selectedFiles: new Set(selection.keys),
    folderDialogOpen: dialog?.kind === "createFolder",
    setFolderDialogOpen: (open: boolean) =>
      open ? actions.openDialog({ kind: "createFolder" }) : actions.closeDialog(),
    renameTarget,
    setRenameTarget: (target: { key: string; name: string } | null) =>
      target
        ? actions.openDialog({ kind: "rename", file: fileFor(files, target.key, target.name) })
        : actions.closeDialog(),
    uploadInputRef,
    createFolder: { isPending: pending.createFolder },
    renameFile: { isPending: pending.rename },
    navigateToFolder: actions.open,
    toggleFileSelection: selection.toggle,
    selectAllFiles: selection.selectAll,
    clearSelection: selection.clear,
    handleUpload: (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      void actions.upload(Array.from(input.files ?? [])).finally(() => {
        input.value = "";
      });
    },
    handleDeleteFile: (key: string) =>
      actions.removeFile(fileFor(files, key, key.slice(key.lastIndexOf("/") + 1))),
    handleDeleteSelected: actions.removeSelection,
    handleDeleteFolder: (folderKey: string) =>
      actions.removeFolder({ ...fileFor(files, folderKey, folderKey), isDirectory: true }),
    handleCreateFolder: actions.createFolder,
    handleRename: async (newName: string) => {
      if (dialog?.kind === "rename") await actions.rename(dialog.file, newName);
    },
    startRename: (key: string, name: string) =>
      actions.openDialog({ kind: "rename", file: fileFor(files, key, name) }),
  };
}
