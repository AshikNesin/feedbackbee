# Upload contract (v1): `POST /api/v1/feedback`

The web widget and the Android SDK post `multipart/form-data` to this one endpoint.
It is public (no auth), answers CORS `*` without credentials, and is rate-limited
to 20 reports per hour per project and IP. Implemented in
`apps/web/src/server/api/feedback/` (`feedback.schema.ts` holds the field rules).

## Fields

| Part                   | Type   | Required     | Notes                                                                                                  |
| ---------------------- | ------ | ------------ | ------------------------------------------------------------------------------------------------------ |
| `project`              | text   | yes          | Project id (slug)                                                                                      |
| `kind`                 | text   | yes          | `issue`, `feature_request` or `other`                                                                  |
| `text`                 | text   | yes          | 1..5000 chars                                                                                          |
| `image`                | file   | no           | Repeatable, at most 5, in display order. PNG/JPEG/WebP, max 10 MB each, 50 MB combined                 |
| `media`                | file   | no           | One screen recording: webm/mp4 video, or a gzipped rrweb replay from the web widget. Max 200 MB        |
| `media_seconds`        | number | with `media` | Recording length, 0..300                                                                               |
| `audio`                | file   | no           | One voice note: webm/ogg/mp4/m4a/mp3, max 25 MB                                                        |
| `audio_seconds`        | number | with `audio` | Voice note length, 0..300                                                                              |
| `email`                | text   | no           | Reporter email (max 320)                                                                               |
| `reporter_name`        | text   | no           | Max 120                                                                                                |
| `reporter_id`          | text   | no           | Your user id, max 128                                                                                  |
| `metadata`             | text   | no           | JSON object, max 4 KB, 20 keys (`[A-Za-z0-9_.-]{1,40}`), values string (≤500 chars), number or boolean |
| `url`                  | text   | no           | Page URL (web) or deep link (app), max 2048                                                            |
| `app_version`          | text   | no           | Max 64                                                                                                 |
| `os_name`              | text   | no           | `web`, `android`                                                                                       |
| `os_version`           | text   | no           | Max 64                                                                                                 |
| `device_model`         | text   | no           | Max 128                                                                                                |
| `screen_w`, `screen_h` | number | no           | Web sends the viewport size                                                                            |

An optional text field over its cap is dropped, never rejected, so a long name
can't lose a report. The user agent is read from the request header. File types
are decided by their bytes, not by the part's declared type or file name.

## Response

Every response is groot's JSON envelope.

- `201 {"success":true,"data":{"id":"<uuid>","state":"created","issueUrl":"https://github.com/..."}}`:
  stored, issue filed.
- `202 {"success":true,"data":{"id":"<uuid>","state":"issue_error","error":"GitHub 404: ..."}}`:
  stored, but GitHub refused the issue (the reason is kept on the report).
- Errors: `{"success":false,"error":{"code":"...","message":"..."}}`. The `message`
  is written to be shown to the reporter as-is (`"text is required"`).
  - `400` invalid input (`VALIDATION_ERROR`)
  - `404` unknown project
  - `413` a file over its cap
  - `415` a file whose bytes are not an accepted type for its part
  - `429` rate limited, with `Retry-After` in seconds

## Media serving

Attachments are served at `GET /f/<key>` with `cache-control: immutable`; keys
are `p/<project-id>/f/<uuid>.<ext>`. Web recordings are rrweb DOM replays,
gzipped JSON `{"v":1,"url","viewport":{"w","h"},"events":[...]}` stored as
`*.rrweb.gz`, watched at `GET /replay/<key>` (which is what the GitHub issue
links to). Images, a recording and a voice note are independent: a report can
carry any combination.

## Privacy

GitHub issues are a public surface, so reporter-identifying data stays in D1
and the authenticated dashboard. Exactly what reaches GitHub for every issue:

- `text` (the report body)
- `kind` (as a label and the title prefix)
- attachments (`image`, `media`, `audio`), embedded or linked
- `os_name` / `os_version`, `device_model`, `app_version`, `screen_w` / `screen_h`
- the user agent

`email`, `reporter_name`, `reporter_id`, `metadata` and `url` are stored and
shown in the dashboard only. The issue ends with a link to the report in
FeedbackBee instead (`/app/projects/<slug>?feedback=<id>`).
