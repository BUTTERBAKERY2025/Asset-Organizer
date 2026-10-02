/** Offline artifact generation ONLY; target application belongs to the isolated launcher. */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeBaseline } from "./baseline";
export { buildBaseline, writeBaseline } from "./baseline";

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--out" || !args[1]) {
    console.error("Usage: tsx scripts/isolated-test/baseline-generate.ts --out <new-output-directory> (offline generation only)");
    process.exitCode = 1;
  } else {
    writeBaseline(path.resolve(args[1])).then(manifest => {
      console.log(`Offline baseline generated: ${manifest.drizzleTableCount} Drizzle tables; SQL sha256 ${manifest.sql.sha256}`);
      console.log("NOT database-validated or application-tested. Review baseline.manifest.json limitations.");
    }).catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
  }
}