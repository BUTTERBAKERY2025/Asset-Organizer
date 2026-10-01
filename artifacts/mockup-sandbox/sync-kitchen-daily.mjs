import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// Exact-source extraction only. Reads the app; writes exclusively this new group.
// Safe to rerun after the concurrent page implementation. Never starts a server.
const sandbox = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(sandbox, "../..");
const group = path.join(sandbox, "src/components/mockups/kitchen-daily-source");
rmSync(path.join(group, "_source"), { recursive: true, force: true });
const copied = new Map();
const stubs = {
  "@tanstack/react-query": "_stubs/query.ts",
  wouter: "_stubs/router.tsx",
  "react-i18next": "_stubs/data.ts",
  "react-to-print": "_stubs/actions.ts",
  "@/hooks/useAuth": "_stubs/data.ts",
  "@/hooks/useBranches": "_stubs/data.ts",
  "@/hooks/usePermissions": "_stubs/data.ts",
  "@/components/layout": "_stubs/layout.tsx",
  "@/hooks/use-toast": "_stubs/actions.ts",
  "@/lib/queryClient": "_stubs/actions.ts",
  "@/lib/push-notifications": "_stubs/actions.ts",
  "@/lib/print-window": "_stubs/actions.ts",
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
    source: path.relative(root, source), preview: path.relative(root, destination),
    sha256: createHash("sha256").update(original).digest("hex"),
  });
  mkdirSync(path.dirname(destination), { recursive: true });
  if (!/\.(tsx?|css)$/.test(source)) {
    copyFileSync(source, destination);
    return destination;
  }
  let usedSource = original.toString("utf8");
  // Lazy delivery presentation only needs this exact function, not app auth guards.
  if (source.endsWith("/components/protected-route.tsx")) {
    const start = usedSource.indexOf("export function AccessDeniedPage(");
    const end = usedSource.indexOf("\n}", start);
    if (start < 0 || end < 0) throw new Error("Cannot find exact AccessDeniedPage");
    const imports = usedSource.split("\n").filter(line =>
      /^import /.test(line) && /(?:lucide-react|components\/ui\/(?:button|card)|lib\/push-notifications)/.test(line));
    usedSource = imports.join("\n") + "\n\n" + usedSource.slice(start, end + 2) + "\n";
  }
  let text = usedSource.replace(
    /((?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'])([^"']+)(["'])/g,
    (match, before, specifier, after) => {
      let dependency;
      if (specifier.startsWith("@/")) dependency = path.join(root, "client/src", specifier.slice(2));
      else if (specifier.startsWith("@assets/")) dependency = path.join(root, "attached_assets", specifier.slice(8));
      else if (specifier.startsWith("@shared/")) dependency = path.join(root, "shared", specifier.slice(8));
      else if (specifier.startsWith(".")) dependency = path.resolve(path.dirname(source), specifier);
      const sourceAlias = dependency?.startsWith(path.join(root, "client/src") + path.sep)
        ? "@/" + path.relative(path.join(root, "client/src"), dependency).replaceAll(path.sep, "/").replace(/\.tsx?$/, "")
        : null;
      const stub = stubs[specifier] || stubs[sourceAlias];
      if (stub) return before + relative(destination, path.join(group, stub)) + after;
      if (!dependency) return match;
      return before + relative(destination, extract(dependency)) + after;
    },
  );
  // Copy authentic public images/fonts byte-for-byte; never use main-app URLs.
  text = text.replace(/(["'])\/(assets\/[^"']+|company-logo\.png|butter-logo\.png)\1/g, (_match, _quote, asset) => {
    const publicAsset = path.join(root, "public", asset);
    const target = extract(existsSync(publicAsset) ? publicAsset : path.join(root, "client/public", asset));
    return `new URL("${relative(destination, target)}", import.meta.url).href`;
  });
  const effects = [];
  if (/\bfetch\s*\(/.test(usedSource)) effects.push("sandboxFetch as fetch");
  if (/\bwindow\b/.test(usedSource)) effects.push("previewWindow as window");
  if (/\bnavigator\b/.test(usedSource)) effects.push("previewNavigator as navigator");
  if (/\bNotification\b/.test(usedSource)) effects.push("previewNotification as Notification");
  if (/\blocalStorage\b/.test(usedSource)) effects.push("previewStorage as localStorage");
  if (/\bsessionStorage\b/.test(usedSource)) effects.push("previewStorage as sessionStorage");
  if (effects.length) text = `import { ${effects.join(", ")} } from "${relative(destination, path.join(group, "_stubs/effects.ts"))}";\n` + text;
  save(destination, text);
  return destination;
}

// Reuse the existing extraction's isolated chrome/link boundary verbatim.
for (const name of ["layout.tsx", "router.tsx"]) {
  const target = path.join(group, "_stubs", name);
  if (!existsSync(target)) {
    let source = readFileSync(path.join(sandbox, "src/components/mockups/transfer-requests-source/_stubs", name), "utf8");
    if (name === "router.tsx") source = source.replace('["/transfer-requests", navigate]', '["/central-kitchen-orders", navigate]');
    save(target, source);
  }
}
const page = extract(path.join(root, "client/src/pages/central-kitchen-orders.tsx"));
extract(path.join(root, "client/src/lib/pdfmake-rtl.d.ts"));
const cssSource = readFileSync(path.join(root, "client/src/index.css"), "utf8");
const themeMatch = cssSource.match(/@theme inline\s*\{([\s\S]*?)\n\}/);
if (!themeMatch) throw new Error("Cannot find actual app theme; no guessed fallback");
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
globalCss = globalCss.replace(/(\.dark\s*\{)([\s\S]*?)(\n\})/, (_, open, contents, close) => {
  const extra = [...contents.matchAll(/--color-([\w-]+):\s*hsl\(([^)]+)\)/g)]
    .map(([, name, value]) => `  --${name}: ${value};`).join("\n");
  return open + contents + "\n" + extra + close;
});
globalCss = globalCss.replace(/url\(["']?(\.\/[^"')]+)["']?\)/g, (_match, asset) => {
  const target = extract(resolveFile(path.join(root, "client/src", asset)));
  return `url("${relative(path.join(group, "_group.css"), target)}")`;
});
save(path.join(group, "_group.css"), `${fonts}\n@reference "../../../index.css";\n/* Actual app globals; @theme adapted to equivalent runtime HSL tokens. */\n${globalCss}`);
save(path.join(group, "_source-manifest.json"), JSON.stringify({
  syntheticDataOnly: true,
  scope: "Exact central-kitchen-orders and all presentation dependencies, including lazy workspaces. Platform Layout isolated.",
  adaptation: "Import rewrites; local fetch/window/navigator/notification/storage effect boundaries; byte-identical public assets. Exact AccessDeniedPage retained without unrelated guards. Global @theme adapted to HSL runtime tokens. No page markup/layout edits.",
  fixtures: "Default synthetic medina branch-manager with kitchen create/edit, no approval or warehouse-admin access. ?role=operations selects synthetic operations-manager with kitchen approval/preparation/dispatch authority and operations presentation. Nonempty requested/approved/prepared/dispatched/received orders; local filtering and policy. All mutations remain inert.",
  route: "/central-kitchen-orders?from=branch-supply&branchId=medina",
  operationsRoute: "/central-kitchen-orders?role=operations&from=branch-supply&branchId=medina",
  page: path.relative(root, page),
  globals: { css: createHash("sha256").update(cssSource).digest("hex"), html: createHash("sha256").update(html).digest("hex") },
  files: [...copied.values()],
}, null, 2) + "\n");
console.log(`Copied ${copied.size} exact source dependencies into ${path.relative(root, group)}`);
console.log("Only sandbox files changed. No app data, workflows, authentication, notifications, or backend touched.");