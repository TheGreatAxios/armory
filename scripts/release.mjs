#!/usr/bin/env bun
/**
 * Automated release script - detects changed packages and releases them.
 * Run: bun run release
 *
 * Based on: https://ianm.com/posts/2025-08-18-setting-up-changesets-with-bun-workspaces
 *
 * Key insights:
 * - Always run `bun update` after `changeset version` to fix lockfile
 * - Use `bun publish` directly for each package (not `changeset publish`)
 * - Publish ALL packages with `|| true` to continue on individual failures
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const packagesDir = new URL("../packages", import.meta.url).pathname;

// ANSI colors
const red = "\x1b[31m";
const green = "\x1b[32m";
const yellow = "\x1b[33m";
const blue = "\x1b[34m";
const cyan = "\x1b[36m";
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

// Get package name from directory
function getPackageName(dir) {
  const pkgJson = join(packagesDir, dir, "package.json");
  if (!existsSync(pkgJson)) return null;
  const pkg = JSON.parse(readFileSync(pkgJson, "utf8"));
  return pkg.name;
}

// Step 1: Pre-flight checks
log("\n📋 Pre-flight checks...", blue);

const branch = run("git rev-parse --abbrev-ref HEAD", { silent: true }).trim();
if (branch !== "main") {
  error(`Not on main branch (current: ${branch})`);
}
success("On main branch");

// Step 2: Detect and auto-commit changes
log("\n🔍 Detecting changed packages...", blue);
const status = run("git status --porcelain", { silent: true }).trim();
const changedPackages = new Set();

if (status) {
  const changedFiles = status.split("\n");
  for (const line of changedFiles) {
    const parts = line.trim().split(/\s+/);
    const filePath = parts[parts.length - 1];
    const match = filePath.match(/^packages\/([^\/]+)\//);
    if (match) {
      changedPackages.add(match[1]);
    }
  }
}

if (changedPackages.size === 0) {
  // Check for existing changesets
  const changesetFiles = run("find .changeset -type f -name '*.md' -not -name 'README.md' 2>/dev/null || echo ''", { silent: true }).trim();
  if (!changesetFiles) {
    error("No changesets found and no package changes detected. Run 'bun changeset' first.");
  }
  log("Found existing changesets", cyan);
} else {
  log("\n📁 Detected changed packages:", cyan);
  const packageNames = Array.from(changedPackages)
    .map(dir => getPackageName(dir))
    .filter(Boolean);

  for (const name of packageNames) {
    log(`  • ${name}`, cyan);
  }

  log("\n📝 Committing changes...", blue);
  run("git add .");
  run('git commit --no-gpg-sign -m "chore: prepare release"');
  success("Changes committed");

  // Step 3: Auto-create changeset
  log("\n📝 Creating changeset...", blue);
  run(`bun changeset`);
  success("Changeset created");
}

// Step 4: Run tests
log("\n🧪 Running tests...", blue);
run("bun test");
success("Tests passed");

// Step 5: Version bump (THIS IS WHERE bun update IS CRITICAL)
log("\n📦 Bumping versions...", blue);
run("changeset version && bun update");
success("Versions bumped and lockfile updated");

// Step 6: Commit version changes
const versionChanged = run("git status --porcelain", { silent: true }).trim();
if (versionChanged) {
  log("\n📝 Committing version changes...", blue);
  run("git add .changeset package.json bun.lock packages/*/package.json packages/*/CHANGELOG.md 2>/dev/null || git add .changeset package.json bun.lock packages/*/package.json");
  run('git commit --no-gpg-sign -m "chore: version bump"');
  success("Version changes committed");
}

// Step 7: Build
log("\n🔨 Building packages...", blue);
run("turbo run build");
success("Build complete");

// Step 8: Publish ALL packages (using || true to continue on failures)
log("\n📤 Publishing packages...", blue);
log("Key: Publishing all packages ensures workspace:* references resolve properly", cyan);

const publishResults = [];
for (const dir of readdirSync(packagesDir)) {
  const pkgJsonPath = join(packagesDir, dir, "package.json");
  if (!existsSync(pkgJsonPath)) continue;

  const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
  if (pkg.private === true) continue;

  log(`  → Publishing ${pkg.name}@${pkg.version}...`, cyan);

  try {
    // Check if already published
    const check = run(`npm view ${pkg.name}@${pkg.version} 2>&1 || echo 'not-found'`, { silent: true }).trim();
    if (check && !check.includes("not-found") && !check.includes("404")) {
      log(`    Already published, skipping`, yellow);
      continue;
    }

    run(`cd "${join(packagesDir, dir)}" && bun publish --access public --yes`);
    success(`  ✓ ${pkg.name}@${pkg.version} published`);
    publishResults.push({ name: pkg.name, version: pkg.version, success: true });
  } catch (err) {
    warn(`  ⚠ ${pkg.name} failed (may need OTP)`);
    publishResults.push({ name: pkg.name, success: false, error: err.message });
  }
}

// Summary
const successCount = publishResults.filter(r => r.success).length;
const failCount = publishResults.filter(r => !r.success).length;

if (failCount > 0) {
  log(`\n⚠️ Published ${successCount} packages, ${failCount} failed`, yellow);
} else {
  success(`All ${successCount} packages published successfully`);
}

// Step 9: Tag and push
log("\n🏷️ Creating tags...", blue);
run("changeset tag");
success("Tags created");

log("\n🚀 Pushing to remote...", blue);
run("git push --follow-tags");
success("Pushed to remote");

log("\n✨ Release complete!", green);
