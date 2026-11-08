import { useRef } from "react";
import { Folder, FolderPlus, Home, RefreshCw, Trash2, Upload } from "lucide-react";
import { Button } from "@groot/ui/button";
import { Breadcrumbs } from "@groot/ui/breadcrumb";
import { EmptyState } from "@groot/ui/empty-state";
import { SkeletonCard, SkeletonTable } from "@groot/ui/loading-skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@groot/ui/table";
import { PageLayout } from "@groot/shell/components/layout/PageLayout";

import { DesktopFileRow } from "./components/DesktopFileRow";
import { MobileFileCard } from "./components/MobileFileCard";
import { TextInputDialog } from "./components/TextInputDialog";

import { useStorageBrowser } from "./hooks/useStorageBrowser";
import type { StorageFile } from "./hooks/useStorage";

interface StorageProps {
  /**
   * Override the default "open in new tab" view behavior with an in-app
   * viewer. Receives the file being viewed.
   */
  onView?: (file: StorageFile) => void;
}

export function Storage({ onView }: StorageProps = {}) {
  const { files, isLoading, path, crumbs, selection, dialog, actions, fileActions, pending } =
    useStorageBrowser({ onView });
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const onUploadChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    void actions.upload(Array.from(input.files ?? [])).finally(() => {
      input.value = "";
    });
  };

  const headerActions = (
    <Button variant="outline" size="icon" onClick={actions.refresh} aria-label="Refresh files">
      <RefreshCw className="size-4" />
    </Button>
  );

  const breadcrumb = (
    <Breadcrumbs page={crumbs.at(-1)?.name}>
      <button type="button" onClick={() => actions.open("")} aria-label="Go to root folder">
        <Home className="size-4" />
      </button>
      {crumbs.slice(0, -1).map((crumb) => (
        <button key={crumb.path} type="button" onClick={() => actions.open(crumb.path)}>
          {crumb.name}
        </button>
      ))}
    </Breadcrumbs>
  );

  const renameTarget = dialog?.kind === "rename" ? dialog.file : null;

  return (
    <PageLayout
      title="Storage"
      description="Browse and manage your files and folders"
      actions={headerActions}
      breadcrumb={breadcrumb}
      maxWidth="7xl"
    >
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <input
          ref={uploadInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={onUploadChange}
        />

        <Button onClick={() => uploadInputRef.current?.click()} disabled={pending.upload}>
          <Upload className="size-4" />
          Upload
        </Button>

        <Button variant="outline" onClick={() => actions.openDialog({ kind: "createFolder" })}>
          <FolderPlus className="size-4" />
          New Folder
        </Button>

        {selection.keys.length > 0 && (
          <>
            <Button variant="outline" onClick={selection.clear}>
              Clear ({selection.keys.length})
            </Button>
            <Button
              variant="destructive"
              onClick={() => void actions.removeSelection()}
              disabled={pending.remove}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </>
        )}

        {selection.fileCount > 0 && (
          <Button variant="outline" onClick={selection.selectAll}>
            Select All Files
          </Button>
        )}
      </div>

      {/* File list */}
      {isLoading ? (
        <>
          {/* Mobile card placeholders */}
          <div className="space-y-3 md:hidden">
            {["w-40", "w-32", "w-48"].map((w) => (
              <SkeletonCard key={w} titleWidth={w} lines={2} />
            ))}
          </div>
          {/* Desktop table placeholder */}
          <div className="hidden overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 md:block">
            <SkeletonTable columns={5} rows={6} />
          </div>
        </>
      ) : files.length === 0 ? (
        <EmptyState
          icon={Folder}
          title="No files found"
          description="This folder is empty. Upload files or create a new folder to get started."
        />
      ) : (
        <>
          {/* Mobile Card View */}
          <ul className="space-y-3 md:hidden" aria-label="Files">
            {files.map((file) => (
              <li key={file.key}>
                <MobileFileCard
                  file={file}
                  selected={selection.has(file.key)}
                  onToggle={selection.toggle}
                  onNavigate={actions.open}
                  actions={fileActions(file)}
                />
              </li>
            ))}
          </ul>

          {/* Desktop Table View */}
          <div className="hidden overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10 md:block">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-12">
                    <span className="sr-only">Select file</span>
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Modified</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <DesktopFileRow
                    key={file.key}
                    file={file}
                    selected={selection.has(file.key)}
                    onToggle={selection.toggle}
                    onNavigate={actions.open}
                    actions={fileActions(file)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <TextInputDialog
        open={dialog?.kind === "createFolder"}
        onOpenChange={(open) => !open && actions.closeDialog()}
        title="Create New Folder"
        description={`Enter a name for the new folder in ${path || "root"}`}
        label="Folder Name"
        placeholder="my-folder"
        submitLabel="Create"
        pendingLabel="Creating..."
        pending={pending.createFolder}
        onSubmit={(name) => void actions.createFolder(name)}
      />

      <TextInputDialog
        open={Boolean(renameTarget)}
        onOpenChange={(open) => !open && actions.closeDialog()}
        title="Rename File"
        description="Enter a new name for the file"
        label="New Name"
        placeholder="filename.txt"
        initialValue={renameTarget?.name}
        hint={renameTarget ? `Current: ${renameTarget.name}` : undefined}
        submitLabel="Rename"
        pendingLabel="Renaming..."
        pending={pending.rename}
        onSubmit={(newName) => renameTarget && void actions.rename(renameTarget, newName)}
      />
    </PageLayout>
  );
}
