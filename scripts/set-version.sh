#!/usr/bin/env bash
#
# Keep every versioned file in lockstep with the release tag, in one command.
#
# JUGALE's app version lives in places that don't read from each other:
#   - package.json            -> baked into the web bundle / welcome footer (__APP_VERSION__)
#   - src-tauri/tauri.conf.json -> version stamped into the installed desktop/Android app
#   - src-tauri/Cargo.toml      -> the Rust crate version (metadata)
#   - src-tauri/Cargo.lock      -> must match Cargo.toml, or CI's `cargo check --locked` fails
# Tag time must bump all of them to the same SemVer. This script does that; the alternative is
# remembering each file by hand (see docs/AUTOMATION.md, "Cutting a release").
#
# Usage: scripts/set-version.sh 1.4.0   (no leading "v")
set -euo pipefail

ver="${1:?usage: scripts/set-version.sh <x.y.z>  (no leading v)}"
ver="${ver#v}" # tolerate a leading v
[[ "$ver" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-].+)?$ ]] || { echo "error: '$ver' is not a SemVer version"; exit 1; }

root="$(cd "$(dirname "$0")/.." && pwd)"

# JSON: replace only the first (top-level) "version" value, leaving formatting untouched.
perl -0777 -i -pe 's/("version"\s*:\s*")[^"]*(")/${1}'"$ver"'${2}/' "$root/package.json"
perl -0777 -i -pe 's/("version"\s*:\s*")[^"]*(")/${1}'"$ver"'${2}/' "$root/src-tauri/tauri.conf.json"

# Cargo.toml: the standalone `version = "..."` under [package] starts at column 0,
# unlike the `{ version = "..." }` entries under [dependencies], so an anchored match is safe.
perl -0777 -i -pe 's/(^version = ")[^"]*(")/${1}'"$ver"'${2}/m' "$root/src-tauri/Cargo.toml"

# Cargo.lock: bump the jugale package entry to match, so `cargo check --locked` stays happy.
perl -0777 -i -pe 's/(name = "jugale"\nversion = ")[^"]*(")/${1}'"$ver"'${2}/' "$root/src-tauri/Cargo.lock"

echo "Set version to $ver in:"
echo "  package.json              -> $(perl -0777 -ne 'print $1 if /"version"\s*:\s*"([^"]*)"/' "$root/package.json")"
echo "  src-tauri/tauri.conf.json -> $(perl -0777 -ne 'print $1 if /"version"\s*:\s*"([^"]*)"/' "$root/src-tauri/tauri.conf.json")"
echo "  src-tauri/Cargo.toml      -> $(perl -0777 -ne 'print $1 if /^version = "([^"]*)"/m' "$root/src-tauri/Cargo.toml")"
echo "  src-tauri/Cargo.lock      -> $(perl -0777 -ne 'print $1 if /name = "jugale"\nversion = "([^"]*)"/' "$root/src-tauri/Cargo.lock")"
echo "Next: commit, push tag v$ver (see docs/AUTOMATION.md → Cutting a release)."
