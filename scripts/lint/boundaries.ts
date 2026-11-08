import { builtinModules } from "node:module";

/**
 * Oxlint does not merge two overrides that set the same rule on one file: the
 * later override replaces the earlier. So the generator gives every file
 * exactly one `no-restricted-imports` entry, holding every import row that
 * applies to it.
 */

type Scope = "**" | `${string}/**`;

type ImportRestriction = {
  patterns?: { group?: string[]; regex?: string; importNames?: string[]; message: string }[];
  paths?: { name: string; importNames?: string[]; message: string }[];
};

type BoundaryRule = {
  /** The AGENTS.md rule table id this entry enforces. Two entries may share one. */
  id: string;
  except?: string[];
  enabled: boolean;
} & (
  | { kind: "import"; scope: Scope; restrict: ImportRestriction }
  | { kind: "plugin"; scope: string; rule: `repo/${string}`; options?: Record<string, string> }
);

const R2_ALLOWED = ["async_hooks", "buffer"];
const bareBuiltins = [
  ...new Set(builtinModules.filter((m) => !m.startsWith("node:")).map((m) => m.split("/")[0])),
].filter((m) => !R2_ALLOWED.includes(m));

const R2_MESSAGE =
  "R2: packages/core/src stays runtime-neutral (AGENTS.md). Use Web APIs (crypto.subtle, fetch, TextEncoder), or move Node-only code to packages/core/src/database/node.ts, packages/core/src/storage/node.ts or apps/web/src/server/entry.node.ts.";

const DRIZZLE_DRIVERS = [
  "better-sqlite3",
  "bun-sqlite",
  "d1",
  "durable-sqlite",
  "libsql",
  "node-sqlite",
  "sqlite-proxy",
].join("|");

const JS_EXTENSION = "(\\.[cm]?[jt]sx?)?";
const DRIVER_SPECIFIER = `^(better-sqlite3|node:sqlite|@libsql/.*|drizzle-orm/(${DRIZZLE_DRIVERS}))(/|$)`;
const DRIVER_MESSAGE =
  "R8a: open no second database driver. Import `db` from apps/web/src/server/db in the app, or from @groot/core/database in a package; bootstrap() sets it.";
const DRIVER_HOMES = [
  "packages/core/src/database/node.ts",
  "packages/core/src/database/d1.ts",
  "apps/web/src/server/db/**",
  // Workers: the D1 binding only exists per request, so the entry opens it.
  "apps/web/src/server/entry.worker.ts",
  "tests/**",
];

