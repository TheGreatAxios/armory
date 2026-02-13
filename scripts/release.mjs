#!/usr/bin/env bun
/**
 * Safe release script - handles all steps to publish packages.
 * Run: bun run release
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const packagesDir = new URL("../packages", import.meta.url).pathname;
const changesetsDir = new URL("../.changeset", import.meta.url).pathname;

// ANSI colors
const red = "\x1b[31m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const blue = "\x1b[34m";
const reset = "\x1b[0m";

function log(msg, color = blue) {
  console.log(`${color}${msg}${reset}`);
}

function error(msg) {
  log(`❌ ${msg}`, red);
  process.exit(1);
}

function success(msg) {
  log(`✓ ${msg}`, green);
}

function warn(msg) {
  log(`⚠ ${msg}`, yellow);
}

function run(cmd, { silent = false } = {}) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: silent ? "pipe" : "inherit" });
  } catch (err) {
    if (!silent) error(`Command failed: ${cmd}`);
    throw err;
  }
}

// Step 1: Pre-flight checks
log("\n📋 Pre-flight checks...", blue);

// Check if on main branch
const branch = run("git rev-parse --abbrev-ref HEAD", { silent: true }).trim();
if (branch !== "main") {
  error(`Not on main branch (current: ${branch})`);
}
success("On main branch");

// Check for uncommitted changes
const status = run("git status --porcelain", { silent: true }).trim();
if (status) {
  error(`Uncommitted changes detected:\n${status}`);
}
success("No uncommitted changes");

// Step 2: Create changeset (interactive)
log("\n📝 Creating changeset...", blue);
run("bun run changeset");
success("Changeset created");

// Step 3: Run tests
log("\n🧪 Running tests...", blue);
run("bun test");
success("Tests passed");

// Step 4: Version bump
log("\n📦 Bumping versions...", blue);
run("changeset version && bun update");
success("Versions bumped");

// Check what changed
const changed = run("git status --porcelain", { silent: true }).trim();
if (changed) {
  log("\n📝 Changes to commit:", blue);
  run("git status --short");

  run("git add .changeset package.json bun.lock packages/*/package.json packages/*/CHANGELOG.md 2>/dev/null || git add .changeset package.json bun.lock packages/*/package.json");
  run('git commit -m "chore: release"');
  success("Version changes committed");
}

// Step 5: Build
log("\n🔨 Building packages...", blue);
run("turbo run build");
success("Build complete");

// Step 6: Publish
log("\n📤 Publishing packages...", blue);

const dirs = readdirSync(packagesDir).filter((d) => {
  const pkgJson = join(packagesDir, d, "package.json");
  if (!existsSync(pkgJson)) return false;
  const pkg = JSON.parse(require("node:fs").readFileSync(pkgJson, "utf8"));
  return pkg.private !== true;
});

log(`Publishing ${dirs.length} package(s)...`, blue);

for (const dir of dirs) {
  const pkgPath = join(packagesDir, dir, "package.json");
  const pkg = JSON.parse(require("node:fs").readFileSync(pkgPath, "utf8"));
  log(`  → ${pkg.name}@${pkg.version}`, blue);

  try {
    run(`cd "${join(packagesDir, dir)}" && bun publish --access public`);
    success(`  ✓ ${pkg.name}@${pkg.version} published`);
  } catch (err) {
    warn(`  ${pkg.name} may already be published or failed`);
  }
}

// Step 7: Tag and push
log("\n🏷️ Creating tags...", blue);
run("changeset tag");
success("Tags created");

// Step 8: Push
log("\n🚀 Pushing to remote...", blue);
run("git push --follow-tags");
success("Pushed to remote");

log("\n✨ Release complete!", green);
