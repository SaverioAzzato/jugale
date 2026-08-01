import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageLockPath = join(root, "package-lock.json");
const cargoLockPath = join(root, "src-tauri", "Cargo.lock");
const noticesPath = join(root, "public", "THIRD_PARTY_NOTICES.txt");
const sbomPath = join(root, "public", "third-party-sbom.spdx.json");
const checkOnly = process.argv.includes("--check");

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const readNormalized = (path) => readFileSync(path, "utf8").replace(/\r\n?/g, "\n");
const lockFingerprint = sha256(
  [
    "package-lock.json\0",
    readNormalized(packageLockPath),
    "\0src-tauri/Cargo.lock\0",
    readNormalized(cargoLockPath),
  ].join(""),
);

function creationTimestamp() {
  if (existsSync(sbomPath)) {
    try {
      const existing = JSON.parse(readFileSync(sbomPath, "utf8"));
      if (existing.documentNamespace?.endsWith(`/sha256-${lockFingerprint}`) && existing.creationInfo?.created) {
        return existing.creationInfo.created;
      }
    } catch {
      // A malformed prior artifact will be replaced below.
    }
  }
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function npmPurl(name, version) {
  const encodedName = name.startsWith("@")
    ? `%40${name.slice(1).split("/").map(encodeURIComponent).join("/")}`
    : encodeURIComponent(name);
  return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
}

function cargoPurl(name, version) {
  return `pkg:cargo/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

function normalizeLicense(expression) {
  if (!expression) return "NOASSERTION";
  return expression
    .trim()
    .replace(/\s*\/\s*/g, " OR ")
    .replace(/\s+/g, " ");
}

function sourceUrl(repository, fallback) {
  const raw = typeof repository === "string" ? repository : repository?.url;
  return raw
    ? raw.replace(/^git\+/, "").replace(/^git:\/\//, "https://").replace(/\.git$/, "")
    : fallback;
}

function noticeFiles(packageRoot) {
  const names = readdirSync(packageRoot)
    .filter((name) => /^(licen[cs]e|copying|notice)([._-]|$)/i.test(name))
    .sort((a, b) => a.localeCompare(b));
  return names.flatMap((name) => {
    const path = join(packageRoot, name);
    if (!statSync(path).isFile()) return [];
    return [{ name, text: readFileSync(path, "utf8").replace(/\r\n/g, "\n").trimEnd() }];
  });
}

function npmComponents() {
  const lock = JSON.parse(readFileSync(packageLockPath, "utf8"));
  const components = [];
  for (const [lockPath, locked] of Object.entries(lock.packages)) {
    if (!lockPath.startsWith("node_modules/") || locked.dev || locked.extraneous) continue;
    const packageRoot = join(root, lockPath);
    const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
    const name = manifest.name ?? lockPath.slice("node_modules/".length);
    const version = locked.version ?? manifest.version;
    components.push({
      ecosystem: "npm",
      name,
      version,
      purl: npmPurl(name, version),
      license: normalizeLicense(manifest.license ?? locked.license),
      source: sourceUrl(manifest.repository, `https://www.npmjs.com/package/${name}/v/${version}`),
      download: locked.resolved ?? "NOASSERTION",
      authors: typeof manifest.author === "string" ? [manifest.author] : [],
      notices: noticeFiles(packageRoot),
    });
  }
  return components;
}

function cargoComponents() {
  const metadata = JSON.parse(
    execFileSync(
      "cargo",
      ["metadata", "--locked", "--format-version", "1", "--manifest-path", "src-tauri/Cargo.toml"],
      { cwd: root, encoding: "utf8", maxBuffer: 100 * 1024 * 1024 },
    ),
  );
  return metadata.packages
    .filter((pkg) => pkg.source)
    .map((pkg) => {
      const packageRoot = dirname(pkg.manifest_path);
      return {
        ecosystem: "cargo",
        name: pkg.name,
        version: pkg.version,
        purl: cargoPurl(pkg.name, pkg.version),
        license: normalizeLicense(pkg.license),
        source: sourceUrl(pkg.repository, `https://crates.io/crates/${pkg.name}/${pkg.version}`),
        download: `https://crates.io/api/v1/crates/${encodeURIComponent(pkg.name)}/${encodeURIComponent(pkg.version)}/download`,
        authors: pkg.authors ?? [],
        notices: noticeFiles(packageRoot),
      };
    });
}

