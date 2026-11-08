import { useMemo, useState } from "react";
import { parseAsString, useQueryState } from "nuqs";
import { toast } from "sonner";
import { Download, Edit3, Eye, Trash2, type LucideIcon } from "lucide-react";
import { useAction } from "@groot/shell/lib/feedback";
import {
  downloadFile,
  storageApi,
  storageKeys,
  useStorageFiles,
  viewFile,
  type StorageFile,
} from "./useStorage";

/** One breadcrumb: a folder name and the path that opens it (ends with `/`). */
export interface StorageCrumb {
  name: string;
  path: string;
}

/** The dialog the browser has open, if any. */
export type StorageDialog = { kind: "createFolder" } | { kind: "rename"; file: StorageFile };

/**
 * One thing a row can do to its file or folder. Both row adapters
 * (`DesktopFileRow`, `MobileFileCard`) render this list, so they offer the
 * same actions in the same order; the destructive one is last.
 */
export interface FileAction {
  id: "view" | "download" | "rename" | "delete";
  /** The visible text, where the row shows text. */
  label: string;
  /** The accessible name; it starts with `label`, so it names the visible text. */
  ariaLabel: string;
  icon: LucideIcon;
  destructive?: boolean;
  run: () => void;
}

/**
 * The file selection. It only ever counts files of the folder on screen: a
 * key from another folder, or one that left the listing (deleted, renamed),
 * is not in `keys`, so a bulk delete can never reach a file you cannot see.
 */
export interface StorageSelection {
  /** Selected file keys, in listing order. */
  keys: string[];
  has: (key: string) => boolean;
  toggle: (key: string) => void;
  selectAll: () => void;
  clear: () => void;
  /** How many files (not folders) the listing holds. */
  fileCount: number;
}

export interface StorageBrowserActions {
  open: (folder: string) => void;
  refresh: () => void;
  openDialog: (dialog: StorageDialog) => void;
  closeDialog: () => void;
  upload: (files: File[]) => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  rename: (file: StorageFile, newName: string) => Promise<void>;
  removeFile: (file: StorageFile) => Promise<void>;
  removeFolder: (folder: StorageFile) => Promise<void>;
  removeSelection: () => Promise<void>;
  view: (file: StorageFile) => Promise<void>;
  download: (file: StorageFile) => Promise<void>;
}

export interface StorageBrowser {
  /** The open folder's listing, folders first. */
  files: StorageFile[];
  isLoading: boolean;
  /** The open folder: `""` for the root, else a path ending with `/`. */
  path: string;
  crumbs: StorageCrumb[];
  selection: StorageSelection;
  dialog: StorageDialog | null;
  actions: StorageBrowserActions;
  /** The actions a row offers for `file`. */
  fileActions: (file: StorageFile) => FileAction[];
  pending: { upload: boolean; createFolder: boolean; rename: boolean; remove: boolean };
}

export interface StorageBrowserOptions {
  /** View a file in-app instead of opening it in a new tab. */
  onView?: (file: StorageFile) => void;
}

const INVALIDATE = [storageKeys.root];

function crumbsOf(path: string): StorageCrumb[] {
  const parts = path.split("/").filter(Boolean);
  return parts.map((name, index) => ({ name, path: `${parts.slice(0, index + 1).join("/")}/` }));
}

/** The folder a key lives in: `""` or a path ending with `/`. */
function folderOf(key: string): string {
  return key.slice(0, key.lastIndexOf("/") + 1);
}

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

/**
 * The storage file browser: the open folder (`?path=`), its listing, the
 * selection, the open dialog, and every operation. Each operation runs
 * through `useAction`, so it owns its confirmation, toasts and invalidation.
 * Needs `GrootUIProvider`, a `QueryClientProvider` and a nuqs adapter.
 */
