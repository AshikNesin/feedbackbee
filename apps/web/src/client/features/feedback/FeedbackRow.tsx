import { CircleDot, ExternalLink, Mail, Mic, Play } from "lucide-react";
import { Badge } from "@groot/ui/badge";
import { Button } from "@groot/ui/button";
import { DataField, DataFields } from "@groot/ui/display";
import { listRowClass } from "@groot/ui/list-row";
import { StatusBadge } from "@groot/ui/status-badge";
import { Text, monoClass } from "@groot/ui/typography";
import { cn } from "@groot/ui/lib/utils";
import { formatLocaleDateTime, formatRelativeTime } from "@groot/shell/lib/date.utils";
import type { FeedbackItemDTO } from "../../../server/wire-types";
import { KIND_LABELS, browser, clock, isReplay, pagePath } from "./format";

/** One report: a summary row that expands into its attachments and context. */
export function FeedbackRow({
  item,
  open,
  onToggle,
}: {
  item: FeedbackItemDTO;
  open: boolean;
  onToggle: () => void;
}) {
  const images = item.images.map((key) => `/f/${key}`);
  const replay = isReplay(item.recordingKey);
  const video = item.recordingKey && !replay ? `/f/${item.recordingKey}` : null;
  const where = pagePath(item.url);
  const device = item.deviceModel || browser(item.userAgent);

  return (
    <li id={`feedback-${item.id}`}>
      <button
        type="button"
        className={cn(listRowClass, "w-full items-start text-left")}
        aria-expanded={open}
        onClick={onToggle}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className={cn(!open && "line-clamp-2")}>
            <Text>{item.text}</Text>
          </p>
          <p className="flex flex-wrap gap-x-3 gap-y-1">
            <Text variant="meta">{KIND_LABELS[item.kind]}</Text>
            <Text variant="meta" title={formatLocaleDateTime(item.createdAt)}>
              {formatRelativeTime(item.createdAt)}
            </Text>
            {where && <Text variant="meta">{where}</Text>}
            {device && <Text variant="meta">{device}</Text>}
            {item.reporterEmail && <Text variant="meta">{item.reporterEmail}</Text>}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {item.recordingKey && (
            <Badge variant="outline">
              <Play className="size-3" />
              {clock(item.recordingSeconds)}
            </Badge>
          )}
          {item.audioKey && (
            <Badge variant="outline">
              <Mic className="size-3" />
              {clock(item.audioSeconds)}
            </Badge>
          )}
          {images.length > 0 && (
            <img src={images[0]} alt="" loading="lazy" className="size-9 rounded-md object-cover" />
          )}
          {item.state === "created" ? (
            <Badge variant="secondary">#{item.issueNumber}</Badge>
          ) : (
            <StatusBadge
              status={item.state === "pending" ? "pending" : "failed"}
              label={item.state === "pending" ? "Pending" : "Not filed"}
            />
          )}
        </div>
      </button>

      {open && (
        <div className="space-y-4 px-4 pb-5 sm:px-5">
          {images.length > 0 && (
            <div className={cn("grid gap-2", images.length > 1 && "sm:grid-cols-2")}>
              {images.map((src, i) => (
                <a key={src} href={src} target="_blank" rel="noreferrer">
                  <img
                    src={src}
                    alt={`Image ${i + 1}`}
                    loading="lazy"
                    className="max-h-96 max-w-full rounded-xl object-contain"
                  />
                </a>
              ))}
            </div>
          )}
          {video && <video src={video} controls preload="metadata" className="w-full rounded-xl" />}
          {item.audioKey && (
            <audio src={`/f/${item.audioKey}`} controls preload="none" className="w-full" />
          )}

          <div className="flex flex-wrap gap-2">
            {item.issueUrl && (
              <Button variant="outline" size="sm" asChild>
                <a href={item.issueUrl} target="_blank" rel="noreferrer">
                  <CircleDot className="size-3.5" />
                  Issue #{item.issueNumber}
                </a>
              </Button>
            )}
            {replay && (
              <Button variant="outline" size="sm" asChild>
                <a href={`/replay/${item.recordingKey}`} target="_blank" rel="noreferrer">
                  <Play className="size-3.5" />
                  Watch replay
                </a>
              </Button>
            )}
            {item.reporterEmail && (
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${item.reporterEmail}`}>
                  <Mail className="size-3.5" />
                  Reply
                </a>
              </Button>
            )}
          </div>

          {item.state === "issue_error" && item.issueError && (
            <p>
              <Text tone="destructive">
                Couldn&apos;t create the GitHub issue: {item.issueError}
              </Text>
            </p>
          )}

          <DataFields columns={2}>
            {item.url && (
              <DataField label="Page">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 break-all underline-offset-4 hover:underline"
                >
                  {item.url}
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              </DataField>
            )}
            <DataField label="Sent">{formatLocaleDateTime(item.createdAt)}</DataField>
            {item.reporterName && <DataField label="Name">{item.reporterName}</DataField>}
            {item.reporterId && (
              <DataField label="User">
                <code className={monoClass}>{item.reporterId}</code>
              </DataField>
            )}
            {item.osName === "web"
              ? browser(item.userAgent) && (
                  <DataField label="Browser">{browser(item.userAgent)}</DataField>
                )
              : item.osName && (
                  <DataField label="OS">
                    {[item.osName, item.osVersion].filter(Boolean).join(" ")}
                  </DataField>
                )}
            {item.deviceModel && <DataField label="Device">{item.deviceModel}</DataField>}
            {item.appVersion && <DataField label="App version">{item.appVersion}</DataField>}
            {item.screenW && item.screenH && (
              <DataField label="Screen">
                {item.screenW}×{item.screenH}
              </DataField>
            )}
            {item.metadata && Object.keys(item.metadata).length > 0 && (
              <DataField label="Metadata">
                <span className="flex flex-col gap-0.5">
                  {Object.entries(item.metadata).map(([key, value]) => (
                    <span key={key}>
                      <code className={monoClass}>{key}</code> {String(value)}
                    </span>
                  ))}
                </span>
              </DataField>
            )}
            {item.userAgent && (
              <DataField label="User agent" className="sm:col-span-2">
                <span className="break-all">{item.userAgent}</span>
              </DataField>
            )}
          </DataFields>
        </div>
      )}
    </li>
  );
}
