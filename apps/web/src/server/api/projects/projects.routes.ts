import { Hono } from "hono";
import { ok } from "@groot/core/utils/api-response.utils";
import { parseBody, parseQuery, parseStringParam } from "@groot/core/utils/controller.utils";
import type { AppEnv } from "@groot/core/types";
import {
  deleteFeedback,
  getFeedback,
  listFeedback,
  syncProjectStatuses,
  updateFeedback,
} from "../feedback/feedback.service";
import * as projectService from "./projects.service";
import {
  createProjectSchema,
  feedbackPageQuerySchema,
  updateFeedbackSchema,
  updateProjectSchema,
} from "./projects.schema";

/** Dashboard API: `/api/v1/projects`. Mounted behind the JWT middleware. */
const router = new Hono<AppEnv>();

router.get("/", async (c) => ok(c, await projectService.listProjects()));

router.post("/", async (c) => {
  const input = await parseBody(c, createProjectSchema);
  return ok(c, await projectService.createProject(input), 201);
});

router.get("/:id", async (c) => {
  return ok(c, await projectService.getProject(parseStringParam(c.req.param("id"), "id")));
});

router.patch("/:id", async (c) => {
  const id = parseStringParam(c.req.param("id"), "id");
  return ok(c, await projectService.updateProject(id, await parseBody(c, updateProjectSchema)));
});

router.delete("/:id", async (c) => {
  const id = parseStringParam(c.req.param("id"), "id");
  await projectService.deleteProject(id);
  return ok(c, { id });
});

router.get("/:id/feedback", async (c) => {
  const project = await projectService.getProject(parseStringParam(c.req.param("id"), "id"));
  const { before, status } = parseQuery(c, feedbackPageQuerySchema);
  return ok(c, await listFeedback(project.id, before, undefined, status));
});

router.get("/:id/feedback/:feedbackId", async (c) => {
  const project = await projectService.getProject(parseStringParam(c.req.param("id"), "id"));
  const feedbackId = parseStringParam(c.req.param("feedbackId"), "feedbackId");
  return ok(c, await getFeedback(project.id, feedbackId));
});

/** Edit status, kind or text; a filed report's GitHub issue follows. Returns the report. */
router.patch("/:id/feedback/:feedbackId", async (c) => {
  const project = await projectService.getProject(parseStringParam(c.req.param("id"), "id"));
  const feedbackId = parseStringParam(c.req.param("feedbackId"), "feedbackId");
  const input = await parseBody(c, updateFeedbackSchema);
  return ok(c, await updateFeedback(project, feedbackId, input, new URL(c.req.url).origin));
});

/** Delete a report from FeedbackBee; its GitHub issue and media stay. */
router.delete("/:id/feedback/:feedbackId", async (c) => {
  const project = await projectService.getProject(parseStringParam(c.req.param("id"), "id"));
  const feedbackId = parseStringParam(c.req.param("feedbackId"), "feedbackId");
  await deleteFeedback(project.id, feedbackId);
  return ok(c, { id: feedbackId });
});

/** Pull issue statuses from GitHub: for missed webhooks, or apps without them. */
router.post("/:id/sync", async (c) => {
  const project = await projectService.getProject(parseStringParam(c.req.param("id"), "id"));
  return ok(c, await syncProjectStatuses(project));
});

export default router;
