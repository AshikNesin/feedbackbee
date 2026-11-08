# FeedbackBee for iOS and macOS

One Swift package for both platforms. A user describes what's wrong, optionally circles it on a screenshot or records a
voice note, and the SDK sends it to your FeedbackBee Worker, which turns it into a GitHub issue. It follows the
[Android SDK](../android/README.md): same screens, same upload contract, same privacy rules.

The upload contract, state machine, metadata rules, screenshot encoding and annotation geometry are shared code. Only
the UI is per platform: UIKit on iOS (`UIKit/`), AppKit on macOS (`macOS/`).

## 1. Add it

The package is not published yet, so add it from a checkout. In Xcode: **File → Add Package Dependencies… → Add
Local…**, pick `feedbackbee/apple`, and add the `FeedbackBee` library to your app target. In a `Package.swift`:

```swift
.package(path: "../feedbackbee/apple")
```

Requires iOS 15 or macOS 12. No third-party dependencies.

## 2. Configure it

Once, at launch: in `application(_:didFinishLaunchingWithOptions:)` / `applicationDidFinishLaunching(_:)`, or in your
SwiftUI `App.init`:

```swift
import FeedbackBee

try FeedbackBee.configure(projectId: "myapp", endpoint: "https://bee.example.dev")
```

### iOS

That is the whole setup. Shake is on, and the sheet opens over whatever is on screen. It lives in its own window, so
there is no view controller to present, and it works the same over UIKit, SwiftUI and React Native screens.

### macOS

Macs don't shake, so give the user a way in. The convention is **Help → Send Feedback…**:

```swift
// AppKit, after the main menu is set up:
NSApp.helpMenu?.addItem(FeedbackBee.menuItem())
```

```swift
// SwiftUI:
WindowGroup { ContentView() }
    .commands {
        CommandGroup(after: .help) {
            Button("Send Feedback…") { FeedbackBee.open() }
        }
    }
```

The feedback form opens in its own small window, centered over the window the user was looking at, so it also works
for menu-bar apps without a main window. A **sandboxed** app needs the **Outgoing Connections (Client)** entitlement
(`com.apple.security.network.client`) to send reports; without it, `configure` logs a warning.

### Voice notes (both platforms)

Add `NSMicrophoneUsageDescription` to your Info.plist (for example, "Record a voice note for your feedback."). On macOS,
a sandboxed app also needs **Audio Input** (`com.apple.security.device.audio-input`), and with the Hardened Runtime the
**Audio Input** resource access. If they are missing, the microphone button is hidden, because the OS would terminate
an app that asked without them.

### The whole API

```swift
try FeedbackBee.configure(projectId: "myapp", endpoint: "https://bee.example.dev")
try FeedbackBee.configure(projectId: "myapp", endpoint: "https://bee.example.dev", shake: false)  // iOS only
FeedbackBee.open()                                                // the picker
FeedbackBee.open(OpenOptions(kind: .issue, lockKind: true))       // a "Report a problem" button
FeedbackBee.menuItem()                                            // macOS: a "Send Feedback…" NSMenuItem
FeedbackBee.identify(email: "jane@acme.com", name: "Jane", id: "u_123")  // reporter context, dashboard-only
FeedbackBee.setContext(["plan": "pro", "build": 4211, "beta": true])    // metadata, dashboard-only
FeedbackBee.reset()                                               // on logout
```

| Parameter   | Default  | Notes                                                                                                       |
| ----------- | -------- | ----------------------------------------------------------------------------------------------------------- |
| `projectId` | required | From your dashboard. A blank id throws `FeedbackBeeConfigurationError`.                                     |
| `endpoint`  | required | Your FeedbackBee website or Worker base URL, including `https://`. No default server. Trailing `/` trimmed. |
| `shake`     | `true`   | iOS only. `false` ignores shakes; open the sheet with `open()`.                                             |

Endpoint rules match Android: blank or malformed URLs, credentials, query parameters and fragments are rejected. Use
the base URL, not `/api/v1/feedback`. `configure` can be called again (say, after the user switches workspace) and
replaces the previous setup. Every call is safe from any thread. On iOS, `open()` does nothing while a sheet is
already open; on macOS it brings the open window forward. `setContext` merges; a `nil` value removes a key. Keys and
values outside the contract's limits are dropped with a log rather than failing the report.

