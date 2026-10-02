#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { mkdir, symlink } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import path from "node:path";
import environment from "./environment.cjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
async function child(args, env) {
  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, args, { cwd: root, env, stdio: "inherit" });
    const forward = signal => proc.kill(signal);
    const int = () => forward("SIGINT");
    const term = () => forward("SIGTERM");
    process.on("SIGINT", int);
    process.on("SIGTERM", term);
    proc.once("error", reject);
    proc.once("exit", code => {
      process.off("SIGINT", int);
      process.off("SIGTERM", term);
      resolve(code ?? 1);
    });
  });
}
try {
  const action = process.argv[2] || "--check";
  if (!["--check", "--bootstrap", "--fixtures", "--serve", "--run"].includes(action))
    throw new Error("Use --check, --bootstrap, --fixtures, --serve, or --run tests/isolated-runtime-*.mjs");
  const { env, target } = environment.buildEnvironment(process.env, root);
  const proofCode = await child(["scripts/isolated-test/preflight.mjs"], env);
  if (proofCode !== 0) process.exit(proofCode);
  env.ISOLATED_TEST_PROVEN = target.marker;
  env.DATABASE_URL = target.url;
  if (action === "--check") process.exit(0);
  let args;
  let entry;
  if (action === "--bootstrap") {
    const baseline = "scripts/isolated-test/baseline.ts";
    if (!existsSync(path.join(root, baseline))) throw new Error("Isolated baseline entrypoint is not installed");
    entry = "scripts/isolated-test/bootstrap.ts";
  } else if (action === "--fixtures") {
    entry = "server/isolated-test-fixtures.ts";
  } else if (action === "--serve") {
    entry = "server/index.ts";
  } else {
    const file = process.argv[3];
    if (!file || !/^tests\/isolated-runtime-[a-z0-9-]+\.mjs$/.test(file) || !existsSync(path.join(root, file)))
      throw new Error("Only an existing tests/isolated-runtime-*.mjs entrypoint is permitted");
    args = [file];
  }
  if (entry) {
    // Compile before entering the network-confined child: tsx's esbuild
    // subprocess would otherwise require an unsafe subprocess exception.
    const compiledDir = path.join(path.dirname(env.ISOLATED_TEST_REGISTRY), "compiled");
    await mkdir(compiledDir, { recursive: true, mode: 0o700 });
    await symlink(path.join(root, "node_modules"), path.join(compiledDir, "node_modules")).catch(error => {
      if (error.code !== "EEXIST") throw error;
    });
    const outfile = path.join(compiledDir, path.basename(entry, ".ts") + ".mjs");
    await build({
      entryPoints: [path.join(root, entry)], outfile, bundle: true,
      platform: "node", format: "esm", packages: "external", logLevel: "silent",
      plugins: [{
        name: "preserve-source-import-meta",
        setup(build) {
          build.onLoad({ filter: /\.(ts|js|mjs)$/ }, async args => {
            if (args.path.includes("/node_modules/")) return;
            const { readFile } = await import("node:fs/promises");
            return {
              contents: (await readFile(args.path, "utf8")).replace(/\bimport\.meta\.url\b/g, JSON.stringify(pathToFileURL(args.path).href)),
              loader: args.path.endsWith(".ts") ? "ts" : "js",
            };
          });
        },
      }],
    });
    args = [outfile];
  }
  process.exitCode = await child(args, env);
} catch (error) {
  // Guard failures contain no URL values. Never print raw PG errors or env.
  console.error(error instanceof Error && error.message.startsWith("Isolated test refused:")
    ? error.message : "Isolated launcher refused or failed; check the safe action and prerequisites.");
  process.exitCode = 1;
}