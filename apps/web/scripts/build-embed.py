#!/usr/bin/env python3
"""Regenerate the browser bundles the Worker serves, as TS string modules.

- embed/widget.js (hand-written widget)             -> generated/embed_js.ts    /embed.js
- modern-screenshot (in-page screenshots, lazy)      -> generated/capture_js.ts  /embed-capture.js
- @rrweb/record (prompt-free page recording, lazy)   -> generated/record_js.ts   /embed-record.js
- rrweb-player + style (replay page only)            -> generated/player_js.ts   /replay-player.js

Paths are relative to apps/web/src/server.

Third-party code comes from pinned devDependencies in node_modules. Escapes
each file into a TS template literal so the Worker bundles it without extra
loaders. Run after any widget edit or `pnpm install`: pnpm build:embed
"""
import json
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parents[3]
server = root / "apps" / "web" / "src" / "server"
generated = server / "generated"


def escape(text):
    return text.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")


def emit(out, origin, exports):
    body = "".join(f"export const {name} = `" + escape(text) + "`;\n" for name, text in exports)
    out.write_text(f"// Generated from {origin} by apps/web/scripts/build-embed.py. Do not edit.\n" + body)
    size = sum(len(text) for _, text in exports)
    print(f"wrote {out.relative_to(root)} ({size} bytes from {origin})")


def strip_maps(text):
    # Source maps aren't shipped; dangling references only produce 404s/warnings.
    return re.sub(r"(//|/\*)# sourceMappingURL=[^\s*'\"`]+( \*/)?", "", text)


def vendor(name, path, global_name):
    pkg_dir = root / "node_modules" / name
    if not pkg_dir.exists():
        sys.exit(f"{name} missing: run pnpm install first")
    pkg = json.loads((pkg_dir / "package.json").read_text())
    lib = (pkg_dir / path).read_text()
    if global_name not in lib:
        sys.exit(f"refusing: {name}/{path} does not define {global_name}")
    lib = strip_maps(lib)
    # UMD wrappers register with AMD/CommonJS loaders when the host page has
    # one; shadow those names so the library always lands on self.<global>.
    wrapped = (
        f"/*! {pkg['name']} {pkg['version']} | {pkg['license']} | {pkg.get('homepage', '')} */\n"
        "(function(define,module,exports){\n" + lib.rstrip() + "\n}).call(self);\n"
    )
    return pkg, wrapped


src = server / "embed" / "widget.js"
js = src.read_text()
if "feedbackbee" not in js.lower() and "fb-" not in js:
    sys.exit("refusing: file does not look like the widget")
emit(generated / "embed_js.ts", "embed/widget.js", [("EMBED_JS", js)])

pkg, code = vendor("modern-screenshot", "dist/index.js", "modernScreenshot")
emit(generated / "capture_js.ts", f"modern-screenshot@{pkg['version']}", [("CAPTURE_JS", code)])

pkg, code = vendor("@rrweb/record", "dist/record.umd.min.cjs", "rrwebRecord")
emit(generated / "record_js.ts", f"@rrweb/record@{pkg['version']}", [("RECORD_JS", code)])

pkg, code = vendor("rrweb-player", "dist/rrweb-player.umd.min.cjs", "rrwebPlayer")
css = strip_maps((root / "node_modules" / "rrweb-player" / "dist" / "style.min.css").read_text())
emit(generated / "player_js.ts", f"rrweb-player@{pkg['version']}", [("PLAYER_JS", code), ("PLAYER_CSS", css)])