## What the user sees

The same three screens as Android and the web widget, in light and dark mode (see [Light and dark mode](#light-and-dark-mode)):

1. **Share feedback.** Report an issue, Share an idea, Something else.
2. **The form.** Note, optional email (locked to the `identify` email when there is one), a camera button, a microphone
   button and **Send feedback**, which stays disabled until the note has text.
   - The camera captures the app's own window (never the feedback UI, which is a separate window) and opens an
     annotator: pen, box, arrow, undo, cancel, save.
   - The microphone asks for permission the first time, records AAC in an `.m4a` file for at most five minutes, and
     lets the user stop, re-record or remove the note.
3. **Feedback sent.** A checkmark, with "View on GitHub ↗" when the Worker returns an issue URL.

Errors (rate limit, bad input, no network) show above the Send button and keep the draft.

- **iOS:** a bottom sheet (480pt wide at most) that stays above the keyboard. Supports VoiceOver, Dynamic Type and
  Reduce Motion.
- **macOS:** a 400pt window built from native controls and system colors, so it follows the user's appearance and
  accent color. It is keyboard-driven: Tab moves between fields, Return sends from the email field, and Escape closes.
  The annotator is a resizable window where Return saves, Escape cancels and ⌘Z undoes. VoiceOver announces errors and
  the sent state.

## Light and dark mode

Both platforms follow the host app's appearance, including while the feedback UI is open.

**iOS.** The sheet uses dynamic colors from the palette it shares with Android and the web widget, and follows:

- the system setting,
- `UIUserInterfaceStyle` in your Info.plist, which forces one style app-wide,
- a style your app forces on its window with `window.overrideUserInterfaceStyle`. The sheet lives in its own window and
  copies it, so React Native's `Appearance.setColorScheme` works too.

Switching while the sheet is open recolors it in place. The screenshot annotator is always dark, as on Android, so the
red markup reads on any screenshot.

| Token      | Light     | Dark      | Used for                                 |
| ---------- | --------- | --------- | ---------------------------------------- |
| Panel      | `#FFFFFF` | `#18181B` | Sheet background, fields                 |
| Ink        | `#18181B` | `#F4F4F5` | Titles, text, primary button fill        |
| Muted      | `#71717A` | `#A1A1AA` | Subtitles, placeholders, icon buttons    |
| Tile       | `#F4F4F5` | `#27272A` | Icon tiles, attachment rows, pressed row |
| Border     | `#E4E4E7` | `#3F3F46` | Field and tile borders                   |
| Focus      | `#2563EB` | `#60A5FA` | Focused field border                     |
| Error      | `#DC2626` | `#F87171` | Error line, Stop button                  |
| Annotation | `#FF3B30` | `#FF3B30` | Pen, box and arrow strokes               |

**macOS.** The window uses system colors (`windowBackgroundColor`, `labelColor`, `separatorColor`,
`textBackgroundColor`, the keyboard focus color), so it matches standard Mac apps and the user's accent color. It
follows:

- the system setting,
- `NSApp.appearance`,
- an appearance forced on the window the user was looking at (the feedback and annotation windows copy it).

Layer-drawn colors (field boxes, picker rows, attachment rows) are resolved in the window's own appearance and again
whenever it changes. Annotation strokes are `#FF3B30` in both modes.

**Tested.** `IOSAppearanceTests` renders the sheet in the simulator in both styles and checks the panel color.
`MacAppearanceTests` renders the window in both appearances, checks the background, and checks that layer colors
change when the appearance does. CI uploads the rendered PNGs as the `appearance-snapshots` artifact.

## Shake (iOS)

The SDK listens for the system shake gesture: UIKit already detects it and routes `motionEnded` to the window, so there
is no accelerometer polling and no battery cost. Shakes are ignored while a sheet is open. A view controller that
overrides `motionEnded` without calling `super` swallows the gesture; use `open()` there.

## Screenshots on macOS

The SDK renders the frontmost window's own view hierarchy (`cacheDisplay`), title bar included, at Retina resolution.
Because it never reads the screen, no Screen Recording permission is needed. Content drawn outside AppKit's layer tree
(Metal views, video) can come out blank. When the app has no visible window, the camera button is disabled.

## Performance

- Nothing runs until a shake, a menu item or `open()`. `configure` stores the config (and on iOS installs the shake
  hook once).
- Typing updates only the placeholder and the Send button; the rest of the form re-renders only when its state changes.
  State comparisons treat the screenshot by identity, so they never compare its PNG bytes.
- Annotation strokes are individual `CAShapeLayer`s in image pixel space under one scaled container layer. A touch or
  drag extends only the stroke under the pointer, in place, and resizing or rotating only changes one transform.
- After the capture, the main thread never handles a full-resolution bitmap. Flattening the markup (skipped when there
  is none), PNG encoding and the preview run in one background task, and ImageIO decodes the preview straight to its
  small size.
- The upload body is written to a temporary file and streamed by `URLSession` from disk, so attachments are never
  duplicated in memory. Redirects are refused (they would drop the POST body), as on Android.

## Upload

Send posts multipart to `{endpoint}/api/v1/feedback` exactly as in [docs/CONTRACT.md](../docs/CONTRACT.md): `project`,
`kind`, `text`, optional `email`, `app_version` (`CFBundleShortVersionString`), `os_name` (`ios` or `macos`),
`os_version`, `device_model` (the hardware identifier, like `iPhone16,1` or `Mac14,2`), `screen_w` / `screen_h` (native
pixels), plus `reporter_name`, `reporter_id` and `metadata` when set, a screenshot as `image`, and a voice note as
`audio` + `audio_seconds`.

## Privacy

The SDK reads only its host app's own window, and only after the user taps the camera button. Audio is recorded only
after the user taps the microphone. Nothing leaves the device until the user presses **Send**. On iOS, the host's audio
session category is restored after a recording.

## Troubleshooting

| Symptom                                            | Fix                                                                                                              |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `open()` does nothing                              | Call `configure` first; the log says `open() ignored: call FeedbackBee.configure() first.`                       |
| No microphone button                               | Add `NSMicrophoneUsageDescription`; a sandboxed Mac app also needs the Audio Input entitlement.                  |
| macOS: "Couldn't reach the server"                 | A sandboxed app needs **Outgoing Connections (Client)**; `configure` logs a warning when it is missing.          |
| iOS: shake does nothing on one screen              | That view controller overrides `motionEnded` without calling `super`; call `super`, or use `open()`.             |
| macOS: part of the screenshot is blank             | Metal and video content is drawn outside AppKit's view hierarchy and can't be captured without Screen Recording. |
| `endpoint must be a valid http:// or https:// URL` | Pass the base URL, like `https://bee.example.dev`, not `/api/v1/feedback`.                                       |
| Plain `http://` endpoint fails (local development) | App Transport Security blocks it; add an ATS exception for your dev host, and use HTTPS in production.           |

Warnings are logged under the `io.nesin.feedbackbee` subsystem (Console.app, or Xcode's console).

## Build and test

```bash
cd apple
swift test     # on a Mac: shared core + screenshot encoder tests, and builds the AppKit layer; on Linux: the core
xcodebuild build -scheme FeedbackBee -destination 'generic/platform=iOS Simulator'   # the UIKit layer
```

## Layout

```
Sources/FeedbackBee/
  FeedbackBee.swift        shared API: identify, setContext, reset
  FeedbackKind.swift       kinds, limits, OpenOptions
  FeedbackConfig.swift     validated projectId + endpoint
  FeedbackState.swift      submission state machine and FeedbackController
  Reporter.swift           identify / setContext store, ContextValue
  Upload/                  multipart body, request builder, response parsing, URLSession uploader
  Capture/                 ScreenshotEncoder: flatten, PNG, thumbnail (CoreGraphics + ImageIO)
  Annotate/                Shape model and geometry
  Record/                  VoiceRecorder (AVAudioRecorder; AVAudioSession on iOS)
  UIKit/                   iOS: configure/open, shake, overlay-window sheet, annotator, window capture
  macOS/                   macOS: configure/open/menuItem, feedback window, annotator window, capture, entitlements
Tests/FeedbackBeeTests/    XCTest suites (ScreenshotEncoderTests run where CoreGraphics exists)
```
