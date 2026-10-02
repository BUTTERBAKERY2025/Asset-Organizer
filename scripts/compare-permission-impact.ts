import { readFileSync } from "node:fs";
import { comparePermissionImpact } from "./permission-impact";

// No bootstrap, dotenv, database, network, or write API. Only a supplied local
// JSON file (or JSON piped on stdin) is read; the report goes to stdout.
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === "--help") {
  process.stdout.write("Usage: npx tsx scripts/compare-permission-impact.ts <sanitized.json|->\n");
} else if (args.length !== 1 || args[0].startsWith("--")) {
  process.stderr.write("Expected one sanitized JSON file path, or - for stdin. Use --help.\n");
  process.exitCode = 1;
} else {
  try {
    const raw = JSON.parse(readFileSync(args[0] === "-" ? 0 : args[0], "utf8"));
    process.stdout.write(`${JSON.stringify(comparePermissionImpact(raw), null, 2)}\n`);
  } catch (error) {
    // Do not echo row values (including any mistakenly supplied sensitive data).
    const message = error instanceof SyntaxError ? "Invalid JSON input"
      : error instanceof Error && error.name === "ZodError" ? "Invalid sanitized input schema; see usage documentation"
      : error instanceof Error ? error.message : "Comparison failed";
    process.stderr.write(`Permission impact comparison failed: ${message}\n`);
    process.exitCode = 1;
  }
}