# FeedbackBee for Android

Shake the phone, say what's wrong, optionally record a voice note or circle it on a screenshot. The SDK sends it to your
FeedbackBee Worker, which turns it into a GitHub issue.

## 1. Add it

The SDK is not published yet, so include it from a checkout. In your app's `settings.gradle.kts`:

```kotlin
include(":feedbackbee-sdk")
project(":feedbackbee-sdk").projectDir = file("../feedbackbee/android/sdk")
```

In `app/build.gradle.kts`:

```kotlin
dependencies {
    implementation(project(":feedbackbee-sdk"))
}
```

Requires minSdk 26. Once the AAR is on Maven this becomes `implementation("io.nesin:feedbackbee:<version>")`.

## 2. Init it

In your `Application` class:

```kotlin
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FeedbackBee.init(this, projectId = "myapp", endpoint = "https://bee.example.dev")
    }
}
```

That is the whole setup. Shake is on, the sheet opens over whatever activity is in front, and there is no
per-activity code. Put `android:name=".MyApp"` on `<application>` if you haven't already.

The one requirement: the foreground activity must be a `FragmentActivity` (`AppCompatActivity` is one; with
Compose, extend `FragmentActivity` instead of `ComponentActivity`). The sheet is a `DialogFragment`. If it isn't,
`show()` and shakes log one warning under the `FeedbackBee` tag and do nothing.

### The whole API

```kotlin
FeedbackBee.init(application, projectId = "myapp", endpoint = "https://bee.example.dev") // shake on
FeedbackBee.init(application, projectId = "myapp", endpoint = "https://bee.example.dev", shake = false)
FeedbackBee.show() // open the sheet yourself
```

| Parameter | Default | Notes |
|---|---|---|
| `projectId` | required | From your dashboard. A blank id throws `IllegalArgumentException`. |
| `endpoint` | required | Your FeedbackBee website or Worker base URL, including `https://`. No default server. A trailing `/` is trimmed. |
| `shake` | `true` | `false` removes the accelerometer listener entirely. |

**Upgrading:** add `endpoint` to existing `init` calls. The argument order is application, project id, endpoint,
then optional `shake`. `DEFAULT_ENDPOINT` has been removed. Blank or malformed URLs are rejected immediately,
including hosts with embedded credentials, query parameters, or fragments. Use the base URL, not `/api/feedback`.

`init` is idempotent: call it again (say, after the user switches workspace) and the new config replaces the old one;
the old lifecycle callbacks are unregistered first. `show()` can be called from any thread and does nothing
while a sheet is already open.

## Shake

| | |
|---|---|
| Triggers | Three firm jolts (above 15 m/s², gravity included) within 1.5 seconds. A long push counts once; peaks under 120 ms apart count once. |
| Runs | Only while an activity is resumed, at `SENSOR_DELAY_GAME` (about 50 Hz). Nothing runs in the background. |
| Can't stack | Shakes are ignored while a sheet is open, and the counter resets after each trigger. |
| Turn it off | `FeedbackBee.init(this, projectId = "myapp", endpoint = "https://bee.example.dev", shake = false)` |
| Open manually | `FeedbackBee.show()`, for example from a "Send feedback" menu item. |
| No accelerometer | Logged once at init. Use `show()`. |

The detection logic is plain Kotlin (`ShakeAnalyzer`) with JUnit tests for a shake and several non-shakes.

## What the user sees

The sheet mirrors the web widget: a white panel, 360dp wide at most, rounded top corners.

1. **Share feedback.** Three simple rows: Report an issue, Share an idea, Something else. A close button top-right.
2. **Report an issue / Share an idea / Tell us more.** A back arrow, labeled feedback and optional email fields,
   a separate screenshot and microphone toolbar, and a full-width **Send feedback** button, which stays disabled until the note has text.
   The microphone asks for `RECORD_AUDIO` only when tapped, records AAC in an `.m4a` container for at most five minutes,
   and lets the user stop, re-record, or delete the note before sending.
   The camera button copies the host activity's window with `PixelCopy` and opens a full-screen annotator
   (pen, box, arrow, undo, cancel, save). The annotated PNG appears as a thumbnail with a small x to remove it.
3. **Feedback sent.** A checkmark with "View on GitHub ↗" when the Worker returns an issue URL, otherwise a short thank-you.

The web widget and SDK share a neutral palette, subtle borders, and clear focus states. Android sheet controls have
48dp touch targets, the form scrolls above the keyboard, and the sheet respects disabled system animations.

Errors (rate limit, bad input, no network, a capture that failed) show inside the sheet above the Send button and the
draft is kept. Back keeps the note too.

