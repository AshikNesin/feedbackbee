import { setupNetwork } from "@msw/cloudflare";
import { http, HttpResponse } from "msw";

export const ghCalls: Array<{ auth: string | null; path: string; body: any }> = [];

export const network = setupNetwork();

export function stubGithub(
  respond: (req: { headers: Headers; body: any; url: URL }) => { status: number; json: unknown },
) {
  return network.use(
    http.post("https://api.github.com/repos/:owner/:repo/issues", async ({ request, params }) => {
      const body = JSON.parse(await request.text());
      const url = new URL(request.url);
      ghCalls.push({ auth: request.headers.get("authorization"), path: url.pathname, body });
      const r = respond({ headers: request.headers, body, url });
      return HttpResponse.json(r.json as never, { status: r.status });
    }),
  );
}
