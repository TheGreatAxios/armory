#!/usr/bin/env bun

import { fs } from "bun"
import { join } from "node:path"
import { spawn } from "node:child_process"

const PACKAGES_DIR = "packages"
const STATE_FILE = ".publish-state.json"

type PublishState = Record<string, string>

function run(cmd: string, args: string[], cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, shell: true })
    let stdout = ""
    let stderr = ""

    proc.stdout.on("data", (d) => stdout += d.toString())
    proc.stderr.on("data", (d) => stderr += d.toString())

    proc.on("close", (code) => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(stderr || `Exit code ${code}`))
    })
  })
}

function getGitHash(): string {
  const proc = spawn("git", ["rev-parse", "HEAD"])
  let stdout = ""
  proc.stdout.on("data", (d) => stdout += d.toString())
  proc.on("close", () => {})
  return stdout.trim()
}

async function getPackages() {
  const packages = []

  for (const dir of fs.readdirSync(PACKAGES_DIR)) {
    const pkgPath = join(PACKAGES_DIR, dir)
    const pkgJsonPath = join(pkgPath, "package.json")

    if (!fs.existsSync(pkgJsonPath)) continue

    const pkg = await import(join(import.meta.dir, "..", pkgJsonPath))
    packages.push({ name: pkg.name, dir: pkgPath, version: pkg.version })
  }

  return packages
}

async function loadState(): Promise<PublishState> {
  if (await fs.exists(STATE_FILE)) {
    const content = await fs.file(STATE_FILE).text()
    return JSON.parse(content)
  }
  return {}
}

async function saveState(state: PublishState): Promise<void> {
  await fs.write(STATE_FILE, JSON.stringify(state, null, 2))
}

async function isPublished(pkgName: string, gitHash: string): Promise<boolean> {
  const state = await loadState()
  return state[pkgName] === gitHash
}

async function markPublished(pkgName: string, gitHash: string): Promise<void> {
  const state = await loadState()
  state[pkgName] = gitHash
  await saveState(state)
}

async function publishPackage(pkg): Promise<boolean> {
  console.log(`\n📦 Publishing ${pkg.name}@${pkg.version}`)

  try {
    await run("bun", ["run", "build"], pkg.dir)
    await run("bun", ["publish", "--access", "public"], pkg.dir)
    return true
  } catch (error) {
    console.error(`  ❌ Failed: ${error}`)
    return false
  }
}

async function main() {
  const gitHash = getGitHash()
  console.log(`🔍 Git hash: ${gitHash}`)

  const packages = await getPackages()
  console.log(`📋 Found ${packages.length} packages`)

  let published = 0
  let skipped = 0
  let failed = 0

  for (const pkg of packages) {
    if (await isPublished(pkg.name, gitHash)) {
      console.log(`⏭️  Skipping ${pkg.name} (already published with this hash)`)
      skipped++
      continue
    }

    const success = await publishPackage(pkg)

    if (success) {
      await markPublished(pkg.name, gitHash)
      console.log(`✅ Published ${pkg.name}`)
      published++
    } else {
      console.log(`❌ Failed ${pkg.name}`)
      failed++
    }
  }

  console.log(`\n📊 Summary:`)
  console.log(`  ✅ Published: ${published}`)
  console.log(`  ⏭️  Skipped: ${skipped}`)
  console.log(`  ❌ Failed: ${failed}`)
}

main()
