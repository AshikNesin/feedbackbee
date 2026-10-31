import { SELF } from "cloudflare:test";

export const ORIGIN = "https://example.com";
export const OWNER = { email: "owner@test.dev", password: "hunter2boogaloo" }; // gitleaks:allow (test-only account)

export const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
export const WEBM = [0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0];

export const png = (fill = 0) =>
  new File([new Uint8Array([...PNG, fill, fill, fill, fill])], `shot-${fill}.png`, {
    type: "image/png",
  });

export const webm = (name = "voice.webm") =>
  new File([new Uint8Array(WEBM)], name, { type: "audio/webm" });

/** A gzipped rrweb replay, like the web widget records. */
export async function replay(doc: unknown = { v: 1, events: [{ type: 4, timestamp: 1 }] }) {
  const json = JSON.stringify(doc);
  const gz = await new Response(
    new Blob([json]).stream().pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();
  return new File([gz], "replay.json.gz", { type: "application/gzip" });
}

let ownerCookie: Promise<string> | undefined;

/**
 * Sign in as the owner (the first sign-in creates the account); returns the
 * cookie. Memoised per test file: core rate-limits sign-ins per IP.
 */
export function login(): Promise<string> {
  ownerCookie ??= signIn(OWNER);
  return ownerCookie;
}

async function signIn(credentials: { email: string; password: string }): Promise<string> {
  const res = await SELF.fetch(`${ORIGIN}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  return res.headers.get("set-cookie")?.split(";")[0] ?? "";
}

/** A dashboard API call; returns the status and the parsed envelope. */
export async function api(
  cookie: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
) {
  const res = await SELF.fetch(`${ORIGIN}/api/v1${path}`, {
    method: init.method ?? "GET",
    headers: { cookie, "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

let counter = 0;

/** Create a project with a unique slug; returns it. */
export async function createProject(
  cookie: string,
  prefix = "app",
  extra: Record<string, unknown> = {},
) {
  const slug = `${prefix}-${Date.now().toString(36)}-${counter++}`;
  const { status, body } = await api(cookie, "/projects", {
    method: "POST",
    body: { name: "My App", slug, githubRepo: "ashik/myapp", ...extra },
  });
  if (status !== 201) throw new Error(`create project failed: ${status} ${JSON.stringify(body)}`);
  return body.data as { id: string; slug: string };
}

/** POST /api/v1/feedback with these form fields (arrays repeat a part). */
export async function submit(
  fields: Record<string, string | File | Array<string | File>>,
  headers: Record<string, string> = {},
) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    for (const part of Array.isArray(value) ? value : [value]) form.append(name, part);
  }
  const res = await SELF.fetch(`${ORIGIN}/api/v1/feedback`, {
    method: "POST",
    body: form,
    headers,
  });
  return { status: res.status, headers: res.headers, body: (await res.json()) as any };
}

/** The newest feedback of a project, through the dashboard API. */
export async function latestFeedback(cookie: string, projectId: string) {
  const { body } = await api(cookie, `/projects/${projectId}/feedback`);
  return body.data.items[0];
}
