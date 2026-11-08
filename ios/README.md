# FeedbackBee for iOS

Shake the phone, say what's wrong, optionally record a voice note or circle it on a screenshot. The SDK sends it to your
FeedbackBee Worker, which turns it into a GitHub issue. It is the iOS twin of the [Android SDK](../android/README.md):
same sheet, same upload contract, same privacy rules.

## 1. Add it

The package is not published yet, so add it from a checkout. In Xcode: **File → Add Package Dependencies… → Add
Local…**, pick `feedbackbee/ios`, and add the `FeedbackBee` library to your app target. In a `Package.swift`:

```swift
.package(path: "../feedbackbee/ios")
```

Requires iOS 15. No third-party dependencies.

## 2. Configure it

Once, at launch: in `application(_:didFinishLaunchingWithOptions:)`, or in your SwiftUI `App.init`:

```swift
import FeedbackBee

try FeedbackBee.configure(projectId: "myapp", endpoint: "https://bee.example.dev")
```

That is the whole setup. Shake is on and the sheet opens over whatever is on screen: it lives in its own window, so
there is no view controller to present and it works the same over UIKit, SwiftUI and React Native screens.

To offer voice notes, add `NSMicrophoneUsageDescription` to your Info.plist (for example, "Record a voice note for
your feedback."). Without it the microphone button is hidden; iOS would terminate an app that asked without it.

### The whole API

```swift
try FeedbackBee.configure(projectId: "myapp", endpoint: "https://bee.example.dev")               // shake on
try FeedbackBee.configure(projectId: "myapp", endpoint: "https://bee.example.dev", shake: false)
FeedbackBee.open()                                                // the picker, like a shake
FeedbackBee.open(OpenOptions(kind: .issue, lockKind: true))       // a "Report a problem" button
FeedbackBee.identify(email: "jane@acme.com", name: "Jane", id: "u_123")  // reporter context, dashboard-only
FeedbackBee.setContext(["plan": "pro", "build": 4211, "beta": true])    // metadata, dashboard-only
FeedbackBee.reset()                                               // on logout
```

| Parameter   | Default  | Notes                                                                                                       |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `projectId` | required | From your dashboard. A blank id throws `FeedbackBeeConfigurationError`.                                     |
| `endpoint`  | required | Your FeedbackBee website or Worker base URL, including `https://`. No default server. Trailing `/` trimmed. |
| `shake`     | `true`   | `false` ignores shakes; open the sheet with `open()`.                                                       |

Endpoint rules match Android: blank or malformed URLs, credentials, query parameters and fragments are rejected. Use
the base URL, not `/api/v1/feedback`. `configure` can be called again (say, after the user switches workspace) and
replaces the previous setup. Every call is safe from any thread. `open()` does nothing while a sheet is already open.
`setContext` merges; a `nil` value removes a key. Keys and values outside the contract's limits are dropped with a
log rather than failing the report.

## What the user sees

The same three screens as Android and the web widget, in a bottom panel (480pt wide at most) with light and dark mode:

1. **Share feedback.** Report an issue, Share an idea, Something else.
2. **The form.** Note, optional email (locked to the `identify` email when there is one), a camera button and a
   microphone button, and **Send feedback**, disabled until the note has text.
   - The camera renders the app's window (never the sheet, which is in a separate window) and opens a full-screen
     annotator: pen, box, arrow, undo, cancel, save.
   - The microphone asks for permission when first tapped, records AAC in an `.m4a` file for at most five minutes, and
     lets the user stop, re-record or remove the note.
3. **Feedback sent.** A checkmark, with "View on GitHub ↗" when the Worker returns an issue URL.

Errors (rate limit, bad input, no network) show above the Send button and keep the draft. The sheet supports
VoiceOver, Dynamic Type, Reduce Motion and the keyboard (the panel rides above it).

## Shake

The SDK listens for the system shake gesture: UIKit already detects it and routes `motionEnded` to the window, so there
is no accelerometer polling and no battery cost. Shakes are ignored while a sheet is open. A view controller that
overrides `motionEnded` without calling `super` swallows the gesture; use `open()` there.

## Performance

- Nothing runs until a shake or `open()`. `configure` stores the config and installs the shake hook once.
- Screenshots are taken only when the camera is tapped, PNG-encoded with ImageIO off the main thread, and shown from a
  downsampled thumbnail. Annotation strokes are individual `CAShapeLayer`s, so drawing redraws only the stroke under the
  finger.
- The upload body is written to a temporary file and streamed by `URLSession` from disk, so attachments are never
  duplicated in memory. Redirects are refused (they would drop the POST body), as on Android.

## Upload

Send posts multipart to `{endpoint}/api/v1/feedback` exactly as in [docs/CONTRACT.md](../docs/CONTRACT.md): `project`,
`kind`, `text`, optional `email`, `app_version` (`CFBundleShortVersionString`), `os_name=ios`, `os_version`,
`device_model` (the hardware identifier, like `iPhone16,1`), `screen_w` / `screen_h` (native pixels), plus
`reporter_name`, `reporter_id` and `metadata` when set, a screenshot as `image`, and a voice note as `audio` +
`audio_seconds`.

## Privacy

The SDK reads only its host app's own window, and only after the user taps the camera button. Audio is recorded only
after the user taps the microphone. Nothing leaves the device until the user presses **Send**. The host's audio session
category is restored after a recording.

## Build and test

```bash
cd ios
swift test                                           # contract, state machine, geometry (macOS or Linux)
xcodebuild build -scheme FeedbackBee -destination 'generic/platform=iOS Simulator'   # the UIKit layer
```

UIKit files are wrapped in `#if canImport(UIKit)`, so `swift test` runs the platform-independent core anywhere.

## Layout

```
Sources/FeedbackBee/
  FeedbackBee.swift        public API and the installation (config + open sheet)
  FeedbackKind.swift       kinds, limits, OpenOptions
  FeedbackConfig.swift     validated projectId + endpoint
  FeedbackState.swift      submission state machine and FeedbackController
  Reporter.swift           identify / setContext store, ContextValue
  ShakeDetector.swift      system shake gesture hook
  Upload/                  multipart body, request builder, response parsing, URLSession uploader
  Capture/                 window capture, PNG encoder, device info
  Annotate/                Shape model and the annotator
  Record/                  VoiceRecorder (AVAudioRecorder)
  Sheet/                   SheetPresenter (overlay window), FeedbackSheetViewController, theme
Tests/FeedbackBeeTests/    XCTest suites for the core
```
