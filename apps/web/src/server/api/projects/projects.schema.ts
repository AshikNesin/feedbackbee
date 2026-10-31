import { z } from "zod";
import { normalizeOrigin } from "../../lib/origins";

/** Project id used in embed snippets: 3-40 chars, a-z 0-9 and inner hyphens. */
const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/,
    "Project id must be 3-40 characters: a-z, 0-9 and hyphens",
  );

const githubRepo = z
  .string()
  .trim()
  .regex(/^[\w.-]+\/[\w.-]+$/, "GitHub repo must look like owner/repo");

const label = z.string().trim().min(1).max(50).optional();

/** Browser origins allowed to submit, normalized; duplicates dropped. Empty: any site. */
export const allowedOriginsSchema = z
  .array(z.string())
  .max(20, "At most 20 allowed origins")
  .transform((entries, ctx) => {
    const out: string[] = [];
    for (const entry of entries.filter((e) => e.trim() !== "")) {
      const origin = normalizeOrigin(entry);
      if (!origin) {
        ctx.addIssue({
          code: "custom",
          message: `"${entry.trim().slice(0, 100)}" is not an origin: use https://example.com, http://localhost:3000 or https://*.example.com`,
        });
        return z.NEVER;
      }
      if (!out.includes(origin)) out.push(origin);
    }
    return out;
  });

/** GitHub label per feedback kind. */
export const labelsSchema = z.object({ issue: label, feature_request: label, other: label });

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  slug,
  githubRepo,
  labels: labelsSchema.optional(),
  allowedOrigins: allowedOriginsSchema.optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100).optional(),
  githubRepo: githubRepo.optional(),
  labels: labelsSchema.optional(),
  allowedOrigins: allowedOriginsSchema.optional(),
});

export const feedbackPageQuerySchema = z.object({
  /** Cursor: `createdAt` (epoch ms) of the last item of the previous page. */
  before: z.coerce.number().int().positive().optional(),
});

export type CreateProjectInput = z.output<typeof createProjectSchema>;
export type UpdateProjectInput = z.output<typeof updateProjectSchema>;
