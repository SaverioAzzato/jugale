import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
const characterSource = await readFile(resolve(root, "src/schema/character.ts"), "utf8");
const versionMatch = characterSource.match(/export const SCHEMA_VERSION = "([^"]+)"/);
if (!versionMatch) throw new Error("Unable to read SCHEMA_VERSION from src/schema/character.ts");
const schemaVersion = versionMatch[1];

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await markdownFiles(path));
    else if (extname(entry.name) === ".md") files.push(path);
  }
  return files;
}

const docs = [
  resolve(root, "AGENTS.md"),
  resolve(root, "CLAUDE.md"),
  resolve(root, "README.md"),
  resolve(root, "CONTRIBUTING.md"),
  ...await markdownFiles(resolve(root, "docs")),
];
const contents = new Map(await Promise.all(docs.map(async (file) => [file, await readFile(file, "utf8")])));
const failures = [];

for (const [file, text] of contents) {
  for (const match of text.matchAll(/!?(?:\[[^\]]*\])\(([^)]+)\)/g)) {
    let target = match[1].trim().replace(/^<|>$/g, "");
    if (!target || /^(?:https?:|mailto:|#)/.test(target)) continue;
    target = target.split("#", 1)[0];
    if (!target) continue;
    try {
      await access(resolve(dirname(file), decodeURIComponent(target)));
    } catch {
      failures.push(`${file.slice(root.length + 1)}: missing local link target ${target}`);
    }
  }

  for (const match of text.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)) {
    if (!(match[1] in packageJson.scripts)) {
      failures.push(`${file.slice(root.length + 1)}: documents missing npm script ${match[1]}`);
    }
  }
}

const requiredEngineeringLinks = [
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "CONTRIBUTING.md",
  "docs/ARCHITECTURE.md",
  "docs/SCHEMA.md",
  "docs/AUTOMATION.md",
  "docs/ROADMAP.md",
];
for (const path of requiredEngineeringLinks) {
  if (!contents.get(resolve(root, path))?.includes("ENGINEERING.md")) {
    failures.push(`${path}: must link to docs/ENGINEERING.md`);
  }
}

const schemaMarkers = [
  ["AGENTS.md", `contract (**v${schemaVersion}**)`],
  ["AGENTS.md", `Character JSON contract (v${schemaVersion})`],
  ["README.md", `Zod contract (v${schemaVersion.replace(/\.0$/, "")})`],
  ["docs/SCHEMA.md", `character.json\` v${schemaVersion}`],
];
for (const [path, marker] of schemaMarkers) {
  if (!contents.get(resolve(root, path))?.includes(marker)) {
    failures.push(`${path}: expected current schema marker ${marker}`);
  }
}

for (const path of [
  ".github/agents/dnd-5e-character-expert.agent.md",
  ".github/agents/dnd-5e-warlock-tome-draconide.agent.md",
]) {
  const text = await readFile(resolve(root, path), "utf8");
  if (!text.includes(`schema **v${schemaVersion}**`)) failures.push(`${path}: stale schema version`);
  if (text.includes("meta.portrait")) failures.push(`${path}: images must not be referenced from character.json`);
}

for (const script of ["lint", "typecheck", "test:coverage", "test:e2e", "build", "check:bundle", "check:docs", "check", "check:ci", "check:release"]) {
  if (!(script in packageJson.scripts)) failures.push(`package.json: missing required script ${script}`);
}
if (!packageJson.scripts.lint.includes("--max-warnings=0")) failures.push("package.json: lint warnings must be blocking");
if (!packageJson.scripts.build.includes("check:bundle")) failures.push("package.json: build must enforce the bundle budget");
if (!packageJson.scripts.check.includes("check:docs")) failures.push("package.json: check must enforce documentation drift checks");

const ci = await readFile(resolve(root, ".github/workflows/ci.yml"), "utf8");
if (!ci.includes("npm run check:ci")) failures.push("ci.yml: project gate must run check:ci");

const androidCi = await readFile(resolve(root, ".github/workflows/android-check.yml"), "utf8");
if (!androidCi.includes("testDebugUnitTest")) {
  failures.push("android-check.yml: native gate must run the Kotlin JVM unit tests");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Documentation checks passed (${docs.length} Markdown files, schema ${schemaVersion}).`);
}
