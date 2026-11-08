# @groot/ai

## 1.1.0

### Minor Changes

- [#165](https://github.com/AshikNesin/groot/pull/165) [`54114be`](https://github.com/AshikNesin/groot/commit/54114befbea0c34234811b3a4e66d75d0ad17e93) Thanks [@AshikNesin](https://github.com/AshikNesin)! - `AIConfig.model` also takes an already-resolved pi-ai model, used as-is, so a model built elsewhere, or pi-ai's faux model in tests, plugs into `AIClient`. `resolveModel()` returns it unchanged (or a copy with a new id for `withModel()`). The new `@groot/ai/testing` entrypoint re-exports pi-ai's faux provider (`registerFauxProvider`, `fauxAssistantMessage`, `fauxText`, `fauxThinking`, `fauxToolCall`) for scripted, network-free tests.
  
  When `reasoning` is set, the client now caps it with the effort rules: a model pi-ai has no thinking-level map for (custom endpoints) gets the level capped at `maxReasoningEffort(model.id)`, and no reasoning parameter at all when the model takes no effort control. Catalog models with a map are left to pi-ai's own clamp. `clampReasoningEffort(modelId, level)` exposes the rule.

## 1.0.1

### Patch Changes

- [#154](https://github.com/AshikNesin/groot/pull/154) [`4acfa49`](https://github.com/AshikNesin/groot/commit/4acfa49e504c19534ade389a857f843f3b8ea5c9) Thanks [@AshikNesin](https://github.com/AshikNesin)! - chore(deps): upgrade dependencies to the versions tiny-agents runs
  
  Every dependency groot shares with tiny-agents now matches its version, so a
  sync no longer conflicts on version ranges.
  
  - **Majors.** Vite+ 1.4 with Vitest 5, Sentry 11 (`@sentry/node`,
    `@sentry/cloudflare` and the build plugins), SimpleWebAuthn 14,
    better-sqlite3 13, jsdom 30, `@testing-library/jest-dom` 7,
    `@hookform/resolvers` 6, `@types/node` 26, changesets 3 (with
    `@changesets/changelog-github` 1) and `openai` 7.
  - **Minors and patches.** React 19.3, radix-ui 1.8, lucide-react 1.61, zod 4.6,
    TanStack Query 5.104, the CodeMirror pins, pi-ai 1.4 and the rest.
  - **Call sites.** Sentry 11 dropped `sendDefaultPii`; its `dataCollection`
    defaults already attach user info, cookies and headers, so both entries just
    drop the option. SimpleWebAuthn 14 renamed `AuthenticatorTransportFuture` to
    `AuthenticatorTransport`.
  - **Changesets 3** skips private packages unless asked, so
    `.changeset/config.json` sets `privatePackages: { version: true, tag: false }`
    to keep versioning the private kit packages (tags still come from the
    release workflow).

## 1.0.0

### Major Changes

- [`f9e51f0`](https://github.com/AshikNesin/groot/commit/f9e51f0017b68fca20780de78d260125051b8c39) Thanks [@AshikNesin](https://github.com/AshikNesin)! - `@groot/ai` declares its public surface explicitly and sits under the kit guard.

  - **Breaking:** the `"./*"` wildcard export is replaced by explicit entrypoints: `@groot/ai` (the barrel: `AI`, `AIClient`, `definePrompt`, `getModelCapabilities`, `maxReasoningEffort`, `resolveModel`, `toPiContext`, `zodToTypeBox`, the types) plus `@groot/ai/{client,capabilities,messages,model,prompt,schema,types}`. Any other deep import path no longer resolves; import the same names from the barrel instead. `scripts/check-kit-exports.ts` now keeps the entrypoints, the source files and the consumer fixture in agreement for `@groot/ai` too.
  - Its SDKs (`@earendil-works/pi-ai`, `openai`) are no longer duplicated as root dependencies of the boilerplate; they live only in `packages/ai/package.json`.
  - Credentials: unchanged by design — pass `apiKey` (and `baseUrl`/`headers` for a gateway) in the config, or let the SDKs read their own variables from `process.env`. The Cloudflare gateway keys and `DEFAULT_MODEL` are validated in `@groot/core/env` for app code that wants to pass them explicitly; `docs/features/ai-inference.md` shows both.

### Patch Changes

- [`1f59d1b`](https://github.com/AshikNesin/groot/commit/1f59d1b2190274f9a9cc362049e3ea4b29f26977) Thanks [@AshikNesin](https://github.com/AshikNesin)! - - `zodToTypeBox` keeps `.describe()` on objects, arrays, enums, literals and optional/nullable/default wrappers; defaulted fields are optional in the generated schema (Zod applies the default); zod 3 arrays are no longer converted to `Any`.
  - Images passed as `data:` URLs without a `mimeType` use the URL's media type instead of `image/png`.
  - Capability detection: only Gemini (not every Vertex-hosted model) is document-capable; `gpt-oss` is text-only; `qwen*-vl` / `glm-*v` vision variants accept images.

## 0.3.0

### Minor Changes

- [`612b968`](https://github.com/AshikNesin/groot/commit/612b9688bee6548518c8df1b6c990bca87df45a0) Thanks [@AshikNesin](https://github.com/AshikNesin)! - Upgrade pi-ai with Cloudflare AI Gateway provider support.

## 0.2.0

### Minor Changes

- [`8621fea`](https://github.com/AshikNesin/groot/commit/8621feac29186b5c829320b51c35707d4004b5af) Thanks [@AshikNesin](https://github.com/AshikNesin)! - feat(ai): add maxReasoningEffort() — resolve a model's highest supported reasoning effort

  New export in `capabilities.ts` alongside `getModelCapabilities`. Maps a
  gateway model id to the highest `reasoning_effort` value it accepts (or
  `undefined` when the model has no effort control), sourced from ClinePass's
  model catalog (the `reasoningOptions` effort values embedded in the cline CLI):

  - kimi-k3 → `"max"` (catalog: low/high/max — most callers hardcode "high"
    and leave the top level unused)
  - glm-5.2 / deepseek-v4 / qwen3.8-max → `"xhigh"`
  - kimi-k2.6/k2.7-code, qwen3.7*, mimo*, minimax-m3 → `undefined` (param must
    be omitted — these models accept no effort control)
  - unknown models → `"high"` (safe default every OpenAI-compatible reasoning
    API accepts)

  Also exports the `ReasoningEffort` union (pi-ai's ThinkingLevel + `"max"`)
  for typing the parameter at call sites.
