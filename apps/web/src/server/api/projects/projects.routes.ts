import { Hono } from "hono";
import { ok } from "@groot/core/utils/api-response.utils";
import { parseBody, parseQuery, parseStringParam } from "@groot/core/utils/controller.utils";
import type { AppEnv } from "@groot/core/types";
import { listFeedback } from "../feedback/feedback.service";
import * as projectService from "./projects.service";
import {
  createProjectSchema,
  feedbackPageQuerySchema,
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
  const { before } = parseQuery(c, feedbackPageQuerySchema);
  return ok(c, await listFeedback(project.id, before));
});

export default router;
