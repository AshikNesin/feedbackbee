import { setupNetwork } from "@msw/cloudflare";
import { http, HttpResponse } from "msw";

export const ghCalls: Array<{ auth: string | null; path: string; body: any }> = [];
export const ghAuthCalls: Array<{ method: string; auth: string | null; path: string; body: any }> = [];

export const network = setupNetwork();

let privateKeyPromise: Promise<string> | undefined;

export function githubPrivateKey(): Promise<string> {
  privateKeyPromise ??= (async () => {
    const pair = await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"],
    );
    const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
    let binary = "";
    for (const byte of der) binary += String.fromCharCode(byte);
    const encoded = btoa(binary).match(/.{1,64}/g)?.join("\n") ?? "";
    return `-----BEGIN PRIVATE KEY-----\n${encoded}\n-----END PRIVATE KEY-----`;
  })();
  return privateKeyPromise;
}

/** Common deterministic GitHub App responses used by project and issue tests. */
export function stubGithubApp() {
  return network.use(
    http.get("https://api.github.com/app/installations", async ({ request }) => {
      record(request, {});
      return HttpResponse.json([{
        id: 701,
        app_id: 321,
        account: { login: "ashik", type: "User" },
        repository_selection: "all",
        permissions: { issues: "write" },
        suspended_at: null,
      }]);
    }),
    http.get("https://api.github.com/installation/repositories", async ({ request }) => {
      record(request, {});
      return HttpResponse.json({
        total_count: 1,
        repositories: [{ id: 902, full_name: "ashik/myapp", name: "myapp", private: true }],
      });
    }),
    http.post("https://api.github.com/app/installations/:id/access_tokens", async ({ request }) => {
      const body = await request.json().catch(() => ({}));
      record(request, body);
      return HttpResponse.json({ token: "test-installation-token", expires_at: "2099-01-01T00:00:00Z" });
    }),
    http.get("https://api.github.com/repos/:owner/:repo/installation", async ({ request }) => {
      record(request, {});
      return HttpResponse.json({ id: 701, app_id: 321 });
    }),
    http.get("https://api.github.com/repos/:owner/:repo", async ({ request, params }) => {
      record(request, {});
      return HttpResponse.json({ id: 902, full_name: `${params.owner}/${params.repo}`, private: true });
    }),
    http.post("https://api.github.com/app-manifests/:code/conversions", async ({ request, params }) => {
      record(request, {});
      return HttpResponse.json({
        id: 321,
        slug: "feedbackbee-test",
        name: "FeedbackBee test",
        pem: await githubPrivateKey(),
      });
    }),
  );
}

function record(request: Request, body: any) {
  const url = new URL(request.url);
  ghAuthCalls.push({ method: request.method, auth: request.headers.get("authorization"), path: url.pathname, body });
}

export function stubGithub(
  respond: (req: { headers: Headers; body: any; url: URL }) => { status: number; json: unknown },
) {
  return network.use(
    http.post("https://api.github.com/repos/:owner/:repo/issues", async ({ request, params }) => {
      const body = JSON.parse(await request.text());
      const url = new URL(request.url);
      ghCalls.push({ auth: request.headers.get("authorization"), path: url.pathname, body });
      ghAuthCalls.push({ method: request.method, auth: request.headers.get("authorization"), path: url.pathname, body });
      const r = respond({ headers: request.headers, body, url });
      return HttpResponse.json(r.json as never, { status: r.status });
    }),
  );
}
