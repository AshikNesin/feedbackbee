import { and, asc, eq, gt, lt, sql } from "drizzle-orm";
import { Boom } from "@groot/core/errors";
import { batch, changes, db, githubApps, githubFlows, users } from "../../db";
import { runtime } from "../../runtime";
import type { GithubSettingsDTO } from "../../wire-types";
import {
  digest,
  encryptPrivateKey,
  encryptionConfigured,
  randomSecret,
  importAppKey,
} from "./github.crypto";
import {
  appCredentialsSchema,
  clearGithubTokens,
  getApp,
  githubJSON,
  listRepositories,
} from "./github.client";

export async function requireOwner(userId: number) {
  const [owner] = await db.select({ id: users.id }).from(users).orderBy(asc(users.id)).limit(1);
  if (owner?.id !== userId) throw Boom.forbidden("Only the deployment owner can manage GitHub");
}

export function publicOrigin(requestOrigin: string): string {
  const url = new URL(runtime().publicOrigin ?? requestOrigin);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw Boom.badRequest("Configure ORIGIN with the public HTTPS origin before connecting GitHub");
  }
  return url.origin;
}

export async function settings(): Promise<GithubSettingsDTO> {
  const app = await getApp();
  const configured = encryptionConfigured();
  let repositories: GithubSettingsDTO["repositories"] = [];
  let connectionError: string | null = null;
  if (app && configured) {
    try {
      repositories = await listRepositories();
    } catch (error) {
      connectionError = safeGithubError(error);
    }
  }
  return {
    encryptionConfigured: configured,
    app: app ? { slug: app.slug, name: app.name } : null,
    repositories,
    connectionError,
  };
}

export function safeGithubError(error: unknown): string {
  return Boom.isHttpError(error)
    ? error.message
    : "GitHub connection failed. Reconnect the app in Settings → GitHub";
}

async function beginFlow(userId: number, kind: "manifest" | "install") {
  const state = randomSecret();
  const binding = randomSecret();
  await batch([
    db.delete(githubFlows).where(lt(githubFlows.expiresAt, Date.now())),
    db.delete(githubFlows).where(eq(githubFlows.userId, userId)),
    db.insert(githubFlows).values({
      state: await digest(state),
      binding: await digest(binding),
      userId,
      kind,
      expiresAt: Date.now() + 10 * 60_000,
    }),
  ]);
  return { state, binding };
}

export async function startManifest(userId: number, origin: string, organization?: string) {
  if (!encryptionConfigured())
    throw Boom.unavailable("Configure FEEDBACKBEE_APP_KEY before registering a GitHub App");
  if (await getApp())
    throw Boom.conflict("Disconnect the existing GitHub App before registering another");
  const flow = await beginFlow(userId, "manifest");
  const url = organization
    ? `https://github.com/organizations/${encodeURIComponent(organization)}/settings/apps/new`
    : "https://github.com/settings/apps/new";
  return {
    ...flow,
    url: `${url}?state=${flow.state}`,
    manifest: {
      name: `FeedbackBee-${randomSecret().slice(0, 8)}`,
      url: origin,
      redirect_url: `${origin}/api/v1/github/callback`,
      setup_url: `${origin}/api/v1/github/installed`,
      public: false,
      hook_attributes: { url: `${origin}/api/v1/github/webhook`, active: false },
      default_permissions: { issues: "write" },
      default_events: [],
    },
  };
}

export async function startInstallation(userId: number) {
  const app = await getApp();
  if (!app) throw Boom.badRequest("Register a GitHub App first");
  const flow = await beginFlow(userId, "install");
  return {
    ...flow,
    url: `https://github.com/apps/${app.slug}/installations/new?state=${flow.state}`,
  };
}

async function claimFlow(state: string, binding: string, kind: "manifest" | "install") {
  const [flow] = await db
    .update(githubFlows)
    .set({ binding: await digest(`claimed:${binding}`) })
    .where(
      and(
        eq(githubFlows.state, await digest(state)),
        eq(githubFlows.binding, await digest(binding)),
        eq(githubFlows.kind, kind),
        gt(githubFlows.expiresAt, Date.now()),
      ),
    )
    .returning();
  if (!flow)
    throw Boom.badRequest("GitHub setup expired or is invalid. Start again from Settings → GitHub");
  await requireOwner(flow.userId);
  return flow;
}

export async function completeManifest(state: string, binding: string, code: string) {
  const flow = await claimFlow(state, binding, "manifest");
  if (await getApp()) throw Boom.conflict("A GitHub App is already connected");
  const credentials = await githubJSON(
    `/app-manifests/${encodeURIComponent(code)}/conversions`,
    appCredentialsSchema,
    undefined,
    { method: "POST" },
  );
  await importAppKey(credentials.pem);
  const encrypted = await encryptPrivateKey(credentials.pem);
  // Disconnect deletes the claimed flow too, preventing an in-flight exchange from reconnecting it.
  const [inserted] = await batch([
    db.insert(githubApps).select(
      db
        .select({
          id: sql<number>`1`,
          appId: sql<number>`${credentials.id}`,
          slug: sql<string>`${credentials.slug}`,
          name: sql<string>`${credentials.name}`,
          privateKey: sql<string>`${encrypted}`,
        })
        .from(githubFlows)
        .where(
          and(
            eq(githubFlows.state, flow.state),
            eq(githubFlows.binding, flow.binding),
            gt(githubFlows.expiresAt, Date.now()),
          ),
        )
        .limit(1),
    ),
    db.delete(githubFlows).where(eq(githubFlows.state, flow.state)),
  ]);
  if (changes(inserted) !== 1) throw Boom.badRequest("GitHub setup was cancelled. Start again");
  clearGithubTokens();
}

export async function completeInstallation(state: string, binding: string, installationId: number) {
  const flow = await claimFlow(state, binding, "install");
  // The callback id is not authority: it must belong to this app and expose a repository.
  const repositories = await listRepositories();
  await db.delete(githubFlows).where(eq(githubFlows.state, flow.state));
  if (!repositories.some((r) => r.installationId === installationId)) {
    throw Boom.badRequest("No accessible repositories found for this GitHub installation");
  }
}

export async function disconnect() {
  await batch([db.delete(githubApps), db.delete(githubFlows)]);
  clearGithubTokens();
  return { disconnected: true };
}
