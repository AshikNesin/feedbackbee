/**
 * Allowed origins for a project's public submit endpoint. An entry is a
 * scheme + host (+ port): `https://shop.example.com`, `http://localhost:3000`,
 * or a wildcard over subdomains, `https://*.example.com` (which does not cover
 * `https://example.com` itself; list that too).
 *
 * The check is a browser control: the Origin header is set by the browser, so
 * other websites cannot post to the project through the widget. A request
 * without an Origin (the Android SDK, any native app) is not a browser
 * request and passes; a script could forge any Origin anyway. The rate limit
 * covers those.
 */

/** The canonical form of an allowed-origin entry, or null when it is not one. */
export function normalizeOrigin(entry: string): string | null {
  const raw = entry.trim().toLowerCase().replace(/\/+$/, "");
  const wildcard = /^(https?):\/\/\*\.(.+)$/.exec(raw);
  const candidate = wildcard ? `${wildcard[1]}://wildcard.${wildcard[2]}` : raw;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
  // a wildcard needs a registrable domain under it: *.example.com, never *.com
  if (!url.hostname || (wildcard && !wildcard[2]!.includes("."))) return null;
  // URL.origin drops default ports, so https://x.com:443 and https://x.com match alike
  return wildcard ? url.origin.replace("://wildcard.", "://*.") : url.origin;
}

/** Whether a request's Origin header is one of `allowed` (normalized entries). */
export function originAllowed(origin: string, allowed: readonly string[]): boolean {
  const actual = normalizeOrigin(origin);
  if (!actual || actual.includes("*")) return false;
  const { protocol, host } = new URL(actual);
  return allowed.some((entry) => {
    if (!entry.includes("://*.")) return entry === actual;
    const [scheme, suffix] = entry.split("://*.") as [string, string];
    return `${scheme}:` === protocol && host.endsWith(`.${suffix}`);
  });
}
