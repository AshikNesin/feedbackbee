# No release: FeedbackBee Apple (iOS + macOS) SDK and React Native module

Add the app-owned Apple SDK for iOS and macOS (`apple/`), the React Native module (`react-native/`), an
optional `currentActivity` argument on the Android SDK's `init`, and a
`mobile-sdks.yml` workflow listed in `.groot/boilerplate-sync.json`
`additional_exclusions`. groot's published packages are unchanged; the upload
contract only gains `ios` and `macos` as documented `os_name` values. The web
widget gains an opt-in `data-theme` (default `light`, unchanged), documented in
the new app-owned `docs/WIDGET.md` (also excluded from groot sync).

The Android SDK's `open()` without a kind now shows the kind picker (it skipped
straight to the form). The README, SDK READMEs, `docs/WIDGET.md` and the website
show light | dark renders of each client from `docs/screenshots/clients/`
(app-owned, under the excluded `docs/screenshots/**`).

The CI workflows (`test.yml`, `worker-tests.yml`, `react-doctor.yml`,
`groot-sync.yml`, `cleanup-merged-branches.yml`) run on GitHub-hosted
`ubuntu-latest` instead of a self-hosted runner; the groot-synced ones are added
to `additional_exclusions` so a sync does not revert them.
