import { describe, expect, it } from "vitest";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";

// Run the actual route handlers through Express 4's dispatch layer, in a
// production-mode child process. No listener, real DB, auth, or send services.
async function runRoute(route: string, unwrapped = false) {
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
        import { registerCentralKitchenDemandRoutes } from "./server/central-kitchen-demand-routes";
        import Layer from "express/lib/router/layer.js";
        const routes = new Map();
        const app = {
          get: (path, ...handlers) => routes.set(path, handlers.at(-1)),
          post: (path, ...handlers) => routes.set(path, handlers.at(-1)),
        };
        registerCentralKitchenDemandRoutes(app);
        const res = {
          statusCode: 200,
          status(code) { this.statusCode = code; return this; },
          json(body) { console.log(JSON.stringify({status: this.statusCode, body})); return this; },
          set() { return this; },
        };
        const req = {
          query: {}, params: {id: "1", itemId: "1"},
          body: {type: "waive", quantity: "1", reason: "documented reason",
            acknowledged: true, idempotencyKey: "runtime-test-key"},
        };
        new Layer("/", {}, routes.get(${JSON.stringify(route)}))
          .handle_request(req, res, (error) => {
            if (!error || error.code !== "42P01") process.exit(2);
            res.status(500).json({message: "Internal Server Error"});
          });
        setTimeout(() => console.log("PROCESS_STILL_ALIVE"), 30);
      `,
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    minify: true,
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{
      name: "isolated-runtime",
      setup(builder) {
        builder.onResolve({ filter: /^\.\/(db|auth)$/ }, (args) => ({
          path: args.path, namespace: "isolated",
        }));
        builder.onLoad({ filter: /.*/, namespace: "isolated" }, (args) => ({
          contents: args.path === "./db" ? `
            const error = Object.assign(new Error('relation "central_kitchen_demand_commitments" does not exist'), {code: "42P01"});
            const query = new Proxy({}, {get(_, key) {
              if (key === "then") return (resolve, reject) => Promise.reject(error).then(resolve, reject);
              return () => query;
            }});
            export const db = {select: () => query};
          ` : `
            export const getAllowedBranchIds = () => null;
            export const canAccessBranch = async () => true;
            export const isAuthenticated = (_req, _res, next) => next();
            export const requirePermission = () => isAuthenticated;
          `,
        }));
        if (unwrapped) builder.onLoad({ filter: /central-kitchen-demand-routes\.ts$/ }, async (args) => {
          const contents = await readFile(args.path, "utf8");
          const start = contents.indexOf("const forwardAsyncErrors =");
          const end = contents.indexOf("export function registerCentralKitchenDemandRoutes", start);
          if (start < 0 || end < 0) throw new Error("Wrapper source boundary missing");
          // Restore original Express 4 registration semantics without changing
          // route logic, queries, schema, or the injected database error.
          return {
            contents: contents.slice(0, start)
              + "const forwardAsyncErrors = (handler: RequestHandler) => handler;\n"
              + contents.slice(end),
            loader: "ts",
            resolveDir: path.dirname(args.path),
          };
        });
      },
    }],
  });
  return spawnSync(process.execPath, ["--unhandled-rejections=strict", "-"], {
    input: result.outputFiles[0].text,
    encoding: "utf8",
    timeout: 15_000,
    // Do not inherit any development/production credentials.
    env: { PATH: process.env.PATH, NODE_ENV: "production" },
    maxBuffer: 2 * 1024 * 1024,
  });
}

describe("missing kitchen demand schema must not kill the server process", () => {
  it("reproduces the original GET handler's process exit on missing table", async () => {
    const child = await runRoute("/api/central-kitchen-demand", true);
    expect(child.error).toBeUndefined();
    expect(child.status).toBe(1);
    expect(child.stderr).toContain("42P01");
    expect(child.stdout).not.toContain("PROCESS_STILL_ALIVE");
  });

  it.each([
    "/api/central-kitchen-demand",
    "/api/central-kitchen-demand/legacy-candidates",
    "/api/central-kitchen-demand/activate/:itemId",
    "/api/central-kitchen-demand/:id/actions",
  ])("forwards %s failures to controlled 500 and stays alive", async (route) => {
    const child = await runRoute(route);
    expect(child.error).toBeUndefined();
    expect(child.stderr).toBe("");
    expect(child.status).toBe(0);
    expect(child.stdout).toContain('"status":500');
    expect(child.stdout).toContain("PROCESS_STILL_ALIVE");
  });
});