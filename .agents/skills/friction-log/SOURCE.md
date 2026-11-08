# Source

- Original: https://github.com/kentcdodds/kcd-skills/tree/main/skills/friction-log
- Author: Kent C. Dodds
- License: MIT (see LICENSE in this folder)
- Based on commit: 064a66ba9866967676c2797e189b60aacc04b515 (2026-11-07)
- Modified: rewritten to be tool-neutral. Removed the Kody CLI command and its prefer-local-kody-execute dependency, plus references to ship-pr and the autopilot triage scheme. All issue steps go through the GitHub CLI (gh), with commands checked against gh --help, defined P0–P3 priorities, and a local FRICTION.md fallback for projects not on GitHub.
