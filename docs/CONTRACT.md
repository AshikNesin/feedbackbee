# /api/feedback upload contract (v1)

Both the web widget and the Android SDK POST multipart/form-data to this one endpoint.
The endpoint is public, CORS `*`, rate-limited 20/hour/IP/project.

## Fields

| Part | Type | Required | Notes |
|---|---|---|---|
| `project` | text | yes | Project slug |
| `kind` | text | yes | `bug`, `idea`, or `feedback` |
| `text` | text | yes | 1..5000 chars |
| `email` | text | no | Reporter email, stored and shown in the dashboard only; never sent to GitHub |
| `media` | file | no | Screenshot (png/jpeg/webp, max 10 MB) or recording (webm/mp4 video, or a gzipped rrweb replay from the web widget; max 200 MB) |
| `media_kind` | text | no | `screenshot` or `recording`. Required iff `media` present |
| `media_seconds` | number | no | Recording length in seconds, max 300 |
| `audio` | file | no | Voice note (webm/ogg/mp4/m4a, max 25 MB) |
| `audio_seconds` | number | no | Voice note length in seconds, max 300. Required iff `audio` present |
| `url` | text | no | Page URL (web) or deep link (app), stored and shown in the dashboard only; never sent to GitHub |
| `app_version` | text | no | |
| `os_name` | text | no | `web`, `android` |
| `os_version` | text | no | Browser UA or Android API level |
| `device_model` | text | no | |
| `screen_w` | number | no | |
| `screen_h` | number | no | |

Web adds `viewport_w`/`viewport_h` in `screen_w`/`screen_h` plus a `user_agent` field; Android sends `device_model`.

## Response

`201 {"id":"<uuid>","state":"created","issueUrl":"https://github.com/..."}` on success.
`202 {"id":"<uuid>","state":"pending"}` when the issue could not be created yet (retry or error recorded).
`429` on rate limit. `400` with `{"error":"message"}` on bad input.

## Media serving

Media lives at `GET /f/<key>` with long cache headers. Web recordings are rrweb DOM replays, gzipped JSON `{"v":1,"url","viewport":{"w","h"},"events":[...]}` sniffed by the gzip magic bytes and stored as `*.rrweb.gz`; they are watched at `GET /replay/<key>`, which is what the GitHub issue links to. Key shape `p/<project>/f/<feedback-id>/<filename>`.
Visual media and voice notes are independent: a report can carry `media`, `audio`, both, or neither.

## Privacy

GitHub issues are a public surface, so reporter-identifying data stays in D1 and the authenticated dashboard. Exactly what reaches GitHub for every created issue:

- `text` (the report body)
- `kind` (as a label and the title prefix)
- media/attachment files (`media`, `audio`), embedded or linked
- `os_name` / `os_version`
- `device_model`
- `app_version`
- `screen_w` / `screen_h`
- user agent

Everything else — the reporter `email`, `url`, and (once added) reporter name, user id and metadata — is stored and shown in the dashboard only and never sent to GitHub. The issue ends with a link to the report in FeedbackBee instead.
