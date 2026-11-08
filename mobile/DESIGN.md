# FeedbackBee mobile: design

The single source of truth for the owner apps in `mobile/ios` (SwiftUI) and
`mobile/android` (Compose). Tokens live in code (`Theme.swift`, `Theme.kt`);
this file says why each exists. A UI change updates this file and both apps
together.

## 1. Voice

The apps are the dashboard in your pocket: read what arrived, triage it, file
something fast. They feel like the web dashboard: warm paper and ink, honey
for the brand and the one thing that matters on a screen, nothing loud.

- Say what a thing does ("File an issue", "Sync from GitHub").
- No exclamation marks. Errors say what failed and what to try.
- Version and company live in Settings, never on a main screen.

## 2. Color

Light and dark follow the system. Values are the web dashboard's tokens
(`apps/web/src/client/styles.css`, oklch) converted to sRGB.

| Token      | Light     | Dark      | Use                                        |
| ---------- | --------- | --------- | ------------------------------------------ |
| `paper`    | `#FBFAF7` | `#0E0D0B` | Screen background                          |
| `card`     | `#FEFDFC` | `#171613` | Cards, grouped rows, sheets                |
| `muted`    | `#F4F1ED` | `#211F1C` | Chips, filled inputs, image placeholders   |
| `rule`     | `#E2DFDA` | `#282623` | 1 pt hairlines                             |
| `ink`      | `#181612` | `#EDEBE7` | Primary text; the one filled button        |
| `inkMuted` | `#605D57` | `#A19E99` | Secondary text, metadata                   |
| `honey`    | `#F4B306` | `#F4B306` | Brand, selected filter, the compose button |
| `onHoney`  | `#18181B` | `#18181B` | Text and icons on honey                    |
| `danger`   | `#DC2626` | `#F87171` | Delete, errors                             |

Status (always a dot plus its word, never color alone):

| Status      | Light     | Dark      |
| ----------- | --------- | --------- |
| Open        | `#2563EB` | `#60A5FA` |
| In progress | `#B45309` | `#F4B93C` |
| Done        | `#15803D` | `#4ADE80` |
| Won't fix   | `#71717A` | `#A1A1AA` |

Kind dot: Issue `danger`, Feature request `honey`, Other `inkMuted`.

## 3. Type and spacing

System fonts (SF Pro, Roboto) at the platform's Dynamic Type / font-scale
sizes; weight carries hierarchy. 4-pt grid: 4, 8, 12, 16, 20, 24, 32. Cards
use a 12 pt radius and a `rule` hairline, no shadow; sheets use the platform's
own corner radius.

## 4. Screens

1. **Sign in.** Server (your FeedbackBee URL; `https://` is added when
   missing), email, password. One ink button. Errors inline under the form.
2. **Projects.** A plain list: name, project id, `owner/repo`. The last
   opened project opens on launch. Toolbar: Settings, New project.
3. **Inbox** (one project). Status filter (All, Open, In progress, Done,
   Won't fix; server-side) and kind filter (All, Issues, Ideas, Other; on the
   loaded items, like the web). Search over loaded items. Rows: kind dot, two
   lines of text, relative time, status dot + word, `#issue`, small icons for
   images, replay/recording and voice note. Pull to refresh, infinite scroll.
   Long-press: status menu and Delete; iOS also swipes (leading Done,
   trailing Delete). Deletes are confirmed. Menu: Sync from GitHub,
   Open in dashboard, Delete project. A honey **New issue** button opens the
   quick-file sheet.
4. **Report.** Text, kind, status picker, images (tap for full screen), links
   to the GitHub issue, replay/recording and voice note, reporter (mail
   link), page URL, device context, metadata, issue error. Toolbar: Edit
   (sheet), Share issue link, Delete.
5. **Quick file sheet.** A bottom sheet at medium height: kind chips
   (Issue / Idea / Other), the note focused, optional images from the photo
   picker (up to 5), Send. Enter-to-send is off; Send stays disabled until
   there is text. The same sheet edits a report (kind + text, no images).
6. **Settings.** Server, signed-in email, Sign out (confirmed), Open web
   dashboard, version, "Nesin Technologies LLP".

Home-screen shortcut / quick action **New issue** opens the quick-file sheet
on the last project.

## 5. Performance rules

- First paint never waits for the network: the last inbox page per project
  and the project list are cached on disk and shown at once, then refreshed.
- Lists are lazy with stable ids (`LazyColumn` keys, SwiftUI `List` ids).
- Images: `/f/<key>` is immutable, so it is cached on disk forever and
  decoded at thumbnail size into a memory cache; full size only on the viewer.
- One HTTP client per app (connection reuse, HTTP/2), JSON decoded off the
  main thread, no reflection on Android (kotlinx.serialization), R8 in release.
- Status changes and edits update the row optimistically and roll back on
  failure.
