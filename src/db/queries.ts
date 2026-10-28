import type { FeedbackRow, ProjectRow } from "../types.ts";
import { newId } from "../lib/crypto.ts";

export type NewProject = {
  name: string;
  slug: string;
  github_repo: string;
  labels_map: string;
};

export async function insertProject(db: D1Database, p: NewProject): Promise<ProjectRow> {
  const row: ProjectRow = {
    id: newId(),
    name: p.name,
    slug: p.slug,
    github_repo: p.github_repo,
    labels_map: p.labels_map,
    created_at: Date.now(),
  };
  await db
    .prepare(
      "INSERT INTO project (id, name, slug, github_repo, labels_map, created_at) " +
        "VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(row.id, row.name, row.slug, row.github_repo, row.labels_map, row.created_at)
    .run();
  return row;
}

export async function projectBySlug(db: D1Database, slug: string): Promise<ProjectRow | null> {
  return db
    .prepare("SELECT * FROM project WHERE slug = ?")
    .bind(slug)
    .first<ProjectRow>();
}

export async function projectById(db: D1Database, id: string): Promise<ProjectRow | null> {
  return db.prepare("SELECT * FROM project WHERE id = ?").bind(id).first<ProjectRow>();
}

export async function listProjects(db: D1Database): Promise<ProjectRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM project ORDER BY created_at DESC")
    .all<ProjectRow>();
  return results;
}

export type NewFeedback = Omit<FeedbackRow, "id" | "state" | "issue_number" | "issue_url" | "issue_error" | "created_at">;

export async function insertFeedback(db: D1Database, f: NewFeedback, imageKeys: string[]): Promise<FeedbackRow> {
  const row: FeedbackRow = {
    ...f,
    id: newId(),
    state: "pending",
    issue_number: null,
    issue_url: null,
    issue_error: null,
    created_at: Date.now(),
  };
  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        "INSERT INTO feedback (id, project_id, kind, text, reporter_email, reporter_name, reporter_id, metadata, url, user_agent, screen_w, screen_h, " +
          "media_kind, media_key, media_seconds, audio_key, audio_seconds, app_version, os_name, os_version, device_model, state, created_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        row.id, row.project_id, row.kind, row.text, row.reporter_email, row.reporter_name, row.reporter_id,
        row.metadata, row.url, row.user_agent, row.screen_w, row.screen_h,
        row.media_kind, row.media_key, row.media_seconds,
        row.audio_key, row.audio_seconds,
        row.app_version, row.os_name, row.os_version, row.device_model, row.state, row.created_at,
      ),
    ...imageKeys.map((key, position) =>
      db
        .prepare("INSERT INTO feedback_image (feedback_id, position, key) VALUES (?, ?, ?)")
        .bind(row.id, position, key),
    ),
  ];
  await db.batch(statements);
  return row;
}

export async function markIssueCreated(db: D1Database, id: string, number: number, url: string): Promise<void> {
  await db
    .prepare("UPDATE feedback SET state = 'created', issue_number = ?, issue_url = ?, issue_error = NULL WHERE id = ?")
    .bind(number, url, id)
    .run();
}

export async function markIssueError(db: D1Database, id: string, error: string): Promise<void> {
  await db
    .prepare("UPDATE feedback SET state = 'issue_error', issue_error = ? WHERE id = ?")
    .bind(error, id)
    .run();
}

export type FeedbackItem = FeedbackRow & { images: string[] };
export type FeedbackPage = { items: FeedbackItem[]; hasMore: boolean };

export async function listFeedback(
  db: D1Database,
  projectId: string,
  before?: number,
  limit = 25,
): Promise<FeedbackPage> {
  const rows = before
    ? await db
        .prepare("SELECT * FROM feedback WHERE project_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?")
        .bind(projectId, before, limit + 1)
        .all<FeedbackRow>()
    : await db
        .prepare("SELECT * FROM feedback WHERE project_id = ? ORDER BY created_at DESC LIMIT ?")
        .bind(projectId, limit + 1)
        .all<FeedbackRow>();
  const pageRows = rows.results.slice(0, limit);
  const images = await imageKeysFor(db, pageRows.map((r) => r.id));
  return {
    items: pageRows.map((r, i) => ({ ...r, images: images[i]! })),
    hasMore: rows.results.length > limit,
  };
}

// One query per page: image keys per feedback row, in position order.
async function imageKeysFor(db: D1Database, ids: string[]): Promise<string[][]> {
  const byId = new Map<string, string[]>();
  if (ids.length > 0) {
    const { results } = await db
      .prepare(
        "SELECT feedback_id, position, key FROM feedback_image WHERE feedback_id IN " +
          `(${ids.map(() => "?").join(",")}) ORDER BY feedback_id, position`,
      )
      .bind(...ids)
      .all<{ feedback_id: string; position: number; key: string }>();
    for (const r of results) {
      const list = byId.get(r.feedback_id) ?? [];
      list.push(r.key);
      byId.set(r.feedback_id, list);
    }
  }
  return ids.map((id) => byId.get(id) ?? []);
}
