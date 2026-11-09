# No release: FeedbackBee mobile apps (iOS + Android)

Add the owner's native apps in the app-owned `mobile/` folder (`mobile/ios`,
SwiftUI; `mobile/android`, Kotlin + Compose) and a `mobile-apps.yml` workflow
listed in `.groot/boilerplate-sync.json` `additional_exclusions`.

The dashboard API gains `GET` and `DELETE /api/v1/projects/:id/feedback/:fid`,
and its `PATCH` accepts `kind` and `text` besides `status` (a filed report's
GitHub issue title, body and kind label follow) and returns the whole report.
The submit endpoint skips its per-IP rate limit for a valid owner session sent
as `Authorization: Bearer`; its fields and responses are unchanged. App-owned
code, Worker tests and product docs only; groot's published packages are
unchanged.
