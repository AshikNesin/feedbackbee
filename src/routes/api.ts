import { Hono } from "hono";
import type { Env, LabelsMap } from "../types.ts";
import { encryptSecret } from "../lib/crypto.ts";
import { repoOk, slugOk } from "../lib/validate.ts";
import { insertProject, listFeedback, listProjects, projectById } from "../db/queries.ts";
import { readCookie, requireAdmin } from "./auth.ts";

export const apiRoutes = new Hono<{ Bindings: Env }>();

apiRoutes.use("/api/*", async (c, next) => {
  const ok = await requireAdmin(c.env.DB, c.req.header("cookie"));
  if (!ok) return c.json({ error: "unauthorized" }, 401);
  await next();
});

const DEFAULT_LABELS: LabelsMap = { bug: "bug", idea: "enhancement", feedback: "feedback" };

function publicProject(p: {
  id: string;
  name: string;
  slug: string;
  github_repo: string;
  labels_map: string;
  created_at: number;
  has_pat?: boolean;
}) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    github_repo: p.github_repo,
    labels: JSON.parse(p.labels_map) as LabelsMap,
    created_at: p.created_at,
  };
}

apiRoutes.get("/api/projects", async (c) => {
  const projects = await listProjects(c.env.DB);
  return c.json({ projects: projects.map(publicProject) });
});

apiRoutes.post("/api/projects", async (c) => {
  const body = await c.req.json().catch(() => null) as
    | { name?: string; slug?: string; github_repo?: string; github_pat?: string; labels?: LabelsMap }
    | null;
  const name = body?.name?.trim();
  const slug = body?.slug?.trim().toLowerCase();
  const repo = body?.github_repo?.trim();
  const pat = body?.github_pat?.trim();
  if (!name || !slug || !repo || !pat) return c.json({ error: "name, slug, github_repo, github_pat required" }, 400);
  if (!slugOk(slug)) return c.json({ error: "slug must be 3-40 chars, a-z 0-9 and hyphens" }, 400);
  if (!repoOk(repo)) return c.json({ error: "github_repo must look like owner/repo" }, 400);
  if (pat.length < 20) return c.json({ error: "github_pat looks too short" }, 400);

  const slugTaken = await c.env.DB.prepare("SELECT 1 FROM project WHERE slug = ?").bind(slug).first();
  if (slugTaken) return c.json({ error: `slug "${slug}" is already used by another project` }, 409);

  const labels = body?.labels && Object.keys(body.labels).length > 0 ? body.labels : DEFAULT_LABELS;
  const created = await insertProject(c.env.DB, {
    name,
    slug,
    github_repo: repo,
    github_pat_enc: await encryptSecret(pat, c.env.APP_SECRET),
    labels_map: JSON.stringify(labels),
  });
  return c.json({ project: publicProject(created) }, 201);
});

apiRoutes.patch("/api/projects/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await projectById(c.env.DB, id);
  if (!existing) return c.json({ error: "not found" }, 404);

  const body = await c.req.json().catch(() => null) as
    | { name?: string; github_repo?: string; github_pat?: string; labels?: LabelsMap }
    | null;
  const name = body?.name?.trim() ?? existing.name;
  const repo = body?.github_repo?.trim() ?? existing.github_repo;
  if (!repoOk(repo)) return c.json({ error: "github_repo must look like owner/repo" }, 400);
  const labelsMap = body?.labels && Object.keys(body.labels).length > 0 ? body.labels : null;

  await c.env.DB
    .prepare(
      "UPDATE project SET name = ?, github_repo = ?, labels_map = ?, github_pat_enc = ? WHERE id = ?",
    )
    .bind(
      name,
      repo,
      labelsMap ? JSON.stringify(labelsMap) : existing.labels_map,
      body?.github_pat?.trim() ? await encryptSecret(body.github_pat.trim(), c.env.APP_SECRET) : existing.github_pat_enc,
      id,
    )
    .run();
  const updated = await projectById(c.env.DB, id);
  if (!updated) return c.json({ error: "not found" }, 404);
  return c.json({ project: publicProject(updated) });
});

apiRoutes.delete("/api/projects/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM feedback WHERE project_id = ?").bind(id).run();
  await c.env.DB.prepare("DELETE FROM project WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

apiRoutes.get("/api/projects/:id/feedback", async (c) => {
  const project = await projectById(c.env.DB, c.req.param("id"));
  if (!project) return c.json({ error: "not found" }, 404);
  const before = Number(c.req.query("before")) || undefined;
  const page = await listFeedback(c.env.DB, project.id, before);
  return c.json({
    feedback: page.items,
    hasMore: page.hasMore,
  });
});
