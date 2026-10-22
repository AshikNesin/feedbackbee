# /api/feedback upload contract (v1)

Both the web widget and the Android SDK POST multipart/form-data to this one endpoint.
The endpoint is public, CORS `*`, rate-limited 20/hour/IP/project.

## Fields

| Part | Type | Required | Notes |
|---|---|---|---|
| `project` | text | yes | Project slug |
| `kind` | text | yes | `bug`, `idea`, or `feedback` |
| `text` | text | yes | 1..5000 chars |
| `email` | text | no | Reporter email, stored raw |
| `media` | file | no | Screenshot (png/jpeg/webp, max 10 MB) or recording (webm/mp4, max 200 MB) |
| `media_kind` | text | no | `screenshot` or `recording`. Required iff `media` present |
| `media_seconds` | number | no | Recording length in seconds, max 300 |
| `url` | text | no | Page URL (web) or deep link (app) |
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

Media lives at `GET /f/<key>` with long cache headers. Key shape `p/<project>/f/<feedback-id>/<filename>`.
