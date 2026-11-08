import { z } from "zod";

export const upsertAppSettingSchema = z.object({
  value: z.unknown(),
  metadata: z
    .object({
      description: z.string().optional(),
    })
    .optional(),
});

export type UpsertAppSettingDTO = z.infer<typeof upsertAppSettingSchema>;

/** `POST /settings`: create a setting; refused (409) when the key exists. */
export const createAppSettingSchema = upsertAppSettingSchema.extend({
  key: z.string().trim().min(1, "Key is required"),
});

export type CreateAppSettingDTO = z.infer<typeof createAppSettingSchema>;

export interface AppSettingMetadata {
  description?: string;
  updatedAt: string;
}

/**
 * One row of `GET /settings`, typed as it arrives over JSON. Declared in this
 * zod-only module so the client can import it (type-only) without pulling in
 * the service's server graph.
 */
export interface AppSetting<T = unknown> {
  key: string;
  value: T;
  metadata?: AppSettingMetadata;
}
