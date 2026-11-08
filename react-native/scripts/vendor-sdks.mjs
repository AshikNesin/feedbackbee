// Copies the native SDK sources into vendor/ so the npm package is self-contained: CocoaPods only
// compiles files inside the pod's own directory, and Gradle then needs no settings.gradle includes.
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repo = path.dirname(root);
const vendor = path.join(root, "vendor");

const copies = [
  ["ios/Sources/FeedbackBee", "ios/FeedbackBee"],
  ["android/sdk/src/main/kotlin", "android/kotlin"],
  ["android/sdk/src/main/res", "android/res"],
];

for (const [from] of copies) {
  if (!existsSync(path.join(repo, from))) {
    console.error(`vendor-sdks: ${from} not found. Run this from a FeedbackBee checkout.`);
    process.exit(1);
  }
}

rmSync(vendor, { recursive: true, force: true });
for (const [from, to] of copies) {
  cpSync(path.join(repo, from), path.join(vendor, to), { recursive: true });
}
console.log("vendor-sdks: copied the iOS and Android SDK sources into vendor/");
