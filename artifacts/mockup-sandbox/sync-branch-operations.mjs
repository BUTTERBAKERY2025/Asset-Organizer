import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// Source extraction only: reads the app and writes ONLY this sandbox group.
// Run again after the implementation agent finishes; it never starts a server.
const sandbox = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(sandbox, "../..");
const group = path.join(sandbox, "src/components/mockups/branch-operations-source");
const copied = new Map();
const stubs = {
  "@tanstack/react-query": "_stubs/query.ts",
  wouter: "_stubs/router.tsx",
  "@/hooks/useAuth": "_stubs/data.ts",
  "@/hooks/useBranches": "_stubs/data.ts",
  "@/components/layout": "_stubs/layout.tsx",
  "@/hooks/use-toast": "_stubs/actions.ts",
  "@/lib/app-badge": "_stubs/actions.ts",
  "@/lib/push-notifications": "_stubs/actions.ts",
  "@/lib/branch-operation-return-state": "_stubs/return-state.ts",
};

function save(target, text) {
  if (!target.startsWith(group + path.sep)) throw new Error("Sandbox write boundary violated");
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, text);
}
function relative(from, to) {
  const result = path.relative(path.dirname(from), to).replaceAll(path.sep, "/");
  return result.startsWith(".") ? result : "./" + result;
}
function resolveFile(base) {
  for (const candidate of [base, base + ".tsx", base + ".ts", base + ".css", path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("Missing exact source dependency: " + base);
}
function extract(source) {
  source = resolveFile(source);
  const destination = path.join(group, "_source", path.relative(root, source));
  if (copied.has(source)) return destination;
  const original = readFileSync(source);
  copied.set(source, {
    source: path.relative(root, source),
    preview: path.relative(root, destination),
    sha256: createHash("sha256").update(original).digest("hex"),
  });
  mkdirSync(path.dirname(destination), { recursive: true });
  if (!/\.(tsx?|css)$/.test(source)) {
    copyFileSync(source, destination);
    return destination;
  }
  // The page imports MobilePushSettings only. Keep that exact component and
  // omit the unrelated app-wide PushNotificationPrompt export/side effects.
  const usedSource = source.endsWith("/components/push-notification-prompt.tsx")
    ? original.toString("utf8").split("\nexport function PushNotificationPrompt()")[0]
    : original.toString("utf8");
  const text = usedSource.replace(
    /((?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'])([^"']+)(["'])/g,
    (match, before, specifier, after) => {
      if (stubs[specifier]) return before + relative(destination, path.join(group, stubs[specifier])) + after;
      let dependency;
      if (specifier.startsWith("@/")) dependency = path.join(root, "client/src", specifier.slice(2));
      else if (specifier.startsWith("@assets/")) dependency = path.join(root, "attached_assets", specifier.slice(8));
      else if (specifier.startsWith("@shared/")) dependency = path.join(root, "shared", specifier.slice(8));
      else if (specifier.startsWith(".")) dependency = path.resolve(path.dirname(source), specifier);
      else return match;
      return before + relative(destination, extract(dependency)) + after;
    },
  );
  save(destination, text);
  return destination;
}

const page = extract(path.join(root, "client/src/pages/branch-operations.tsx"));
// Capture globals too: these do not appear in the page's import graph.
const cssSource = readFileSync(path.join(root, "client/src/index.css"), "utf8");
const themeMatch = cssSource.match(/@theme inline\s*\{([\s\S]*?)\n\}/);
if (!themeMatch) throw new Error("Cannot find app theme; no guessed styling fallback");
const theme = themeMatch[1];
const hslTokens = [...theme.matchAll(/--color-([\w-]+):\s*hsl\(([^)]+)\)/g)]
  .map(([, name, value]) => `  --${name}: ${value};`).join("\n");
const html = readFileSync(path.join(root, "client/index.html"), "utf8");
const fonts = [...html.matchAll(/<link\b[^>]*href="([^"]*fonts\.googleapis\.com[^"]*)"[^>]*>/g)]
  .map(([, url]) => `@import url("${url}");`).join("\n");
let globalCss = cssSource
  .replace(/^@import\s+["'](?:tailwindcss|tw-animate-css)["'];?\s*$/gm, "")
  .replace(/@custom-variant dark[^;]*;/g, "")
  .replace(themeMatch[0], `:root {\n${theme}\n${hslTokens}\n}`);
// Adapt dark tokens to the sandbox's equivalent HSL semantic utility mapping.
globalCss = globalCss.replace(/(\.dark\s*\{)([\s\S]*?)(\n\})/, (_, open, contents, close) => {
  const extra = [...contents.matchAll(/--color-([\w-]+):\s*hsl\(([^)]+)\)/g)]
    .map(([, name, value]) => `  --${name}: ${value};`).join("\n");
  return open + contents + "\n" + extra + close;
});
globalCss = globalCss.replace(/url\(["']?(\.\/[^"')]+)["']?\)/g, (match, asset) => {
  const source = resolveFile(path.join(root, "client/src", asset));
  const target = extract(source);
  return `url("${relative(path.join(group, "_group.css"), target)}")`;
});
save(path.join(group, "_group.css"), `${fonts}\n@reference "../../../index.css";\n/* Exact app globals, with Tailwind theme declarations adapted to runtime tokens. */\n${globalCss}`);
save(path.join(group, "_source-manifest.json"), JSON.stringify({
  syntheticDataOnly: true,
  scope: "Exact branch page; platform-wide Layout is an explicitly isolated context boundary.",
  adaptation: "Imports only for page/presentation/daily-workspace/UI. Unused global PushNotificationPrompt export omitted; MobilePushSettings preserved. Global @theme converted to equivalent HSL runtime tokens; no layout rule edits.",
  page: path.relative(root, page),
  files: [...copied.values()],
}, null, 2) + "\n");
console.log(`Copied ${copied.size} exact source dependencies into ${path.relative(root, group)}`);
console.log("No app source, production data, workflow, authentication, notifications, or backend touched.");