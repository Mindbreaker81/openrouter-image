#!/usr/bin/env bash
set -euo pipefail

echo "Running prepublish checks..."

echo "1) Run tests"
npm test

echo "2) Build package tarball"
PROJECT_ROOT=$(pwd -P)
PKG_NAME_RAW=$(node -p "require('./package.json').name")
PACKAGE_NAME=$(node -p "require('./package.json').name.replace('@','').replace('/','-')")
PACKAGE_VERSION=$(node -p "require('./package.json').version")
TGZ="${PACKAGE_NAME}-${PACKAGE_VERSION}.tgz"

npm pack
if [ ! -f "$TGZ" ]; then
  echo "ERROR: expected $TGZ but it was not created"
  exit 1
fi
echo "Created $TGZ"

echo "3) Inspect package contents (first 200 lines)"
tar -tzf "$TGZ" | sed -n '1,200p'

echo "3a) Verify expected files are present"
expected=(CHANGELOG.md LICENSE package.json README.md src/cli.js src/client.js src/core.js src/index.js src/mcp-stdio.js src/server.js)
missing=()
contents=$(tar -tzf "$TGZ")
for f in "${expected[@]}"; do
  if ! echo "$contents" | grep -q "\(^\|/\)${f}$"; then
    if ! echo "$contents" | grep -q "package/${f}"; then
      missing+=("$f")
    fi
  fi
done
if [ ${#missing[@]} -ne 0 ]; then
  echo "ERROR: missing expected files in $TGZ: ${missing[*]}"
  exit 1
fi
echo "All expected files present in $TGZ"

echo "4) Try local install in temporary project"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT
pushd "$TMPDIR" >/dev/null
  npm init -y >/dev/null
  echo "Installing $PROJECT_ROOT/$TGZ into temporary project $TMPDIR"
  npm install "$PROJECT_ROOT/$TGZ"

  INST_DIR="node_modules/${PKG_NAME_RAW}"
  if [ ! -d "$INST_DIR" ]; then
    echo "ERROR: installed package directory not found: $INST_DIR"
    ls -la node_modules || true
    exit 1
  fi
  echo "Package installed into $INST_DIR"
popd >/dev/null

echo
echo "PREPUBLISH CHECKS PASSED"
echo "Generated artifact: $PROJECT_ROOT/$TGZ"
echo "You can now run: npm publish --access public"

exit 0
