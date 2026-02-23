import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSIONS = [".js", ".css", ".html"];
const DIST_DIR = path.resolve(__dirname, "../dist/public/assets");

function walkDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (EXTENSIONS.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = walkDir(DIST_DIR);
let count = 0;

for (const file of files) {
  const content = fs.readFileSync(file);

  const brPath = file + ".br";
  if (!fs.existsSync(brPath)) {
    const br = zlib.brotliCompressSync(content, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 },
    });
    fs.writeFileSync(brPath, br);
    count++;
  }

  const gzPath = file + ".gz";
  if (!fs.existsSync(gzPath)) {
    const gz = zlib.gzipSync(content, { level: 9 });
    fs.writeFileSync(gzPath, gz);
    count++;
  }
}

console.log(`Precompressed ${count} files from ${files.length} source files`);
