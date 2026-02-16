#!/usr/bin/env node

import { execSync } from "node:child_process"
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

const PACKAGES_DIR = "packages"

function getAllPackages() {
  const packages = []

  for (const dir of readdirSync(PACKAGES_DIR)) {
    const pkgPath = join(PACKAGES_DIR, dir, "package.json")
    if (!existsSync(pkgPath)) continue
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
    if (pkg.name && !pkg.private) {
      packages.push({ name: pkg.name, dir: join(PACKAGES_DIR, dir) })
    }
  }

  return packages
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
  process.stdout.write(`  ${pkg.name}... `)

  const tagFlag = tag ? `--tag ${tag}` : ""

  try {
    execSync(`npm publish --provenance --access public ${tagFlag} "${pkg.dir}"`, {
      stdio: "pipe",
      shell: true,
    })
    console.log("✓ published")
    published++
  } catch (err) {
    const stderr = err.stderr?.toString() || err.stdout?.toString() || err.message || ""
    const stdout = err.stdout?.toString() || ""

    if (
      (stderr + stdout).includes("You cannot publish over the previously published versions") ||
      (stderr + stdout).includes("cannot publish over the previously published versions")
    ) {
      console.log("⊘ already published, skipping")
      skipped++
    } else {
      console.log("✗ FAILED")
      console.error(`    stderr: ${stderr.slice(0, 300)}`)
      console.error(`    stdout: ${stdout.slice(0, 300)}`)
      failed.push({ name: pkg.name, error: stderr + stdout })
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
