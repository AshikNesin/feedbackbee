import { SignJWT } from "jose";
import { z } from "zod";
import { Boom } from "@groot/core/errors";
import { db, githubApps, type FeedbackStatus } from "../../db";
import { IN_PROGRESS_LABEL, issueUpdate, type IssueSnapshot } from "../../lib/issue-status";
import type { GithubRepositoryDTO } from "../../wire-types";
import { decryptPrivateKey, importAppKey } from "./github.crypto";

const API = "https://api.github.com";
const repositorySchema = z.object({
  id: z.number().int().positive(),
  full_name: z.string(),
  has_issues: z.boolean().optional(),
});
const installationSchema = z.object({
  id: z.number().int().positive(),
  suspended_at: z.string().nullable().optional(),
  permissions: z.object({ issues: z.string().optional() }),
});
const tokenSchema = z.object({ token: z.string().min(1), expires_at: z.iso.datetime() });
export const appCredentialsSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().regex(/^[\w-]+$/),
  name: z.string(),
  pem: z.string().min(1),
  webhook_secret: z.string().min(1).nullable().optional(),
});

export async function githubFetch(
  path: string,
  token?: string,
  init: RequestInit = {},
): Promise<Response> {
  try {
    return await fetch(`${API}${path}`, {
      ...init,
      // Workers supports manual redirects, not error; never forward credentials.
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "feedbackbee",
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch {
    throw Boom.unavailable("GitHub is unreachable. Try again later");
  }
}

export async function githubJSON<T>(
  path: string,
  schema: z.ZodType<T>,
  token?: string,
  init?: RequestInit,
): Promise<T> {
  const response = await githubFetch(path, token, init);
  if (!response.ok) throw Boom.unavailable(`GitHub ${response.status}: request failed`);
  const parsed = schema.safeParse(await response.json().catch(() => null));
  if (!parsed.success) throw Boom.unavailable("GitHub returned an invalid response");
  return parsed.data;
}

export async function getApp() {
  const [app] = await db.select().from(githubApps).limit(1);
  return app ?? null;
}

export async function appAuthentication() {
  const app = await getApp();
  if (!app) throw Boom.unavailable("Connect a GitHub App in Settings → GitHub first");
  const key = await importAppKey(await decryptPrivateKey(app.privateKey));
  return { app, jwt: await signAppJwt(app.appId, key) };
}

export async function signAppJwt(appId: number, key: CryptoKey) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(String(appId))
    .setIssuedAt(now - 60)
    .setExpirationTime(now + 540)
    .sign(key);
}

type Authentication = Awaited<ReturnType<typeof appAuthentication>>;
const tokens = new Map<string, { token: string; expires: number }>();
export function clearGithubTokens() {
  tokens.clear();
}

async function installationToken(
  auth: Authentication,
  installationId: number,
  repositoryId?: number,
  refresh = false,
) {
  const cacheKey = `${auth.app.appId}:${installationId}:${repositoryId ?? "list"}`;
  const cached = tokens.get(cacheKey);
  if (!refresh && cached && cached.expires > Date.now() + 60_000) return cached.token;
  const value = await githubJSON(
    `/app/installations/${installationId}/access_tokens`,
    tokenSchema,
    auth.jwt,
    {
      method: "POST",
      body: JSON.stringify({
        permissions: { issues: "write" },
        ...(repositoryId ? { repository_ids: [repositoryId] } : {}),
      }),
    },
  );
  if (tokens.size > 200) tokens.clear();
  tokens.set(cacheKey, { token: value.token, expires: Date.parse(value.expires_at) });
  return value.token;
}

function checkInstallation(installation: z.infer<typeof installationSchema>) {
  if (installation.suspended_at || installation.permissions.issues !== "write") {
    throw Boom.unavailable(
      "GitHub App installation is suspended or missing Issues: read/write permission",
    );
  }
}

/** Refresh from GitHub, not a local allow-list that can outlive revoked access. */
export async function listRepositories(): Promise<GithubRepositoryDTO[]> {
  const auth = await appAuthentication();
  const repositories: GithubRepositoryDTO[] = [];
  for (let page = 1; ; page++) {
    const installations = await githubJSON(
      `/app/installations?per_page=100&page=${page}`,
      z.array(installationSchema),
      auth.jwt,
    );
    for (const installation of installations) {
      if (installation.suspended_at || installation.permissions.issues !== "write") continue;
      let token = await installationToken(auth, installation.id);
      for (let repoPage = 1; ; repoPage++) {
        const path = `/installation/repositories?per_page=100&page=${repoPage}`;
        let response = await githubFetch(path, token);
        if (response.status === 401) {
          token = await installationToken(auth, installation.id, undefined, true);
          response = await githubFetch(path, token);
        }
        if (!response.ok) throw Boom.unavailable(`GitHub ${response.status}: request failed`);
        const parsed = z
          .object({ repositories: z.array(repositorySchema) })
          .safeParse(await response.json());
        if (!parsed.success) throw Boom.unavailable("GitHub returned an invalid response");
        for (const repo of parsed.data.repositories) {
          if (repo.has_issues !== false)
            repositories.push({
              id: repo.id,
              fullName: repo.full_name,
              installationId: installation.id,
            });
        }
        if (parsed.data.repositories.length < 100) break;
      }
    }
    if (installations.length < 100) break;
  }
  return repositories.sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function repositoryAccess(repo: string) {
  const auth = await appAuthentication();
  const path = repo.split("/").map(encodeURIComponent).join("/");
  const installation = await githubJSON(
    `/repos/${path}/installation`,
    installationSchema,
    auth.jwt,
  );
  checkInstallation(installation);
  let token = await installationToken(auth, installation.id);
  let response = await githubFetch(`/repos/${path}`, token);
  if (response.status === 401) {
    token = await installationToken(auth, installation.id, undefined, true);
    response = await githubFetch(`/repos/${path}`, token);
  }
  if (!response.ok) throw Boom.unavailable(`GitHub ${response.status}: repository access failed`);
  const parsed = repositorySchema.safeParse(await response.json());
  if (!parsed.success) throw Boom.unavailable("GitHub returned an invalid repository");
  if (parsed.data.has_issues === false)
    throw Boom.badRequest("Enable GitHub Issues for this repository first");
  return { auth, installationId: installation.id, repositoryId: parsed.data.id, path };
}

/** A repository-scoped caller that retries once with a fresh token on 401. */
async function repositoryCaller(repo: string) {
  const access = await repositoryAccess(repo);
  let token = await installationToken(access.auth, access.installationId, access.repositoryId);
  return {
    path: access.path,
    async call(path: string, init?: RequestInit) {
      let response = await githubFetch(path, token, init);
      if (response.status === 401) {
        token = await installationToken(
          access.auth,
          access.installationId,
          access.repositoryId,
          true,
        );
        response = await githubFetch(path, token, init);
      }
      return response;
    },
  };
}

export async function createGithubIssue(
  repo: string,
  issue: { title: string; body: string; labels: string[] },
) {
  const github = await repositoryCaller(repo);
  const init = { method: "POST", body: JSON.stringify(issue) };
  const response = await github.call(`/repos/${github.path}/issues`, init);
  if (!response.ok) throw Boom.unavailable(`GitHub ${response.status}: request failed`);
  const parsed = z
    .object({ number: z.number().int().positive(), html_url: z.url() })
    .safeParse(await response.json());
  if (!parsed.success) throw Boom.unavailable("GitHub returned an invalid issue");
  return { number: parsed.data.number, url: parsed.data.html_url };
}

const graphqlIssueSchema = z
  .object({
    state: z.enum(["OPEN", "CLOSED"]),
    stateReason: z.string().nullable().optional(),
    labels: z.object({ nodes: z.array(z.object({ name: z.string() })) }),
  })
  .nullable();

/** Issues read per GraphQL query; one request covers a page of feedback. */
export const ISSUE_BATCH = 100;

/**
 * Current state of up to {@link ISSUE_BATCH} issues in one GraphQL request.
 * Deleted, transferred or inaccessible issues are absent from the result.
 */
export async function fetchGithubIssues(
  repo: string,
  numbers: number[],
): Promise<Map<number, IssueSnapshot>> {
  const result = new Map<number, IssueSnapshot>();
  const unique = [...new Set(numbers.map((n) => Math.trunc(n)))].slice(0, ISSUE_BATCH);
  if (unique.length === 0) return result;
  const [owner, name] = repo.split("/");
  const fields = unique
    .map(
      (n) =>
        `i${n}: issue(number: ${n}) { state stateReason labels(first: 50) { nodes { name } } }`,
    )
    .join("\n");
  const github = await repositoryCaller(repo);
  const response = await github.call("/graphql", {
    method: "POST",
    body: JSON.stringify({
      query: `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { ${fields} } }`,
      variables: { owner, name },
    }),
  });
  if (!response.ok) throw Boom.unavailable(`GitHub ${response.status}: request failed`);
  // Missing issues come back as null plus an `errors` entry; the rest still resolve.
  const parsed = z
    .object({
      data: z.object({ repository: z.record(z.string(), graphqlIssueSchema).nullable() }),
    })
    .safeParse(await response.json().catch(() => null));
  if (!parsed.success || !parsed.data.data.repository)
    throw Boom.unavailable("GitHub returned an invalid response");
  for (const n of unique) {
    const issue = parsed.data.data.repository[`i${n}`];
    if (issue)
      result.set(n, {
        state: issue.state === "OPEN" ? "open" : "closed",
        stateReason: issue.stateReason ?? null,
        labels: issue.labels.nodes.map((label) => label.name),
      });
  }
  return result;
}

/** Make the issue reflect `status`: open/closed with its reason, and the in-progress label. */
export async function updateGithubIssue(repo: string, number: number, status: FeedbackStatus) {
  const update = issueUpdate(status);
  const github = await repositoryCaller(repo);
  const issue = `/repos/${github.path}/issues/${number}`;
  const patched = await github.call(issue, {
    method: "PATCH",
    body: JSON.stringify({
      state: update.state,
      ...(update.stateReason ? { state_reason: update.stateReason } : {}),
    }),
  });
  if (!patched.ok) throw Boom.unavailable(`GitHub ${patched.status}: issue update failed`);
  const label = update.inProgressLabel
    ? await github.call(`${issue}/labels`, {
        method: "POST",
        body: JSON.stringify({ labels: [IN_PROGRESS_LABEL] }),
      })
    : await github.call(`${issue}/labels/${encodeURIComponent(IN_PROGRESS_LABEL)}`, {
        method: "DELETE",
      });
  // 404 on DELETE: the label was not on the issue.
  if (!label.ok && label.status !== 404)
    throw Boom.unavailable(`GitHub ${label.status}: label update failed`);
}

/** Set the App's webhook secret, for manifests where GitHub did not return one. */
export async function setWebhookSecret(jwt: string, secret: string) {
  const response = await githubFetch("/app/hook/config", jwt, {
    method: "PATCH",
    body: JSON.stringify({ secret, content_type: "json" }),
  });
  if (!response.ok) throw Boom.unavailable(`GitHub ${response.status}: webhook setup failed`);
}
