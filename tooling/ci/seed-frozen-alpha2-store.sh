#!/usr/bin/env bash
set -euo pipefail

# invariant: immutable release tests install this exact published tag offline.
seed_parent="$(mktemp -d)"
seed_root="$seed_parent/release"
cleanup() {
  rm -rf "$seed_parent"
}
trap cleanup EXIT

git clone --quiet --shared "$PWD" "$seed_root"
git -C "$seed_root" checkout --quiet --detach maestro-template-v0.2.0-alpha.2
CI=true pnpm --dir "$seed_root" fetch --frozen-lockfile
