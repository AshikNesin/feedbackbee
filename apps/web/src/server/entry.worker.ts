import type {
  D1Database,
  ExecutionContext,
  ExportedHandler,
  R2Bucket,
  Request as WorkerRequest,
  Response as WorkerResponse,
} from "@cloudflare/workers-types";
import type { MediaBucket } from "./lib/media";
import { bootWorker } from "./worker/boot";

/**
 * Cloudflare Workers entry, FeedbackBee's production runtime: D1 for the
 * database, the MEDIA R2 bucket for attachments, Static Assets for the
 * dashboard. Bindings live in wrangler.jsonc; pending migrations apply on the
 * first request of an isolate.
 */
export interface WorkerBindings {
  DB: D1Database;
  MEDIA: R2Bucket & MediaBucket;
  GITHUB_TOKEN?: string;
  [key: string]: unknown;
}

export default {
  async fetch(request: WorkerRequest, bindings: WorkerBindings, ctx: ExecutionContext) {
    const app = await bootWorker(bindings, new URL(request.url).origin);
    // Hono speaks the standard fetch types; the Workers runtime types are a superset.
    const response = await app.fetch(request as unknown as Request, bindings, ctx);
    return response as unknown as WorkerResponse;
  },
} satisfies ExportedHandler<WorkerBindings>;
