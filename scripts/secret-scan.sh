#!/usr/bin/env bash
# Scans the commits a CI event adds for secrets. A push that creates a branch
# has an all-zero base, and a force-push has a base CI never fetched: both fall
# back to origin/main, so the scan never covers zero commits.
#
# Usage: scripts/secret-scan.sh <gitleaks binary> <base commit>
set -euo pipefail

gitleaks=$1
base=$2

if git rev-parse --verify --quiet "$base^{commit}" >/dev/null; then
  range="$base..HEAD"
else
  echo "Base '$base' is not a commit in this checkout, so scanning origin/main..HEAD."
  range="origin/main..HEAD"
fi

count=$(git rev-list --count "$range")
if [ "$count" -eq 0 ]; then
  echo "$range adds no commits, so scanning HEAD alone."
  range="-1 HEAD"
fi

echo "Scanning $range"
"$gitleaks" git --config .gitleaks.toml --redact --verbose --no-banner --log-opts="$range"
