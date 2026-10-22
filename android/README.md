# FeedbackBarn for Android

Shake the phone, circle the problem, tap Send. The SDK uploads a screenshot and the user's note to your
FeedbackBarn Worker, which turns it into a GitHub issue.

- `sdk/` is the library (`io.nesin.feedbackbarn`). No OkHttp, no Coil, no annotation library: just
  `HttpURLConnection`, a hand-rolled multipart body and raw `Canvas`. Its one non-AndroidX dependency is
  `kotlinx-coroutines-android`.
- `app/` is a demo app (`io.nesin.feedbackbarn.demo`) with a settings card for the project slug and endpoint.

Requires minSdk 26. Built with AGP 8.7, Kotlin 2.0, compileSdk and targetSdk 35.

## Install

The SDK is not published yet. Include it from a checkout.

`settings.gradle.kts` of your app:

```kotlin
include(":feedbackbarn-sdk")
project(":feedbackbarn-sdk").projectDir = file("../feedbackbarn/android/sdk")
```

`app/build.gradle.kts`:

```kotlin
dependencies {
    implementation(project(":feedbackbarn-sdk"))
}
```

Once the AAR is on a Maven repository this becomes `implementation("io.nesin:feedbackbarn:<version>")`.

## Set up

Initialize once, then register each activity that should react to shakes.

```kotlin
class MyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        FeedbackBarn.init(this, projectSlug = "myapp", endpoint = "https://your-barn.workers.dev")
    }
}

class MainActivity : AppCompatActivity() {   // any FragmentActivity
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        FeedbackBarn.register(this)
    }
}
```

| Call | Does |
|---|---|
| `FeedbackBarn.init(app, projectSlug, endpoint)` | Stores the config. Throws `IllegalArgumentException` for a blank slug or an endpoint that is not `http(s)://`. A trailing `/` is trimmed. |
| `FeedbackBarn.register(activity)` | Listens for shakes while the activity is resumed and remembers it for capture. Unregisters itself when the activity is destroyed. |
| `FeedbackBarn.unregister()` | Stops shake detection now. |
| `FeedbackBarn.showFeedbackSheet(activity)` | Opens the sheet from your own button. No-op if a sheet is already open. |

Call everything on the main thread. `register` and `showFeedbackSheet` need a `FragmentActivity`
(`AppCompatActivity` is one; for Compose, extend `FragmentActivity` instead of `ComponentActivity`). A plain
`ComponentActivity` logs a warning and does nothing, because the sheet is a `DialogFragment`.

## Shake behavior

- Reads the accelerometer at `SENSOR_DELAY_GAME` (about 50 Hz) only while a registered activity is resumed.
- Three peaks above 15 m/s² (gravity included, so a firm jolt) inside 1.5 s open the sheet. One long
  push counts as one peak; peaks closer than 120 ms count once.
- The sheet cannot stack: shakes are ignored while a sheet exists, and the peak counter resets after each trigger.
- The detection logic is plain Kotlin (`ShakeAnalyzer`) with JUnit tests for a shake and several non-shakes.

## What the user sees

1. Bottom sheet: Feedback / Bug / Idea, a note (1 to 5000 characters), optional email, **Attach screenshot**, **Record screen**, **Send**.
2. **Attach screenshot** copies the host activity's window with `PixelCopy` and opens a full-screen
   annotator: pen, box, arrow, undo, cancel, save. Saving exports an annotated PNG (10 MB cap; larger captures are
   shrunk until they fit).
3. **Send** posts multipart to `{endpoint}/api/feedback` exactly as described in
   [docs/CONTRACT.md](../docs/CONTRACT.md): `project`, `kind`, `text`, optional `email`, `app_version`,
   `os_name=android`, `os_version` (API level), `device_model`, `screen_w`, `screen_h`, and the PNG as `media` with `media_kind=screenshot`.
4. A `201` shows "Thank you! Tracked on GitHub" with the issue link. A `202` shows a plain thank-you.
   `429`, `400`, network and capture errors appear inside the sheet with a **Try again** button; the draft is kept.

The sheet is driven by one sealed state: `Draft → Annotating → WithScreenshot → Uploading → Sent | Failed`.
It lives in an activity-scoped `ViewModel`, so rotation and fold/unfold keep the draft, the screenshot and an in-flight upload.

## Permissions for the host app's manifest

The SDK's manifest already merges this into your app:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

Nothing else. No storage, camera, microphone or notification permission is needed. The accelerometer needs none.

If your endpoint is plain `http://` (local development only), your app must also allow cleartext traffic,
either `android:usesCleartextTraffic="true"` or a network security config. The demo app does the first.

## Privacy

The SDK never reads notifications, SMS or system logs. The only pixels it can read are those of the host app's own window,
and only after the user taps **Attach screenshot**. Nothing leaves the device until the user presses **Send**,
and what leaves is the text, the email they typed, the annotated screenshot and the device context fields above.

## Screen recording: stubbed in v0.1

Recording (MediaProjection, `MediaRecorder`, a foreground-service notification with
`FOREGROUND_SERVICE_MEDIA_PROJECTION`, 5 minute hard cap) is not implemented. The MediaProjection consent and
foreground-service ordering rules are easy to get subtly wrong and could not be verified on a device here, so
the SDK ships the seam instead of half-working permission code:

- `record/ScreenRecorder.kt` defines the interface and `UnavailableScreenRecorder`.
- The sheet shows **Record screen (soon)** disabled, because `isAvailable` is false.
- The upload path already accepts a `recording` media kind with the 200 MB cap and `media_seconds`, with tests.
- No `FOREGROUND_SERVICE*` permissions are declared. They arrive with the implementation.

## Try the demo app against a local Worker

1. Start the Worker from the repo root: `npm run dev` (listens on `http://localhost:8787`).
2. In the dashboard create a project and note its slug (the demo defaults to `demo`).
3. Build and install: `./gradlew :app:installDebug` with an emulator running.
4. In the app's **Settings** card set the endpoint to `http://10.0.2.2:8787` (the emulator's alias for your computer's
   `localhost`; the **Emulator URL** button fills it in) and the slug, then **Save**.
5. Shake. In the emulator open **⋮ → Virtual sensors → Move** and drag, or tap **Open the feedback sheet**.

On a physical device use your computer's LAN address (for example `http://192.168.1.20:8787`) and start the Worker with
`npx wrangler dev --ip 0.0.0.0`.

## Build and test

```bash
cd android
./gradlew :sdk:assembleRelease :app:assembleDebug :sdk:testDebugUnitTest
```

`local.properties` (git-ignored) should contain `sdk.dir=/path/to/android-sdk`; Gradle also reads `ANDROID_HOME`.

## Module layout

```
sdk/src/main/kotlin/io/nesin/feedbackbarn/
  FeedbackBarn.kt            public API
  FeedbackState.kt           sealed submission state machine
  FeedbackViewModel.kt       transitions + upload orchestration
  shake/                     ShakeAnalyzer (pure) and ShakeDetector (SensorManager)
  capture/                   PixelCopy screenshot, PNG encoder with size cap
  annotate/                  Shape model, ShapeRenderer, AnnotationView, AnnotationDialogFragment
  sheet/                     FeedbackSheetFragment and FeedbackSheetView
  upload/                    MultipartBody, FeedbackUploader, response parsing, device info
  record/                    ScreenRecorder seam (unavailable in v0.1)
```