export function useStorageBrowser({ onView }: StorageBrowserOptions = {}): StorageBrowser {
  const [path, setPath] = useQueryState("path", parseAsString.withDefault(""));
  const listing = useStorageFiles(path);
  const files = useMemo(() => listing.data ?? [], [listing.data]);
  const crumbs = useMemo(() => crumbsOf(path), [path]);
  const [dialog, setDialog] = useState<StorageDialog | null>(null);
  // What was picked, and in which folder.
  const [picked, setPicked] = useState<{ folder: string; keys: ReadonlySet<string> }>({
    folder: path,
    keys: new Set(),
  });

  // Leaving the folder forgets its picks (React's "adjust state while
  // rendering" pattern), so coming back does not revive them.
  if (picked.folder !== path) setPicked({ folder: path, keys: new Set() });

  // Derived, never stored: only files of the listing on screen count.
  const fileKeys = files.flatMap((file) => (file.isDirectory ? [] : [file.key]));
  const keys = picked.folder === path ? fileKeys.filter((key) => picked.keys.has(key)) : [];
  const pick = (next: Iterable<string>) => setPicked({ folder: path, keys: new Set(next) });
  const forget = (gone: string[]) => {
    const goneKeys = new Set(gone);
    setPicked((prev) => ({
      folder: prev.folder,
      keys: new Set([...prev.keys].filter((key) => !goneKeys.has(key))),
    }));
  };
  const keySet = new Set(keys);

  const selection: StorageSelection = {
    keys,
    has: (key) => keySet.has(key),
    toggle: (key) => pick(keySet.has(key) ? keys.filter((k) => k !== key) : [...keys, key]),
    selectAll: () => pick(fileKeys),
    clear: () => pick([]),
    fileCount: fileKeys.length,
  };

  const upload = useAction(
    async (list: File[]) => {
      const result = await storageApi.upload(list, path);
      if (result.uploadedFiles.length === 0) {
        throw new Error(
          list.length === 1 ? "Unable to upload file" : `None of the ${list.length} files uploaded`,
        );
      }
      return result;
    },
    {
      success: (result, list) =>
        list.length === 1
          ? { title: "Upload complete", description: `${list[0].name} uploaded successfully` }
          : { title: "Upload complete", description: `${result.uploadedFiles.length} uploaded` },
      errorTitle: "Upload failed",
      fallback: (list) => (list.length === 1 ? "Unable to upload file" : "Unable to upload files"),
      invalidate: INVALIDATE,
      onSuccess: (result) => {
        if (result.failedFiles.length === 0) return;
        toast.error(`${plural(result.failedFiles.length, "file")} failed`, {
          description: result.failedFiles.map((f) => `${f.filePath}: ${f.error}`).join("\n"),
        });
      },
    },
  );

  const createFolder = useAction(
    (name: string) => {
      const trimmed = name.trim().replace(/\/+$/u, "");
      if (!trimmed) return Promise.reject(new Error("Enter a folder name"));
      return storageApi.createFolder(`${path}${trimmed}/`);
    },
    {
      success: (data) => ({ title: "Folder created", description: data.folderPath }),
      errorTitle: "Failed to create folder",
      fallback: "Please try again",
      invalidate: INVALIDATE,
      onSuccess: () => setDialog(null),
    },
  );

  const rename = useAction(
    ({ file, newName }: { file: StorageFile; newName: string }) => {
      const name = newName.trim();
      if (!name) return Promise.reject(new Error("Enter a file name"));
      return storageApi.rename(file.key, `${folderOf(file.key)}${name}`);
    },
    {
      success: (_data, { file, newName }) => ({
        title: "File renamed",
        description: `${file.name} → ${newName.trim()}`,
      }),
      errorTitle: "Rename failed",
      fallback: "Unable to rename file",
      invalidate: INVALIDATE,
      onSuccess: (_data, { file }) => {
        forget([file.key]);
        setDialog(null);
      },
    },
  );

  // One action for every file delete, so a single and a bulk delete never overlap.
  const removeFiles = useAction((targets: string[]) => storageApi.deleteFiles(targets), {
    confirm: (targets) => ({
      title:
        targets.length === 1
          ? `Delete "${targets[0].slice(folderOf(targets[0]).length)}"?`
          : `Delete ${targets.length} files?`,
      description:
        targets.length === 1
          ? "The file will be permanently removed."
          : "Selected files will be permanently removed.",
      confirmLabel: "Delete",
      destructive: true,
    }),
    success: (_data, targets) => ({
      title: "Deleted",
      description:
        targets.length === 1 ? "File removed" : `${plural(targets.length, "file")} removed`,
    }),
    errorTitle: "Delete failed",
    fallback: (targets) =>
      targets.length === 1 ? "Unable to delete file" : "Unable to delete files",
    invalidate: INVALIDATE,
    onSuccess: (_data, targets) => forget(targets),
  });

  const removeFolder = useAction((folderKey: string) => storageApi.deleteFolder(folderKey), {
    confirm: (folderKey) => ({
      title: `Delete folder "${folderKey}"?`,
      description: "The folder and everything inside it will be permanently deleted.",
      confirmLabel: "Delete",
      destructive: true,
    }),
    success: (_data, folderKey) => ({ title: "Folder deleted", description: folderKey }),
    errorTitle: "Delete failed",
    fallback: "Unable to delete folder",
    invalidate: INVALIDATE,
  });

  const view = useAction((file: StorageFile) => viewFile(file.key), {
    errorTitle: "View failed",
    fallback: "Unable to view file",
  });

  const download = useAction((file: StorageFile) => downloadFile(file.key, file.name), {
    success: { title: "Downloaded", description: "File downloaded successfully" },
    errorTitle: "Download failed",
    fallback: "Unable to download file",
  });

  const actions: StorageBrowserActions = {
    open: (folder) => void setPath(folder),
    refresh: () => void listing.refetch(),
    openDialog: setDialog,
    closeDialog: () => setDialog(null),
    upload: async (list) => {
      if (list.length > 0) await upload.run(list);
    },
    createFolder: async (name) => void (await createFolder.run(name)),
    rename: async (file, newName) => void (await rename.run({ file, newName })),
    removeFile: async (file) => void (await removeFiles.run([file.key])),
    removeFolder: async (folder) => void (await removeFolder.run(folder.key)),
    removeSelection: async () => {
      if (keys.length > 0) await removeFiles.run(keys);
    },
    view: async (file) => {
      if (onView) onView(file);
      else await view.run(file);
    },
    download: async (file) => void (await download.run(file)),
  };

  const fileActions = (file: StorageFile): FileAction[] =>
    file.isDirectory
      ? [
          {
            id: "delete",
            label: "Delete folder",
            ariaLabel: `Delete folder ${file.name}`,
            icon: Trash2,
            destructive: true,
            run: () => void actions.removeFolder(file),
          },
        ]
      : [
          {
            id: "view",
            label: "View",
            ariaLabel: `View ${file.name}`,
            icon: Eye,
            run: () => void actions.view(file),
          },
          {
            id: "download",
            label: "Download",
            ariaLabel: `Download ${file.name}`,
            icon: Download,
            run: () => void actions.download(file),
          },
          {
            id: "rename",
            label: "Rename",
            ariaLabel: `Rename ${file.name}`,
            icon: Edit3,
            run: () => setDialog({ kind: "rename", file }),
          },
          {
            id: "delete",
            label: "Delete",
            ariaLabel: `Delete ${file.name}`,
            icon: Trash2,
            destructive: true,
            run: () => void actions.removeFile(file),
          },
        ];

  return {
    files,
    isLoading: listing.isLoading,
    path,
    crumbs,
    selection,
    dialog,
    actions,
    fileActions,
    pending: {
      upload: upload.isPending,
      createFolder: createFolder.isPending,
      rename: rename.isPending,
      remove: removeFiles.isPending || removeFolder.isPending,
    },
  };
}