function expectedPurlsFromLocks() {
  const packageLock = JSON.parse(readFileSync(packageLockPath, "utf8"));
  const purls = [];
  for (const [lockPath, locked] of Object.entries(packageLock.packages)) {
    if (!lockPath.startsWith("node_modules/") || locked.dev || locked.extraneous) continue;
    const manifestPath = join(root, lockPath, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    purls.push(npmPurl(manifest.name ?? lockPath.slice("node_modules/".length), locked.version ?? manifest.version));
  }

  // Git may check text files out with CRLF on Windows. Parse normalized text so
  // the same committed lockfiles always produce the same inventory and hash.
  const cargoLock = readNormalized(cargoLockPath);
  for (const match of cargoLock.matchAll(/\[\[package\]\]\n([\s\S]*?)(?=\n\[\[package\]\]|$)/g)) {
    const block = match[1];
    if (!/^source\s*=\s*"/m.test(block)) continue;
    const name = block.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
    const version = block.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
    if (name && version) purls.push(cargoPurl(name, version));
  }
  return purls.sort();
}

function fail(message) {
  console.error(`Legal-artifact check failed: ${message}`);
  process.exitCode = 1;
}

function checkArtifacts() {
  if (!existsSync(noticesPath) || !existsSync(sbomPath)) {
    fail("generated notice or SBOM is missing; run `npm run legal:generate`.");
    return;
  }
  const notices = readFileSync(noticesPath, "utf8");
  const sbom = JSON.parse(readFileSync(sbomPath, "utf8"));
  if (!notices.includes(`Dependency fingerprint: sha256:${lockFingerprint}`)) {
    fail("THIRD_PARTY_NOTICES.txt does not match the current lockfiles; run `npm run legal:generate`.");
  }
  if (!sbom.documentNamespace?.endsWith(`/sha256-${lockFingerprint}`)) {
    fail("the SPDX SBOM does not match the current lockfiles; run `npm run legal:generate`.");
  }
  const actualPurls = (sbom.packages ?? [])
    .flatMap((pkg) => pkg.externalRefs ?? [])
    .filter((ref) => ref.referenceType === "purl")
    .map((ref) => ref.referenceLocator)
    .sort();
  const expectedPurls = expectedPurlsFromLocks();
  if (JSON.stringify(actualPurls) !== JSON.stringify(expectedPurls)) {
    fail("the SPDX component list does not match package-lock.json and Cargo.lock; run `npm run legal:generate`.");
  }
  const noticePurls = [...notices.matchAll(/^Package: (pkg:\S+)$/gm)].map((match) => match[1]).sort();
  if (JSON.stringify(noticePurls) !== JSON.stringify(expectedPurls)) {
    fail("the readable notice component list does not match package-lock.json and Cargo.lock; run `npm run legal:generate`.");
  }
  if (!process.exitCode) {
    console.log(`Legal artifacts are current (${expectedPurls.length} third-party components).`);
  }
}

function renderNotices(components) {
  const textGroups = new Map();
  for (const component of components) {
    for (const notice of component.notices) {
      const hash = sha256(notice.text);
      const existing = textGroups.get(hash) ?? { text: notice.text, uses: [] };
      existing.uses.push(`${component.purl} (${notice.name})`);
      textGroups.set(hash, existing);
    }
  }

  const lines = [
    "JUGALE THIRD-PARTY NOTICES",
    "==========================",
    "",
    "This generated file inventories the JavaScript and Rust dependencies used to build and distribute JUGALE.",
    "Those components remain under their own licences; they are not relicensed under JUGALE's MIT licence.",
    "An OR in a licence expression means the upstream component offers alternative licence choices.",
    "Source links are included for auditability and for source-availability obligations such as MPL-2.0.",
    "Preserved texts below are copied verbatim from dependency packages and deduplicated by SHA-256.",
    "A component without a packaged text is still listed with its declared SPDX expression and source.",
    "",
    "Generated from: package-lock.json and src-tauri/Cargo.lock",
    `Dependency fingerprint: sha256:${lockFingerprint}`,
    `Components: ${components.length} (${components.filter((c) => c.ecosystem === "npm").length} npm, ${components.filter((c) => c.ecosystem === "cargo").length} Cargo)`,
    "",
    "COMPONENT INVENTORY",
    "===================",
    "",
  ];

  for (const component of components) {
    lines.push(`[${component.ecosystem}] ${component.name} ${component.version}`);
    lines.push(`Package: ${component.purl}`);
    lines.push(`Declared licence: ${component.license}`);
    lines.push(`Source: ${component.source}`);
    lines.push(`Exact source archive: ${component.download}`);
    if (component.license.includes("MPL-2.0")) {
      lines.push("MPL-2.0 notice: source is available from the exact archive above under https://www.mozilla.org/MPL/2.0/");
    }
    if (component.authors.length) lines.push(`Authors: ${component.authors.join("; ")}`);
    lines.push(
      component.notices.length
        ? `Preserved files: ${component.notices.map((notice) => notice.name).join(", ")}`
        : "Preserved files: none packaged with this component",
    );
    lines.push("");
  }

  lines.push("PRESERVED LICENCE AND NOTICE TEXTS", "==================================", "");
  for (const [hash, group] of [...textGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`Text SHA-256: ${hash}`, "Applies to:");
    for (const use of group.uses.sort()) lines.push(`- ${use}`);
    lines.push("", group.text, "", "--------------------------------------------------------------------------------", "");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function renderSbom(components) {
  const packages = components.map((component) => {
    const id = `SPDXRef-Package-${sha256(component.purl).slice(0, 24)}`;
    return {
      name: component.name,
      SPDXID: id,
      versionInfo: component.version,
      downloadLocation: component.download,
      filesAnalyzed: false,
      licenseConcluded: component.license,
      licenseDeclared: component.license,
      copyrightText: "NOASSERTION",
      homepage: component.source,
      externalRefs: [
        {
          referenceCategory: "PACKAGE-MANAGER",
          referenceType: "purl",
          referenceLocator: component.purl,
        },
      ],
    };
  });
  return {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: "JUGALE third-party dependency SBOM",
    documentNamespace: `https://github.com/SaverioAzzato/jugale/sbom/sha256-${lockFingerprint}`,
    creationInfo: {
      created: creationTimestamp(),
      creators: ["Tool: JUGALE scripts/generate-legal-artifacts.mjs"],
    },
    documentDescribes: packages.map((pkg) => pkg.SPDXID),
    packages,
    relationships: packages.map((pkg) => ({
      spdxElementId: "SPDXRef-DOCUMENT",
      relationshipType: "DESCRIBES",
      relatedSpdxElement: pkg.SPDXID,
    })),
    comment: `Generated from package-lock.json and src-tauri/Cargo.lock. Lock fingerprint: sha256:${lockFingerprint}`,
  };
}

if (checkOnly) {
  checkArtifacts();
} else {
  const components = [...npmComponents(), ...cargoComponents()].sort(
    (a, b) => a.ecosystem.localeCompare(b.ecosystem) || a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
  );
  writeFileSync(noticesPath, renderNotices(components));
  writeFileSync(sbomPath, `${JSON.stringify(renderSbom(components), null, 2)}\n`);
  console.log(
    `Generated ${relative(root, noticesPath)} and ${relative(root, sbomPath)} for ${components.length} third-party components.`,
  );
}
