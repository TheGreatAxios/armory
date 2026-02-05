#!/usr/bin/env bash
set -e

# Temp files for portable storage
DEPS_FILE=$(mktemp)
DIRS_FILE=$(mktemp)

# Cleanup temp files on exit
cleanup() {
  rm -f "$DEPS_FILE" "$DIRS_FILE" 2>/dev/null || true
}
trap cleanup EXIT

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
GRAY='\033[0;90m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# ===== Helper Functions =====

# Extract internal deps from a package's package.json
get_internal_deps() {
  local pkg_dir="$1"
  node -e "
    const pkg = require('${pkg_dir}/package.json');
    const deps = {...pkg.dependencies, ...pkg.peerDependencies};
    Object.keys(deps)
      .filter(d => d.startsWith('@armory/') || d === 'armory-cli')
      .join(' ');
  " 2>/dev/null || echo ""
}

# ===== Build Dependency Graph Dynamically =====
echo -e "${BLUE}Scanning packages...${NC}"

for pkg_json in packages/*/package.json; do
  pkg_dir=$(dirname "$pkg_json")
  pkg_name=$(node -e "console.log(require('$pkg_json').name)" 2>/dev/null || echo "")

  if [ -n "$pkg_name" ]; then
    deps=$(get_internal_deps "$pkg_dir")
    echo "$pkg_name|$deps" >> "$DEPS_FILE"
    echo "$pkg_name|$pkg_dir" >> "$DIRS_FILE"
  fi
done

# Helper: get deps for a package
get_deps() {
  grep "^$1|" "$DEPS_FILE" | cut -d'|' -f2
}

# Helper: get dir for a package
get_dir() {
  grep "^$1|" "$DIRS_FILE" | cut -d'|' -f2
}

# Get last tag or fallback to initial commit
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

echo -e "${GRAY}Last published version: ${LAST_TAG}${NC}"

# Find changed packages (quote variable for safety)
CHANGED_DIRS=$(git diff --name-only "${LAST_TAG}" 2>/dev/null | grep '^packages/' | cut -d'/' -f2 | sort -u || true)

if [ -z "$CHANGED_DIRS" ]; then
  echo -e "${YELLOW}No packages changed since last release${NC}"
  exit 0
fi

echo -e "${YELLOW}Changed directories:${NC}"
echo "$CHANGED_DIRS"

# Find packages that need publishing (changed + dependents)
PUBLISH_LIST=()

for line in $(cat "$DEPS_FILE" | cut -d'|' -f1); do
  pkg="$line"
  pkg_dir=$(get_dir "$pkg")
  pkg_dir_name=$(basename "$pkg_dir")

  # Check if this package changed
  if echo "$CHANGED_DIRS" | grep -q "^$pkg_dir_name$"; then
    PUBLISH_LIST+=("$pkg")
    continue
  fi

  # Check if any dependency changed
  for dep in $(get_deps "$pkg"); do
    if [[ " ${PUBLISH_LIST[@]} " =~ " ${dep} " ]]; then
      PUBLISH_LIST+=("$pkg")
      break
    fi
  done
done

# ===== Topological Sort for Publish Order =====
# Packages with no internal deps first, then dependents
TO_PUBLISH=()

max_iterations=$(($(wc -l < "$DEPS_FILE" | tr -d ' ') + 1))
iteration=0

while [ $iteration -lt $max_iterations ]; do
  added_this_round=0

  for pkg in "${PUBLISH_LIST[@]}"; do
    # Skip if already in TO_PUBLISH
    if [[ " ${TO_PUBLISH[@]} " =~ " ${pkg} " ]]; then
      continue
    fi

    # Check if all deps are satisfied
    all_deps_satisfied=true
    for dep in $(get_deps "$pkg"); do
      # If dep is internal and not yet in TO_PUBLISH, we can't publish yet
      dep_entry=$(grep "^$dep|" "$DEPS_FILE")
      if [[ -n "$dep_entry" ]] && ! [[ " ${TO_PUBLISH[@]} " =~ " ${dep} " ]]; then
        all_deps_satisfied=false
        break
      fi
    done

    if $all_deps_satisfied; then
      TO_PUBLISH+=("$pkg")
      added_this_round=1
    fi
  done

  if [ $added_this_round -eq 0 ]; then
    break
  fi

  ((iteration++))
done

# Add any remaining packages (circular deps or issues)
for pkg in "${PUBLISH_LIST[@]}"; do
  if ! [[ " ${TO_PUBLISH[@]} " =~ " ${pkg} " ]]; then
    TO_PUBLISH+=("$pkg")
  fi
done

if [ ${#TO_PUBLISH[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ No packages need publishing${NC}"
  exit 0
fi

echo -e "${GREEN}Packages to publish:${NC}"
for pkg in "${TO_PUBLISH[@]}"; do
  echo "  • $pkg"
done

echo ""
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  exit 0
fi

# ===== Publish Each Package =====
for pkg in "${TO_PUBLISH[@]}"; do
  pkg_dir=$(get_dir "$pkg")

  echo -e "${GREEN}Publishing ${pkg}...${NC}"

  # Use pushd/popd for directory safety
  pushd "$pkg_dir" >/dev/null

  # Get version
  VERSION=$(node -e "console.log(require('./package.json').version)")

  echo -e "${BLUE}  Version: ${VERSION}${NC}"

  # Build
  if ! bun run build; then
    echo -e "${RED}Build failed for ${pkg}${NC}"
    popd >/dev/null
    exit 1
  fi

  # bun publish automatically strips workspace:* protocols
  # No manual sed/restore needed!
  bun publish --access public

  popd >/dev/null

  echo -e "${GREEN}✓ Published ${pkg}@${VERSION}${NC}"
done

echo -e "${GREEN}✓ All packages published!${NC}"
echo ""
echo -e "${BLUE}Don't forget to tag the release:${NC}"
echo "  git tag -a v0.1.0 -m 'Release 0.1.0'"
echo "  git push --tags"
