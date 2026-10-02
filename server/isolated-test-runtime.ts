import { createRequire } from "node:module";
import path from "node:path";
type Guard = {
  assertRuntime: (env?: NodeJS.ProcessEnv) => { url: string; database: string; marker: string };
  proveDatabase: (client: unknown, target: unknown) => Promise<void>;
};
export const isolatedTestMode = process.env.ISOLATED_TEST_MODE === "1";
// Production CJS builds must never access import.meta or test-only files.
const guard: Guard | undefined = isolatedTestMode
  ? createRequire(path.join(process.cwd(), "package.json"))("./scripts/isolated-test/target.cjs")
  : undefined;
export const isolatedTestTarget = isolatedTestMode ? guard!.assertRuntime() : undefined;

export async function proveIsolatedRuntimeDatabase(pool: { connect(): Promise<any> }) {
  if (!isolatedTestMode) return;
  const client = await pool.connect();
  try {
    await guard!.proveDatabase(client, isolatedTestTarget);
  } catch {
    throw new Error("Isolated runtime database proof failed; startup writes are prohibited");
  } finally {
    client.release();
  }
}