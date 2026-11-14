/** A daily window, `HH:MM`–`HH:MM` in an IANA time zone; it may wrap past midnight. */
interface QuietHours {
  enabled: boolean;
  start: string;
  end: string;
  timeZone: string;
}

/** `HH:MM` now in `timeZone`. */
function localTime(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${part("hour")}:${part("minute")}`;
}

/** Whether `now` falls in the quiet window; the window may wrap past midnight. */
export function inQuietHours(quiet: QuietHours, now: Date): boolean {
  if (!quiet.enabled || quiet.start === quiet.end) return false;
  const time = localTime(now, quiet.timeZone);
  return quiet.start < quiet.end
    ? time >= quiet.start && time < quiet.end
    : time >= quiet.start || time < quiet.end;
}
