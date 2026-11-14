# No release: FeedbackBee Pushover notifications

Send Pushover push notifications for new feedback, failed GitHub issues and
GitHub status changes, configured in Settings → Push notifications; the keys
are groot's existing `PUSHOVER_USER_KEY` / `PUSHOVER_API_TOKEN` env vars.
App-owned code, Worker tests and docs only; groot's published packages and the
widget/SDK upload contract are unchanged.

Also fixes `/app/settings`: since the groot v3.2.1 sync it redirected to
`/settings/account`, which the app's route did not match, so Settings bounced
to Projects. Settings is now a splat route with GitHub and Push notifications
as sections; GitHub App callbacks land on `/app/settings/github`.
