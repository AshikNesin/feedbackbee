#!/usr/bin/env bash
# Simulator screenshots of every screen, light and dark (Xcode 16+, a Mac).
# Debug builds launch into one screen with `-demoScreen <name>`, signed in to a
# built-in fake server with sample reports (FeedbackBee/DemoMode.swift).
#   ./screenshots.sh [out-dir]      DEVICE="iPhone 16 Pro" by default
set -euo pipefail
cd "$(dirname "$0")"
out="${1:-screenshots}"
device="${DEVICE:-iPhone 16 Pro}"
bundle=io.nesin.feedbackbee

udid=$(xcrun simctl list devices available -j | jq -r --arg n "$device" '[.devices[][] | select(.name == $n)][0].udid')
if [ -z "$udid" ] || [ "$udid" = null ]; then
  udid=$(xcrun simctl list devices available -j | jq -r '[.devices | to_entries[] | select(.key | test("iOS")) | .value[] | select(.name | test("^iPhone"))][0].udid')
fi
echo "Simulator: $udid"
xcrun simctl boot "$udid" 2>/dev/null || true
xcrun simctl bootstatus "$udid" -b >/dev/null

xcodebuild build -project FeedbackBee.xcodeproj -scheme FeedbackBee -configuration Debug \
  -destination "id=$udid" -derivedDataPath build -quiet
xcrun simctl install "$udid" build/Build/Products/Debug-iphonesimulator/FeedbackBee.app
xcrun simctl status_bar "$udid" override --time 9:41 --batteryState charged --batteryLevel 100 --wifiBars 3 --cellularBars 4

mkdir -p "$out"
for appearance in light dark; do
  xcrun simctl ui "$udid" appearance "$appearance"
  for screen in signIn projects inbox compose report edit newProject settings; do
    xcrun simctl terminate "$udid" "$bundle" 2>/dev/null || true
    xcrun simctl launch "$udid" "$bundle" -demoScreen "$screen" >/dev/null
    sleep 4
    xcrun simctl io "$udid" screenshot "$out/$screen-$appearance.png" >/dev/null
    echo "  $out/$screen-$appearance.png"
  done
done
