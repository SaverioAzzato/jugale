import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const packageVersion = JSON.parse(read("package.json")).version;
const packageLockVersion = JSON.parse(read("package-lock.json")).version;
const tauriVersion = JSON.parse(read("src-tauri/tauri.conf.json")).version;

const cargoToml = read("src-tauri/Cargo.toml");
const cargoTomlVersion = cargoToml.match(
  /^\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m,
)?.[1];

const cargoLock = read("src-tauri/Cargo.lock");
const cargoLockVersion = cargoLock.match(
  /^name = "jugale"\nversion = "([^"]+)"/m,
)?.[1];

const versions = {
  "package.json": packageVersion,
  "package-lock.json": packageLockVersion,
  "src-tauri/tauri.conf.json": tauriVersion,
  "src-tauri/Cargo.toml": cargoTomlVersion,
  "src-tauri/Cargo.lock": cargoLockVersion,
};

const missing = Object.entries(versions).filter(([, version]) => !version);
if (missing.length > 0) {
  console.error(`Could not read the app version from: ${missing.map(([path]) => path).join(", ")}`);
  process.exit(1);
}

const mismatches = Object.entries(versions).filter(([, version]) => version !== packageVersion);
if (mismatches.length > 0) {
  console.error(`App versions must all match package.json (${packageVersion}):`);
  for (const [path, version] of mismatches) console.error(`- ${path}: ${version}`);
  console.error("Run scripts/set-version.sh <version> to update them together.");
  process.exit(1);
}

console.log(`App versions match: ${packageVersion}`);
