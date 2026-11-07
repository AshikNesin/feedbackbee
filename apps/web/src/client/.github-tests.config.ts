import { defineConfig } from "vite-plus";
import path from "node:path";

const root = process.cwd();
const clientSrc = path.resolve(root, "apps/web/src/client");
const packages = path.resolve(root, "packages");

export default defineConfig({
  root: path.resolve(root, "apps/web"),
  resolve: {
    alias: [
      { find: "@groot/shell/index.css", replacement: path.resolve(packages, "shell/src/index.css") },
      { find: "@groot/ui", replacement: path.resolve(packages, "ui/src") },
      { find: "@groot/jobs/client", replacement: path.resolve(packages, "jobs/src/client") },
      { find: "@groot/shell", replacement: path.resolve(packages, "shell/src") },
      { find: "@", replacement: clientSrc },
    ],
  },
  test: {
    include: ["src/client/features/github/*.test.tsx"],
    environment: "jsdom",
    setupFiles: [path.resolve(root, "tests/client/setup.ts")],
  },
});
