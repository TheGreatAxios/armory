#!/usr/bin/env bun
/**
 * Automated release script - detects changed packages and releases them.
 * Run: bun run release
 */

import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const packagesDir = new URL("../packages", import.meta.url).pathname;
const changesetsDir = new URL("../.changeset", import.meta.url).pathname;

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

// Detect which packages have changed (uncommitted or since last tag)
function getChangedPackages() {
  const changedPackages = new Set();

  try {
    // Check uncommitted changes first
    const status = run("git status --porcelain", { silent: true }).trim();
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

    // If no uncommitted changes, check commits since last tag
    if (changedPackages.size === 0) {
      let baseRef = "HEAD~10"; // Default: check last 10 commits

      try {
        const latestTag = run("git describe --tags --abbrev=0", { silent: true }).trim();
        baseRef = latestTag;
      } catch {
        // No tags found, use default
      }

      // Get changed files since base ref
      const changedFiles = run(`git diff --name-only ${baseRef} HEAD`, { silent: true }).trim();
      if (changedFiles) {
        for (const filePath of changedFiles.split("\n")) {
          const match = filePath.match(/^packages\/([^\/]+)\//);
          if (match) {
            changedPackages.add(match[1]);
          }
        }
      }
    }
  } catch (e) {
    log(`Warning: Could not detect changes: ${e.message}`, yellow);
  }

  return Array.from(changedPackages);
}

// Get package names from directories
function getPackageName(dir) {
  const pkgJson = join(packagesDir, dir, "package.json");
  if (!existsSync(pkgJson)) return null;
  const pkg = JSON.parse(readFileSync(pkgJson, "utf8"));
  return pkg.name;
}

// Create a changeset file automatically
function createChangeset(packageNames, type = "patch", summary = "Automated release") {
  const timestamp = Date.now();
  const fileName = `${timestamp}.md`;
  const filePath = join(changesetsDir, fileName);

  const content = `---
${packageNames.map(name => `'${name}': ${type}`).join("\n")}
---

${summary}
`;

  writeFileSync(filePath, content);
  return fileName;
}

// Step 1: Pre-flight checks
log("\n📋 Pre-flight checks...", blue);

const branch = run("git rev-parse --abbrev-ref HEAD", { silent: true }).trim();
if (branch !== "main") {
  error(`Not on main branch (current: ${branch})`);
}
success("On main branch");

// Check if current HEAD matches latest published release
log("\n🔍 Checking against published releases...", blue);
const latestTag = run("git describe --tags --abbrev=0 2>/dev/null || echo 'none'", { silent: true }).trim();
const currentHead = run("git rev-parse HEAD", { silent: true }).trim();
const tagCommit = latestTag !== "none"
  ? run(`git rev-parse ${latestTag} 2>/dev/null || echo 'unknown'`, { silent: true }).trim()
  : "unknown";

if (latestTag !== "none" && tagCommit !== currentHead) {
  log("\n📊 State comparison:", cyan);
  log(`  Latest tag: ${latestTag} (${tagCommit.slice(0, 8)})`, cyan);
  log(`  Current HEAD: ${currentHead.slice(0, 8)}`, cyan);

  const commitsSinceTag = run(`git rev-list ${latestTag}..HEAD --count 2>/dev/null || echo '0'`, { silent: true }).trim();
  if (commitsSinceTag !== "0") {
    log(`  Commits since tag: ${commitsSinceTag}`, yellow);
  }
} else if (latestTag !== "none") {
  success(`Current HEAD matches latest tag (${latestTag})`);
} else {
  log("  No previous tags found", yellow);
}

// Step 2: Detect and auto-commit changes
log("\n🔍 Detecting changed packages...", blue);
const changedPackages = getChangedPackages();

if (changedPackages.length === 0) {
  warn("No changed packages detected.");
  log("Checking for existing changesets...", blue);

  try {
    const changesetFiles = run("find .changeset -name '*.md' -not -name 'README.md' -not -name 'config.json'", { silent: true }).trim();
    if (!changesetFiles) {
      error("No changesets found and no package changes detected. Nothing to release.");
    }
    success(`Found existing changesets`);
  } catch (e) {
    error("No changesets found. Nothing to release.");
  }
} else {
  log("\n📁 Detected changed packages:", cyan);
  const packageNames = changedPackages
    .map(dir => getPackageName(dir))
    .filter(Boolean);

  for (const name of packageNames) {
    log(`  • ${name}`, cyan);
  }

  log("\n📝 Auto-committing changes...", blue);
  run("git add .");
  run('git commit -m "chore: prepare release"');
  success("Changes committed");

  // Step 3: Auto-create changeset
  log("\n📝 Creating changeset...", blue);
  try {
    createChangeset(packageNames, "patch", "Automated release");
    success("Changeset created");
  } catch (e) {
    error(`Failed to create changeset: ${e.message}`);
  }
}

// Step 4: Run tests
log("\n🧪 Running tests...", blue);
run("bun test");
success("Tests passed");

// Step 5: Version bump
log("\n📦 Bumping versions...", blue);
run("changeset version && bun update");
success("Versions bumped");

// Step 6: Commit version changes
const versionChanged = run("git status --porcelain", { silent: true }).trim();
if (versionChanged) {
  log("\n📝 Committing version changes...", blue);
  run("git add .changeset package.json bun.lock packages/*/package.json packages/*/CHANGELOG.md 2>/dev/null || git add .changeset package.json bun.lock packages/*/package.json");
  run('git commit -m "chore: version bump"');
  success("Version changes committed");
}

// Step 7: Build
log("\n🔨 Building packages...", blue);
run("turbo run build");
success("Build complete");

// Step 8: Publish
log("\n📤 Publishing packages...", blue);

const dirs = readdirSync(packagesDir).filter((d) => {
  const pkgJson = join(packagesDir, d, "package.json");
  if (!existsSync(pkgJson)) return false;
  const pkg = JSON.parse(readFileSync(pkgJson, "utf8"));
  return pkg.private !== true;
});

log(`Publishing ${dirs.length} package(s)...`, blue);

for (const dir of dirs) {
  const pkgPath = join(packagesDir, dir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  log(`  → ${pkg.name}@${pkg.version}`, cyan);

  try {
    run(`cd "${join(packagesDir, dir)}" && bun publish --access public`, { silent: true });
    success(`  ✓ ${pkg.name}@${pkg.version} published`);
  } catch (err) {
    warn(`  ⚠ ${pkg.name} may already be published or failed`);
  }
}

// Step 9: Tag and push
log("\n🏷️ Creating tags...", blue);
run("changeset tag");
success("Tags created");

log("\n🚀 Pushing to remote...", blue);
run("git push --follow-tags");
success("Pushed to remote");

log("\n✨ Release complete!", green);
