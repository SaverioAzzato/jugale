import { spawnSync } from "node:child_process";

// GitHub Actions does not need local hooks. Developers get the repository-owned hooks
// automatically after npm install/npm ci, without adding a runtime dependency such as Husky.
if (!process.env.CI) {
  const result = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    console.warn("Could not enable repository Git hooks.");
    if (result.stderr) console.warn(result.stderr.trim());
  } else {
    console.log("Repository Git hooks enabled.");
  }
}
