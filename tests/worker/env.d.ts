// The bindings `env` from "cloudflare:test" carries: wrangler.jsonc's, as the
// Worker entry receives them (WorkerBindings in apps/web/src/server/entry.worker.ts).
declare namespace Cloudflare {
  interface Env {
    DB: import("@cloudflare/workers-types").D1Database;
    MEDIA: import("@cloudflare/workers-types").R2Bucket;
  }
}
