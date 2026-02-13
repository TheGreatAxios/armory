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

// Parse semver version
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: parseInt(match[1]), minor: parseInt(match[2]), patch: parseInt(match[3]) };
}

// Compare two versions
function compareVersions(v1, v2) {
  const parsed1 = parseVersion(v1);
  const parsed2 = parseVersion(v2);

  if (!parsed1 || !parsed2) return 0;

  if (parsed1.major !== parsed2.major) return parsed1.major - parsed2.major;
  if (parsed1.minor !== parsed2.minor) return parsed1.minor - parsed2.minor;
  return parsed1.patch - parsed2.patch;
}

// Get expected next version
function getNextVersion(current, type) {
  const parsed = parseVersion(current);
  if (!parsed) return current;

  switch (type) {
    case "major":
      return `${parsed.major + 1}.0.0`;
    case "minor":
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case "patch":
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
    default:
      return current;
  }
}

// Check if version jumped too far
function checkVersionSkips(packageName, currentVersion, changesetType) {
  try {
    // Try to get published version from npm
    const published = run(`npm view ${packageName} version 2>/dev/null || echo '0.0.0'`, { silent: true }).trim();
    if (published === "0.0.0") return null; // Not published yet

    const expected = getNextVersion(published, changesetType);
    const parsedCurrent = parseVersion(currentVersion);
    const parsedExpected = parseVersion(expected);

    if (!parsedCurrent || !parsedExpected) return null;

    // Check if we skipped versions
    if (parsedCurrent.major > parsedExpected.major) {
      return {
        current: currentVersion,
        expected,
        published,
        reason: "major"
      };
    }
    if (parsedCurrent.minor > parsedExpected.minor && parsedCurrent.major === parsedExpected.major) {
      return {
        current: currentVersion,
        expected,
        published,
        reason: "minor"
      };
    }
    if (parsedCurrent.patch > parsedExpected.patch && parsedCurrent.minor === parsedExpected.minor) {
      return {
        current: currentVersion,
        expected,
        published,
        reason: "patch"
      };
    }

    return null;
  } catch {
    return null; // Can't check npm, skip validation
  }
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

// Track which packages to publish
let packageNames = [];

if (changedPackages.length === 0) {
  warn("No changed packages detected.");
  log("Checking for existing changesets...", blue);

  try {
    const changesetFiles = run("find .changeset -type f -name '*.md' -not -name 'README.md'", { silent: true }).trim();
    if (!changesetFiles) {
      error("No changesets found and no package changes detected. Nothing to release.");
    }
    // Extract package names from existing changesets
    const firstFile = changesetFiles.split("\n")[0];
    const changesetContent = readFileSync(join(process.cwd(), firstFile), "utf8");
    const match = changesetContent.match(/'(@armory-sh\/[^']+)'/g);
    if (match) {
      packageNames = match.map(m => m.replace(/'/g, ""));
    }
    success(`Found existing changesets for ${packageNames.length} packages`);
  } catch (e) {
    error("No changesets found. Nothing to release.");
  }
} else {
  log("\n📁 Detected changed packages:", cyan);
  packageNames = changedPackages
    .map(dir => getPackageName(dir))
    .filter(Boolean);

  for (const name of packageNames) {
    log(`  • ${name}`, cyan);
  }

  log("\n📝 Auto-committing changes...", blue);
  run("git add .");
  run('git commit --no-gpg-sign -m "chore: prepare release"');
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
  run('git commit --no-gpg-sign -m "chore: version bump"');
  success("Version changes committed");
}

// Step 7: Build
log("\n🔨 Building packages...", blue);
run("turbo run build");
success("Build complete");

// Step 8: Publish (only changed packages)
log("\n📤 Publishing packages...", blue);

// Only publish packages that were in the changeset
const packagesToPublish = packageNames.length > 0
  ? readdirSync(packagesDir).filter((d) => {
      const pkgJson = join(packagesDir, d, "package.json");
      if (!existsSync(pkgJson)) return false;
      const pkg = JSON.parse(readFileSync(pkgJson, "utf8"));
      return pkg.private !== true && packageNames.includes(pkg.name);
    })
  : [];

if (packagesToPublish.length === 0) {
  warn("No packages to publish (all versions unchanged)");
} else {
  log(`Publishing ${packagesToPublish.length} package(s)...`, blue);

  // Check for version skips
  log("\n🔍 Validating versions...", blue);
  const versionIssues = [];

  // Get all changeset files once
  const changesetFiles = run("find .changeset -type f -name '*.md' -not -name 'README.md'", { silent: true }).trim().split("\n").filter(Boolean);

  for (const dir of packagesToPublish) {
    const pkgPath = join(packagesDir, dir, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

    // Get changeset type for this package
    let changesetType = "patch";

    for (const file of changesetFiles) {
      try {
        const content = readFileSync(join(process.cwd(), file), "utf8");
        if (content.includes(`'${pkg.name}'`)) {
          if (content.includes(`'${pkg.name}': minor`)) changesetType = "minor";
          else if (content.includes(`'${pkg.name}': major`)) changesetType = "major";
          break;
        }
      } catch {
        // Skip files that can't be read
      }
    }

    const skip = checkVersionSkips(pkg.name, pkg.version, changesetType);
    if (skip) {
      versionIssues.push({ pkg, skip, changesetType, dir }); // Include dir for correct path
    }
  }

  if (versionIssues.length > 0) {
    log("\n⚠️  Version skip detected:", yellow);
    for (const { pkg, skip, changesetType } of versionIssues) {
      log(`  ${pkg.name}:`, yellow);
      log(`    Published: ${skip.published}`, yellow);
      log(`    Expected:   ${skip.expected} (${changesetType})`, yellow);
      log(`    Local:      ${skip.current} (skipped ${skip.reason})`, yellow);
    }

    // Auto-fix by updating package.json files
    log("\n🔧 Auto-fixing versions...", blue);
    const fixedPackages = [];
    for (const { pkg, skip, dir } of versionIssues) {
      const pkgPath = join(packagesDir, dir, "package.json");
      const pkgJson = JSON.parse(readFileSync(pkgPath, "utf8"));
      pkgJson.version = skip.expected;
      writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2) + "\n");
      log(`  ✓ Fixed ${pkg.name} to ${skip.expected}`, green);
      fixedPackages.push({ name: pkg.name, dir });
    }

    // Add fixed packages to publish list
    log("\n📝 Adding fixed packages to publish list...", blue);
    for (const { name, dir } of fixedPackages) {
      if (!packagesToPublish.includes(dir)) {
        packagesToPublish.push(dir);
      }
    }
    success(`Added ${fixedPackages.length} packages to publish`);

    // Rebuild with fixed versions
    log("\n🔨 Rebuilding with fixed versions...", blue);
    run("turbo run build");
    success("Rebuild complete");
  } else {
    success("All versions valid");
  }

  // Now publish
  log("\n📤 Publishing to npm...", blue);
  for (const dir of packagesToPublish) {
    const pkgPath = join(packagesDir, dir, "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    log(`  → ${pkg.name}@${pkg.version}`, cyan);

    try {
      // Check if already published at this version
      const check = run(`npm view ${pkg.name}@${pkg.version} 2>&1 || echo 'not-found'`, { silent: true }).trim();
      if (check && !check.includes("not-found") && !check.includes("404")) {
        log(`    Already published, skipping...`, yellow);
        continue;
      }

      // Publish (not silent so we can see what's happening)
      run(`cd "${join(packagesDir, dir)}" && bun publish --access public --yes`);
      success(`  ✓ ${pkg.name}@${pkg.version} published`);
    } catch (err) {
      warn(`  ⚠ ${pkg.name} failed to publish (may need OTP or already exists)`);
    }
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
