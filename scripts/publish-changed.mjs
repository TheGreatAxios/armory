#!/usr/bin/env node

import { execSync } from "node:child_process"
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

const PACKAGES_DIR = "packages"

function getAllPackages() {
  const packageNames = []

  for (const dir of readdirSync(PACKAGES_DIR)) {
    const pkgPath = join(PACKAGES_DIR, dir, "package.json")
    if (!existsSync(pkgPath)) continue
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
    if (pkg.name && !pkg.private) {
      packageNames.push(pkg.name)
    }
  }

  return packageNames
}

const tag = process.argv[2]

const packagesToPublish = getAllPackages()

if (packagesToPublish.length === 0) {
  console.log("No packages to publish")
  process.exit(0)
}

console.log(`📦 Publishing ${packagesToPublish.length} packages...\n`)

let published = 0
let skipped = 0
let failed = []

for (const pkg of packagesToPublish) {
  process.stdout.write(`  ${pkg}... `)

  const tagFlag = tag ? `--tag ${tag}` : ""

  try {
    execSync(`npm publish --provenance --access public ${tagFlag} "${pkg}"`, {
      stdio: "pipe",
      shell: true,
    })
    console.log("✓ published")
    published++
  } catch (err) {
    const stderr = err.stderr?.toString() || err.stdout?.toString() || err.message || ""

    if (
      stderr.includes("You cannot publish over the previously published versions") ||
      stderr.includes("cannot publish over the previously published versions")
    ) {
      console.log("⊘ already published, skipping")
      skipped++
    } else {
      console.log("✗ FAILED")
      console.error(`    Error: ${stderr.slice(0, 200)}`)
      failed.push({ name: pkg, error: stderr })
    }
  }
}

console.log(`\n📊 Summary:`)
console.log(`  ✓ Published: ${published}`)
console.log(`  ⊘ Skipped (already published): ${skipped}`)

if (failed.length > 0) {
  console.log(`  ✗ Failed: ${failed.length}`)
  console.log("\nFailed packages:")
  for (const { name, error } of failed) {
    console.log(`  - ${name}`)
    console.log(`    ${error.slice(0, 100)}...`)
  }
  process.exit(1)
}

console.log("\n✅ Done")