Send posts multipart to `{endpoint}/api/feedback` exactly as in [docs/CONTRACT.md](../docs/CONTRACT.md):
`project`, `kind` (`bug`, `idea` or `feedback` for Issue, Idea, Other), `text`, optional `email`, `app_version`,
`os_name=android`, `os_version` (API level), `device_model`, `screen_w`, `screen_h`, and optional independent
`media`/`media_kind`/`media_seconds` plus `audio`/`audio_seconds`. Screenshots have a 10 MB cap; voice notes use
an `.m4a` file with a 25 MB and 300-second cap.

The sheet renders from one sealed state, not scattered flags:
`Choosing → Draft → Annotating | RecordingAudio → WithScreenshot → Uploading → Sent | Failed`. It lives in an
activity-scoped `ViewModel`, so rotation and fold/unfold keep the draft, attachments and an in-flight upload.

## Manifest permissions for the host app

The SDK's manifest already merges these into your app:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

The microphone permission is requested only after the user taps the microphone button. If it is denied, the button is
disabled with a hint and the host app continues normally. No storage, camera or notification permission is needed.

A plain `http://` endpoint (local development only) also needs cleartext traffic allowed in your app:
`android:usesCleartextTraffic="true"` or a network security config. Use HTTPS for production.

## Privacy

The SDK never reads notifications, SMS or system logs. The only pixels it can read are those of the host app's own
window, and only after the user taps the camera button. Audio is recorded only after the user taps the microphone
button. Nothing leaves the device until the user presses **Send**, and what leaves is the note, the email they typed,
any attached screenshot or voice note, and the device context fields above.

## Screen recording: not in this version

Recording (MediaProjection, `MediaRecorder`, a foreground-service notification with
`FOREGROUND_SERVICE_MEDIA_PROJECTION`, 5 minute hard cap) is stubbed. The MediaProjection consent and
foreground-service rules are easy to get subtly wrong, so the SDK ships the seam instead of half-working permission code:

- `record/ScreenRecorder.kt` defines the interface and `UnavailableScreenRecorder`. Nothing in the sheet calls it yet,
  so the sheet has no record button.
- The upload path already accepts a `recording` media kind with the 200 MB cap and `media_seconds`, with tests.
- No `FOREGROUND_SERVICE*` permissions are declared. They arrive with the implementation.

## Run the demo app against a local Worker

The demo (`app/`, `io.nesin.feedbackbee.demo`) has required **Project id** and **Website host** fields.
Tap **Save configuration** to validate and save both on the device. Feedback stays disabled until setup is saved.
The app restores this configuration on relaunch. Unsaved edits do not change the SDK's saved destination.

1. Start the Worker from the repo root: `npm run dev` (listens on `http://localhost:8787`).
2. Create a project in the dashboard.
3. `cd android && ./gradlew :app:installDebug` with an emulator running.
4. Enter the project id and set **Website host** to `http://10.0.2.2:8787` (the emulator's alias for your computer's
   `localhost`), then tap **Save configuration**.
5. Shake: in the emulator open **⋮ → Virtual sensors → Move** and drag, or tap **Open feedback sheet**.

Neither build has a default website host. You can optionally prefill the field for either build using the
`feedbackbee.endpoint` Gradle property; a saved in-app host takes precedence. For a real device, use a reachable
LAN address (start the Worker with `npx wrangler dev --ip 0.0.0.0`):

```bash
./gradlew :app:installDebug -Pfeedbackbee.endpoint=http://192.168.1.20:8787
```

## Build and test

```bash
cd android
./gradlew :sdk:assembleRelease :sdk:testReleaseUnitTest :app:assembleDebug
```

`local.properties` (git-ignored) should contain `sdk.dir=/path/to/android-sdk`; Gradle also reads `ANDROID_HOME`.

## Module layout

```
sdk/src/main/kotlin/io/nesin/feedbackbee/
  FeedbackBee.kt            public API: init (required endpoint), show
  Installation.kt           one init(): foreground-activity tracking + shake lifecycle
  FeedbackConfig.kt         validated projectId + endpoint
  FeedbackState.kt          sealed submission state machine
  FeedbackViewModel.kt      transitions + upload orchestration
  shake/                    ShakeAnalyzer (pure) and ShakeDetector (SensorManager)
  capture/                  PixelCopy screenshot, PNG encoder with size cap
  annotate/                 Shape model, ShapeRenderer, AnnotationView, AnnotationDialogFragment
  sheet/                    FeedbackSheetFragment and FeedbackSheetView
  upload/                   MultipartBody, FeedbackUploader, response parsing, device info
  record/                   VoiceRecorder plus ScreenRecorder seam (unavailable)
  ui/                       Theme tokens shared with the web widget
sdk/src/main/res/drawable/  fbb_ic_*.xml vector icons (resourcePrefix = "fbb_")
app/                        demo app
```
