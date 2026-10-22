#!/usr/bin/env python3
"""Regenerate src/embed_js.ts from src/embed_widget.js (the hand-written source).

Escapes the widget into a TS template literal so the Worker bundles it without
extra loaders. Run after any edit: python3 scripts/build-embed.py
"""
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parent.parent
src = root / "src" / "embed_widget.js"
out = root / "src" / "embed_js.ts"

js = src.read_text()
if "feedbackbarn" not in js.lower() and "fb-" not in js:
    sys.exit("refusing: file does not look like the widget")

escaped = js.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
out.write_text(
    "// Generated from embed_widget.js by scripts/build-embed.py. Edit the .js, not this file.\n"
    "export const EMBED_JS = `" + escaped + "`;\n"
)
print(f"wrote {out.relative_to(root)} ({len(js)} bytes of widget source)")
