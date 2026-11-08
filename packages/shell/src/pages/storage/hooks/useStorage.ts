import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@groot/shell/lib/api";
// Leaf module, not the `@groot/core/storage` barrel: the barrel's graph
// reaches the server middlewares (`node:async_hooks`), which the client
// tsconfig has no types for.
import type { FileInfo, UploadFilesResult } from "@groot/core/storage/storage.schema";

/** Aliases of the core wire types in `@groot/core/storage` (type-only
 *  imports, erased at build) — kept under the names clients already import. */
export type StorageFile = FileInfo;
export type UploadResult = UploadFilesResult;

/** Query keys; every storage write invalidates `storageKeys.root`. */
export const storageKeys = {
  root: ["storage"] as const,
  files: (folder: string) => [...storageKeys.root, "files", folder] as const,
};

/**
 * The storage HTTP calls, without React. Each resolves with the server's data
 * or rejects with the `apiClient` error; none toasts.
 */
export const storageApi = {
  /** One folder level; `folder` is `""` for the root or a path ending with `/`. */
  list: (folder: string) =>
    apiClient.get<StorageFile[]>("/storage/files", { folder: folder || undefined }),
  /** Upload one or many files into `folder` in a single request. */
  upload: (files: File[], folder: string) => {
    const formData = new FormData();
    for (const file of files) formData.append("file", file);
    formData.append("folder", folder);
    return apiClient.postForm<UploadResult>("/storage/files/upload", formData);
  },
  deleteFiles: (filePaths: string[]) => apiClient.delete<void>("/storage/files", { filePaths }),
  createFolder: (folderPath: string) =>
    apiClient.post<{ folderPath: string }>("/storage/folders", { folderPath }),
  deleteFolder: (folderPath: string) =>
    apiClient.delete<{ deletedCount: number }>(
      `/storage/folders/${encodeURIComponent(folderPath)}`,
    ),
  rename: (oldPath: string, newPath: string) =>
    apiClient.put<{ newPath: string }>("/storage/files/rename", { oldPath, newPath }),
  /** The file's bytes, typed by the response's content type. */
  blob: (filePath: string) => apiClient.getBlob("/storage/files/download", { filePath }),
};

/** Save a file to the person's downloads through a temporary blob URL. Rejects on failure. */
export async function downloadFile(filePath: string, name: string): Promise<void> {
  const blobUrl = window.URL.createObjectURL(await storageApi.blob(filePath));
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = name;
  link.click();
  window.URL.revokeObjectURL(blobUrl);
}

/**
 * A blob keeps only the MIME essence (`text/plain`), not the response's
 * charset, so a blob URL of UTF-8 text opens as windows-1252 mojibake
 * ("✓" as "âœ“"). Re-type text blobs as UTF-8 before viewing them.
 */
function withTextCharset(blob: Blob): Blob {
  if (!blob.type.startsWith("text/") || /charset=/i.test(blob.type)) return blob;
  return new Blob([blob], { type: `${blob.type};charset=utf-8` });
}

/**
 * Open a file in a new tab. Opens the tab before the first await so the
 * browser ties it to the click's user activation (opening after an await is
 * popup-blocked); a blocked popup falls back to the same tab. Rejects on
 * failure, after closing the empty tab.
 */
export async function viewFile(filePath: string): Promise<void> {
  const win = window.open("", "_blank");
  try {
    const blobUrl = window.URL.createObjectURL(withTextCharset(await storageApi.blob(filePath)));
    if (win) win.location.href = blobUrl;
    else window.location.href = blobUrl;
    // The tab has loaded the blob by the time this fires; release it so the
    // blob data isn't pinned for the page's lifetime.
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 2000);
  } catch (error) {
    win?.close();
    throw error;
  }
}

/** One folder level; `folder` is `""` for the root or a path ending with `/`. */
export function useStorageFiles(folder: string) {
  return useQuery({
    queryKey: storageKeys.files(folder),
    queryFn: () => storageApi.list(folder),
  });
}

/** Upload one or many files into `folder` in a single request. */
export function useUploadFiles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { files: File[]; folder: string }) =>
      storageApi.upload(params.files, params.folder),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.root });
    },
  });
}

export function useDeleteFiles() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: storageApi.deleteFiles,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.root });
    },
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: storageApi.createFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.root });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: storageApi.deleteFolder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.root });
    },
  });
}

export function useRenameFile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { oldPath: string; newPath: string }) =>
      storageApi.rename(params.oldPath, params.newPath),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: storageKeys.root });
    },
  });
}
