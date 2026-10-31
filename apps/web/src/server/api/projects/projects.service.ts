import { desc, eq } from "drizzle-orm";
import { Boom } from "@groot/core/errors";
import { batch, db, feedback, projects, type LabelsMap, type Project } from "../../db";
import { runtime } from "../../runtime";
import type { CreateProjectInput, UpdateProjectInput } from "./projects.schema";

export const DEFAULT_LABELS: LabelsMap = {
  issue: "bug",
  feature_request: "enhancement",
  other: "feedback",
};

export async function listProjects(): Promise<Project[]> {
  return db.select().from(projects).orderBy(desc(projects.createdAt));
}

export async function getProject(id: string): Promise<Project> {
  const [project] = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  if (!project) throw Boom.notFound("Project not found");
  return project;
}

export async function findProjectBySlug(slug: string): Promise<Project | null> {
  const [project] = await db.select().from(projects).where(eq(projects.slug, slug)).limit(1);
  return project ?? null;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  if (!runtime().githubToken) {
    throw Boom.unavailable("GITHUB_TOKEN secret is not set on the worker");
  }
  if (await findProjectBySlug(input.slug)) {
    throw Boom.conflict(`Project id "${input.slug}" is already used by another project`);
  }
  const labels =
    input.labels && Object.keys(input.labels).length > 0 ? input.labels : DEFAULT_LABELS;
  const [project] = await db
    .insert(projects)
    .values({
      id: crypto.randomUUID(),
      name: input.name,
      slug: input.slug,
      githubRepo: input.githubRepo,
      labels,
    })
    .returning();
  return project!;
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  const existing = await getProject(id);
  const labels = input.labels && Object.keys(input.labels).length > 0 ? input.labels : undefined;
  const [project] = await db
    .update(projects)
    .set({
      name: input.name ?? existing.name,
      githubRepo: input.githubRepo ?? existing.githubRepo,
      labels: labels ?? existing.labels,
    })
    .where(eq(projects.id, id))
    .returning();
  return project!;
}

/** Deletes the project and its feedback rows. Media objects and GitHub issues stay. */
export async function deleteProject(id: string): Promise<void> {
  await getProject(id);
  await batch([
    db.delete(feedback).where(eq(feedback.projectId, id)),
    db.delete(projects).where(eq(projects.id, id)),
  ]);
}

const DEMO = { slug: "demo", name: "FeedbackBee demo", githubRepo: "octocat/hello-world" };

/** The `demo` project the /demo page posts to, created on first visit. */
export async function ensureDemoProject(): Promise<Project> {
  const existing = await findProjectBySlug(DEMO.slug);
  if (existing) return existing;
  await db
    .insert(projects)
    .values({ id: crypto.randomUUID(), ...DEMO, labels: DEFAULT_LABELS })
    .onConflictDoNothing(); // a concurrent visit seeded it first
  return (await findProjectBySlug(DEMO.slug))!;
}
