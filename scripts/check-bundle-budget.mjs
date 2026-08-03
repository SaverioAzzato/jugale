import { readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { resolve } from "node:path";

const MAX_ENTRY_BYTES = 500 * 1024;
const MAX_ENTRY_GZIP_BYTES = 150 * 1024;
const distDir = resolve("dist");
const html = await readFile(resolve(distDir, "index.html"), "utf8");
const match = html.match(/<script[^>]+type="module"[^>]+src="\.\/(assets\/[^\"]+\.js)"/);

if (!match) throw new Error("Unable to locate the production entry script in dist/index.html");

const entryPath = resolve(distDir, match[1]);
const { size } = await stat(entryPath);
const gzipSize = gzipSync(await readFile(entryPath)).byteLength;
const format = (bytes) => `${(bytes / 1024).toFixed(2)} KiB`;

console.log(
  `Initial bundle ${match[1]}: ${format(size)} minified, ${format(gzipSize)} gzip ` +
  `(budgets ${format(MAX_ENTRY_BYTES)} / ${format(MAX_ENTRY_GZIP_BYTES)})`,
);

if (size > MAX_ENTRY_BYTES || gzipSize > MAX_ENTRY_GZIP_BYTES) {
  throw new Error("Initial JavaScript bundle exceeds its minified or gzip budget");
}
