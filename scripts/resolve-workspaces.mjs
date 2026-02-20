#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGES_DIR = "packages";

function getWorkspaceVersions() {
  const versions = new Map();
  for (const dir of readdirSync(PACKAGES_DIR)) {
    const pkgPath = join(PACKAGES_DIR, dir, "package.json");
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (pkg.name) versions.set(pkg.name, pkg.version);
  }
  return versions;
}

function resolveWorkspaceRefs(deps, versions) {
  if (!deps) return false;
  let changed = false;
  for (const [name, version] of Object.entries(deps)) {
    if (typeof version === "string" && version.startsWith("workspace:")) {
      const resolved = versions.get(name);
      if (!resolved) {
        console.error(
          `  ❌ Cannot resolve ${name}@${version} - package not found`,
        );
        process.exit(1);
      }
      deps[name] = resolved;
      console.log(`  ${name}: ${version} → ${resolved}`);
      changed = true;
    }
  }
  return changed;
}

const versions = getWorkspaceVersions();
console.log("📦 Workspace versions:");
for (const [name, version] of versions) {
  console.log(`  ${name}@${version}`);
}

console.log("\n🔗 Resolving workspace:* references:");
let totalResolved = 0;

for (const dir of readdirSync(PACKAGES_DIR)) {
  const pkgPath = join(PACKAGES_DIR, dir, "package.json");
  if (!existsSync(pkgPath)) continue;

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  let changed = false;

  console.log(`\n${pkg.name}:`);
  changed = resolveWorkspaceRefs(pkg.dependencies, versions) || changed;
  changed = resolveWorkspaceRefs(pkg.peerDependencies, versions) || changed;

  if (changed) {
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
    totalResolved++;
  } else {
    console.log("  (no workspace refs)");
  }
}

console.log(`\n✅ Resolved workspace refs in ${totalResolved} packages`);
