---
name: friction-log
description: >
  File durable repo or tool papercuts as friction issues so the next person or
  agent can fix them. Use when a session hits recurring friction (a missing
  setup step, a lying type, a broken script or test harness, docs that disagree
  with the code, a brittle test), when wrapping up work that left friction
  behind, or for /friction-log.
---

# Friction log

Friction is durable, recurring pain with a clear owner and a reproducible gap:
a missing step, a lying type, a broken harness, docs that disagree with the
code, a brittle test. Log it so the next agent can act on it without your
session. One-off confusion and nits that only mattered in this session stay in
the session.

Do every issue step with the GitHub CLI (`gh`), never by hand in a browser
and never through raw API calls. The commands below were checked against
`gh --help`; if a flag is rejected, run `gh <command> --help` and adapt.

## 1. Fix first, then file the rest

Fix obvious, low-risk friction in the current change when it is in scope, and
mention the fix in your summary. File only what is left over.

## 2. Check the GitHub CLI and where to file

Confirm `gh` is installed and logged in with `gh auth status`. If it is
missing or logged out, tell the user the one command to fix it
(`gh auth login`) and stop; don't work around it.

File on the current repository by default. If the friction lives in a
dependency or tool the project does not own, file it on that project's GitHub
repository instead (add `--repo owner/repo` to every command), and only if it
clearly meets the bar. If the project isn't on GitHub, use the local log
(section 7).

Never file to a public repository without the user's go-ahead when the
content could reveal private code, internal names or customer data.

## 3. Write the issue body to a file

Write the body to a temporary Markdown file (for example `/tmp/friction.md`)
and pass the file to `gh`, so long Markdown survives shell quoting. Give the
issue a short, specific title naming the gap, not the symptom you felt. The
body has these sections:

- **What happened:** the observed behavior.
- **What you wanted:** the expected behavior or missing capability.
- **How to reproduce:** exact steps or commands.
- **Cost:** time lost, workarounds needed, how often it bites.
- **What you already looked at:** what you checked and ruled out.
- **Relevant files:** paths, line numbers, links.

If the project has a friction issue template, follow it instead. Keep
secrets, tokens and private data out.

## 4. Pick a priority

- `P0`: blocks work, no workaround.
- `P1`: costly workaround, hits often.
- `P2`: annoying, has a cheap workaround.
- `P3`: minor polish.

Add `needs-decision` when fixing it needs a human call (a design choice, an
ownership question). If the project already has its own priority or triage
labels, use those instead. `friction-skipped` marks an issue that friction
sweeps should leave alone until someone removes the label; don't change it.

## 5. Search, then comment or file

Search open friction issues first. If one covers the same gap, comment with
your new evidence instead of opening a duplicate.

```bash
# search
gh issue list --label friction --state open --search "<keywords>"
# comment on a match
gh issue comment <number> --body-file /tmp/friction.md
# create missing labels once (errors if they exist; that's fine)
gh label create friction --color FBCA04 --description "Durable papercut worth fixing" 2>/dev/null || true
gh label create P2 --color C5DEF5 2>/dev/null || true
gh label create needs-decision --color D93F0B 2>/dev/null || true
# file
gh issue create --title "<title>" --label friction --label P2 --body-file /tmp/friction.md
```

To use a repo issue template, add `--template "<template name>"`.

## 6. Report back

List what you fixed, what you filed (with the issue links `gh` printed),
what you commented on, and what you judged below the bar and left unfiled.

## 7. Local log (not on GitHub)

When the project isn't on GitHub, append one entry per item to `FRICTION.md`
in the repo root (create it if missing), newest first, and tell the user:

```markdown
## <title> (P2, <YYYY-MM-DD>)

- What happened: …
- What you wanted: …
- How to reproduce: …
- Cost: …
- What you already looked at: …
- Relevant files: …
```
