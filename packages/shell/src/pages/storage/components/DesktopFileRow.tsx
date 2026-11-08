import { Button } from "@groot/ui/button";
import { Checkbox } from "@groot/ui/checkbox";
import { TableCell, TableRow } from "@groot/ui/table";
import type { StorageFile } from "@groot/shell/pages/storage/hooks/useStorage";
import type { FileAction } from "@groot/shell/pages/storage/hooks/useStorageBrowser";
import { File as FileIcon, Folder } from "lucide-react";
import { formatBytes, formatDate } from "@groot/shell/lib/utils";

type Props = {
  file: StorageFile;
  selected: boolean;
  onToggle: (key: string) => void;
  /** Open a folder. */
  onNavigate: (key: string) => void;
  /** The row's actions, from `useStorageBrowser().fileActions(file)`. */
  actions: FileAction[];
};

/** Desktop table row for a single file/folder: one cell of buttons for `actions`. */
export function DesktopFileRow({ file, selected, onToggle, onNavigate, actions }: Props) {
  return (
    <TableRow data-state={selected ? "selected" : undefined}>
      <TableCell>
        {!file.isDirectory && (
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggle(file.key)}
            aria-label={`Select ${file.name}`}
          />
        )}
      </TableCell>
      <TableCell>
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left"
          onClick={() => {
            if (file.isDirectory) {
              onNavigate(file.key);
            }
          }}
          disabled={!file.isDirectory}
        >
          {file.isDirectory ? (
            <Folder className="size-4 text-info" />
          ) : (
            <FileIcon className="size-4 text-muted-foreground" />
          )}
          <span
            className={
              file.isDirectory
                ? "font-medium text-[color-mix(in_oklch,var(--info)_65%,var(--foreground))]"
                : ""
            }
          >
            {file.name}
          </span>
        </button>
      </TableCell>
      <TableCell>{file.isDirectory ? "-" : formatBytes(file.size)}</TableCell>
      {/* Folders show "-" like Size: the service derives them from key
          prefixes, which carry no mtime, so lastModified is an epoch sentinel. */}
      <TableCell>{file.isDirectory ? "-" : formatDate(file.lastModified)}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {actions.map(({ id, label, ariaLabel, icon: Icon, destructive, run }) => (
            <Button key={id} variant="ghost" size="sm" onClick={run} aria-label={ariaLabel}>
              {/* "View" reads better as a word; the rest are icons. */}
              {id === "view" ? (
                label
              ) : (
                <Icon className={destructive ? "size-4 text-destructive" : "size-4"} />
              )}
            </Button>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}
