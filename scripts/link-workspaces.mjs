import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const packagesDir = join(root, 'packages')
const scope = '@armory-sh/'

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function getScopedPackages() {
  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((dir) => {
      const dirname = typeof dir === 'string' ? dir : dir.name
      const packageJsonPath = join(packagesDir, dirname, 'package.json')
      if (!existsSync(packageJsonPath)) {
        return null
      }
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
      return {
        dir: join(packagesDir, dirname),
        name: pkg.name,
        version: pkg.version,
      }
    })
    .filter((pkg) => pkg && typeof pkg.name === 'string' && pkg.name.startsWith(scope))
}

function toVersionMap(scopedPackages) {
  return new Map(scopedPackages.map((pkg) => [pkg.name, pkg.version]))
}

function rewriteDeps(deps, versions) {
  if (!deps) {
    return
  }

  for (const [depName, depVersion] of Object.entries(deps)) {
    if (typeof depVersion !== 'string' || !depVersion.startsWith('workspace:')) {
      continue
    }

    if (depName.startsWith(scope)) {
      deps[depName] = `link:${depName}`
      continue
    }

    const resolvedVersion = versions.get(depName)
    if (!resolvedVersion) {
      throw new Error(`Unable to resolve workspace dependency ${depName}`)
    }
    deps[depName] = resolvedVersion
  }
}

function rewriteTargetDepsSection(deps, scopedNames) {
  if (!deps) {
    return false
  }

  let changed = false
  for (const [depName, depVersion] of Object.entries(deps)) {
    if (!scopedNames.has(depName)) {
      continue
    }

    if (typeof depVersion !== 'string') {
      continue
    }

    if (!depVersion.startsWith('file:') && !depVersion.startsWith('workspace:')) {
      continue
    }

    deps[depName] = `link:${depName}`
    changed = true
  }

  return changed
}

function normalizeTargetPackageJson(targetDir, scopedPackages) {
  const packageJsonPath = join(targetDir, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return
  }

  const scopedNames = new Set(scopedPackages.map((pkg) => pkg.name))
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  let changed = false

  changed = rewriteTargetDepsSection(packageJson.dependencies, scopedNames) || changed
  changed = rewriteTargetDepsSection(packageJson.devDependencies, scopedNames) || changed
  changed = rewriteTargetDepsSection(packageJson.peerDependencies, scopedNames) || changed
  changed = rewriteTargetDepsSection(packageJson.optionalDependencies, scopedNames) || changed

  if (changed) {
    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
  }
}

function createLinkMirror(scopedPackages) {
  const mirrorRoot = join(root, '.bun-links')
  rmSync(mirrorRoot, { recursive: true, force: true })
  mkdirSync(mirrorRoot, { recursive: true })
  const versions = toVersionMap(scopedPackages)

  for (const pkg of scopedPackages) {
    const pkgDirName = pkg.name.replace(scope, '')
    const mirrorDir = join(mirrorRoot, pkgDirName)
    cpSync(pkg.dir, mirrorDir, { recursive: true })

    const packageJsonPath = join(mirrorDir, 'package.json')
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    rewriteDeps(packageJson.dependencies, versions)
    rewriteDeps(packageJson.peerDependencies, versions)
    rewriteDeps(packageJson.devDependencies, versions)
    writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
  }

  return mirrorRoot
}

function registerAll() {
  const scopedPackages = getScopedPackages()
  const mirrorRoot = createLinkMirror(scopedPackages)

  for (const pkg of scopedPackages) {
    const pkgDirName = pkg.name.replace(scope, '')
    run('bun', ['link'], join(mirrorRoot, pkgDirName))
  }
}

function linkInto(target) {
  if (!target) {
    console.error('Usage: bun run link:to <target-directory>')
    process.exit(1)
  }

  registerAll()

  const scopedPackages = getScopedPackages()
  const targetDir = resolve(root, target)
  normalizeTargetPackageJson(targetDir, scopedPackages)

  for (const pkg of scopedPackages) {
    run('bun', ['link', pkg.name], targetDir)
  }
}

const mode = process.argv[2]

if (mode === 'register') {
  registerAll()
} else if (mode === 'use') {
  linkInto(process.argv[3])
} else {
  console.error('Usage: bun run link:register | bun run link:to <target-directory>')
  process.exit(1)
}