const BOUNDARY_RULES: BoundaryRule[] = [
  {
    id: "R1",
    kind: "import",
    scope: "packages/**",
    enabled: true,
    restrict: {
      patterns: [
        {
          regex: "(^|/)apps/|^@/|^@groot/web(/|$)",
          message:
            "R1: packages never import from apps/ (AGENTS.md). Move the code into a package, or have the app pass it in.",
        },
      ],
    },
  },
  {
    id: "R2",
    kind: "import",
    scope: "packages/core/src/**",
    except: ["packages/core/src/database/node.ts", "packages/core/src/storage/node.ts"],
    enabled: true,
    restrict: {
      patterns: [
        {
          group: ["node:*", "node:*/**", ...R2_ALLOWED.map((m) => `!node:${m}`)],
          message: R2_MESSAGE,
        },
        { regex: `^(${bareBuiltins.join("|")})(/|$)`, message: R2_MESSAGE },
      ],
    },
  },
  {
    id: "R3",
    kind: "plugin",
    scope: "**",
    rule: "repo/no-raw-env",
    except: [
      "packages/core/src/env.ts",
      "scripts/**",
      "tests/**",
      ".agents/**",
      ".claude/**",
      ".groot/**",
      "**/*.config.ts",
      "**/*.config.*.ts",
      // Loads .env and hands process.env to bootstrap().
      "apps/web/src/server/entry.node.ts",
    ],
    enabled: true,
  },
  {
    id: "R4",
    kind: "import",
    scope: "**",
    enabled: true,
    restrict: {
      paths: ["@groot/shell/lib/utils", "@groot/shell/lib/utils.ts"].map((name) => ({
        name,
        importNames: ["cn"],
        message:
          "R4: import cn from @groot/ui/lib/utils, its one source. `pnpm exec tsx scripts/codemods/cn-import-path.ts` rewrites every old import.",
      })),
    },
  },
  {
    id: "R5a",
    kind: "import",
    scope: "**",
    except: ["packages/ui/**"],
    enabled: true,
    restrict: {
      patterns: [
        {
          regex:
            "^@groot/ui(/(breadcrumb|index)(\\.tsx?)?)?$|(^|/)ui/src(/(breadcrumb|index)(\\.tsx?)?)?$",
          importNames: ["BreadcrumbItem", "BreadcrumbSeparator"],
          message:
            'R5a: render breadcrumbs with <Breadcrumbs page="Current">{links}</Breadcrumbs> from @groot/ui/breadcrumb, which places the list items and separators.',
        },
      ],
    },
  },
  {
    id: "R5b",
    kind: "plugin",
    scope: "**/*.tsx",
    rule: "repo/no-nested-breadcrumb-separator",
    enabled: true,
  },
  {
    id: "R5c",
    kind: "plugin",
    scope: "**/*.tsx",
    rule: "repo/breadcrumbs-children",
    enabled: true,
  },
  {
    id: "R7",
    kind: "plugin",
    scope: "packages/*/src/**",
    rule: "repo/no-package-transaction",
    enabled: true,
  },
  {
    id: "R8a",
    kind: "import",
    scope: "**",
    except: DRIVER_HOMES,
    enabled: true,
    restrict: { patterns: [{ regex: DRIVER_SPECIFIER, message: DRIVER_MESSAGE }] },
  },
  {
    id: "R8a",
    kind: "plugin",
    scope: "**",
    rule: "repo/no-restricted-require",
    options: { regex: DRIVER_SPECIFIER, message: DRIVER_MESSAGE },
    except: DRIVER_HOMES,
    enabled: true,
  },
  {
    id: "R8b",
    kind: "import",
    scope: "**",
    except: [
      "packages/core/src/bootstrap.ts",
      // Reads core.db through a namespace import, which the rule can't tell from a setDb import.
      "apps/web/src/server/db/index.ts",
    ],
    enabled: true,
    restrict: {
      patterns: [
        {
          regex: `(^|/)database${JS_EXTENSION}(/index${JS_EXTENSION})?$`,
          importNames: ["setDb"],
          message:
            "R8b: only bootstrap() calls setDb. Import `db` from apps/web/src/server/db in the app, or from @groot/core/database in a package.",
        },
      ],
    },
  },
  {
    id: "R9",
    kind: "plugin",
    scope: "**",
    rule: "repo/no-session-invalid",
    except: [
      // The guard. `sessionInvalid` is module-private there, but the code is
      // public in ErrorCode, so a hand-built error elsewhere still needs this rule.
      "packages/core/src/session/index.ts",
      // Defines the code.
      "packages/core/src/errors/index.ts",
      // The client, which signs the owner out on the code.
      "packages/shell/src/lib/api.ts",
      "scripts/lint/repo-plugin.mjs",
      "tests/**",
    ],
    enabled: true,
  },
];

/** The AGENTS.md rule ids the enabled rules enforce. */
export const enforcedRuleIds = new Set(BOUNDARY_RULES.filter((r) => r.enabled).map((r) => r.id));

const covers = (glob: string, zone: string) =>
  glob === "**" || glob === zone || (glob.endsWith("/**") && zone.startsWith(glob.slice(0, -2)));

const depth = (zone: string) => (zone === "**" ? 0 : zone.replace(/\/\*\*$/, "").split("/").length);

type Override = {
  files: string[];
  excludeFiles?: string[];
  jsPlugins?: string[];
  rules: Record<string, unknown>;
};

export function boundaryOverrides(pluginPath: string): Override[] {
  const enabled = BOUNDARY_RULES.filter((r) => r.enabled);
  const importRules = enabled.filter((r) => r.kind === "import");
  const zones = [...new Set(importRules.flatMap((r) => [r.scope, ...(r.except ?? [])]))];
  for (const zone of zones) {
    if (zone.replace(/^\*\*$|\/\*\*$/, "").includes("*")) {
      throw new Error(`Import boundary zone "${zone}" must be "**", "<dir>/**" or a file path.`);
    }
  }

  const importOverrides = zones
    .toSorted((a, b) => depth(a) - depth(b))
    .map((zone): Override => {
      const applying = importRules.filter(
        (r) => covers(r.scope, zone) && !r.except?.some((e) => covers(e, zone)),
      );
      const patterns = applying.flatMap((r) => r.restrict.patterns ?? []);
      const paths = applying.flatMap((r) => r.restrict.paths ?? []);
      return {
        files: [zone],
        rules: {
          "no-restricted-imports": applying.length
            ? ["error", { ...(patterns.length && { patterns }), ...(paths.length && { paths }) }]
            : "off",
        },
      };
    });

  const pluginOverrides = enabled
    .filter((r) => r.kind === "plugin")
    .map((r): Override => ({
      files: [r.scope],
      ...(r.except && { excludeFiles: r.except }),
      jsPlugins: [pluginPath],
      rules: { [r.rule]: r.options ? ["error", r.options] : "error" },
    }));

  return [...importOverrides, ...pluginOverrides];
}
