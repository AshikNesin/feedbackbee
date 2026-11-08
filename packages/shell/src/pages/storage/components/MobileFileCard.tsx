import { Button } from "@groot/ui/button";
import { Card } from "@groot/ui/card";
import { Checkbox } from "@groot/ui/checkbox";
import { cn } from "@groot/ui/lib/utils";
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
  /** The card's actions, from `useStorageBrowser().fileActions(file)`. */
  actions: FileAction[];
};

/** Mobile card view for a single file/folder: a row of labelled buttons for `actions`. */
export function MobileFileCard({ file, selected, onToggle, onNavigate, actions }: Props) {
  return (
    <Card className={cn("gap-3 p-4", selected && "bg-muted")}>
      <div className="flex items-start justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {!file.isDirectory && (
            <Checkbox
              checked={selected}
              onCheckedChange={() => onToggle(file.key)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select ${file.name}`}
            />
          )}
          {file.isDirectory ? (
            <button
              type="button"
              className="flex items-center gap-2"
              onClick={() => onNavigate(file.key)}
            >
              <Folder className="size-5 flex-shrink-0 text-info" />
              <span className="truncate font-medium text-info">{file.name}</span>
            </button>
          ) : (
            <>
              <FileIcon className="size-5 flex-shrink-0 text-muted-foreground" />
              <span className="truncate">{file.name}</span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div>
          <span className="block">Size</span>
          <span className="font-medium text-foreground">
            {file.isDirectory ? "-" : formatBytes(file.size)}
          </span>
        </div>
        <div>
          <span className="block">Modified</span>
          <span className="font-medium text-foreground">
            {/* Folders: "-" — the epoch sentinel isn't a date (see
                DesktopFileRow). */}
            {file.isDirectory ? "-" : formatDate(file.lastModified)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {actions.map(({ id, label, ariaLabel, icon: Icon, destructive, run }) => (
          <Button
            key={id}
            variant={destructive ? "destructive" : "outline"}
            size="sm"
            onClick={run}
            aria-label={ariaLabel}
            className="flex-1"
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
