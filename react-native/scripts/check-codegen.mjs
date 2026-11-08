// Runs React Native codegen on src/NativeFeedbackBee.ts into build/codegen, so a spec change that
// breaks the native signatures shows up without building an app.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const reactNative = path.dirname(require.resolve("react-native/package.json"));
const combine = require.resolve(
  "@react-native/codegen/lib/cli/combine/combine-js-to-schema-cli.js",
  {
    paths: [reactNative],
  },
);
const out = path.join(root, "build", "codegen");
const schema = path.join(out, "schema.json");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
execFileSync("node", [combine, schema, path.join(root, "src")], { stdio: "inherit" });
for (const platform of ["ios", "android"]) {
  execFileSync(
    "node",
    [
      path.join(reactNative, "scripts", "generate-specs-cli.js"),
      "--platform",
      platform,
      "--schemaPath",
      schema,
      "--outputDir",
      path.join(out, platform),
      "--libraryName",
      "RNFeedbackBeeSpec",
      "--javaPackageName",
      "io.nesin.feedbackbee.reactnative",
      "--libraryType",
      "modules",
    ],
    { stdio: "inherit" },
  );
}
console.log(`codegen: generated ${path.relative(root, out)}`);
