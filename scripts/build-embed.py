#!/usr/bin/env python3
"""Regenerate the widget bundles the Worker serves.

- src/embed_widget.js (hand-written widget) -> src/embed_js.ts, served at /embed.js
- node_modules/modern-screenshot (pinned devDependency, UMD build) -> src/capture_js.ts,
  served at /embed-capture.js and lazy-loaded by the widget for in-page screenshots.

Escapes each file into a TS template literal so the Worker bundles it without
extra loaders. Run after any edit (and after `pnpm install`): python3 scripts/build-embed.py
"""
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent


def emit(out, name, origin, js):
    escaped = js.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
    out.write_text(
        f"// Generated from {origin} by scripts/build-embed.py. Do not edit.\n"
        f"export const {name} = `" + escaped + "`;\n"
    )
    print(f"wrote {out.relative_to(root)} ({len(js)} bytes from {origin})")


src = root / "src" / "embed_widget.js"
js = src.read_text()
if "feedbackbee" not in js.lower() and "fb-" not in js:
    sys.exit("refusing: file does not look like the widget")
emit(root / "src" / "embed_js.ts", "EMBED_JS", "embed_widget.js", js)

pkg_dir = root / "node_modules" / "modern-screenshot"
if not pkg_dir.exists():
    sys.exit("modern-screenshot missing: run pnpm install first")
pkg = json.loads((pkg_dir / "package.json").read_text())
lib = (pkg_dir / "dist" / "index.js").read_text()
# The UMD wrapper registers with AMD/CommonJS loaders when the host page has
# one; shadow those names so it always lands on self.modernScreenshot.
wrapped = (
    f"/*! modern-screenshot {pkg['version']} | {pkg['license']} | {pkg['homepage']} */\n"
    "(function(define,module,exports){\n" + lib.rstrip() + "\n}).call(self);\n"
)
emit(root / "src" / "capture_js.ts", "CAPTURE_JS", f"modern-screenshot@{pkg['version']}", wrapped)
