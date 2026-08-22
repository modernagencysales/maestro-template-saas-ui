#!/usr/bin/env bash
# Shared Node.js + pnpm bootstrap. Sourced (not executed) by each step script
# so PATH changes persist for subsequent commands.
set -euo pipefail

# Full bootstrap is only for bare CI agents. Unit tests exercise the step
# scripts (mutation-script.test.mts, ai-gate-scripts.test.mts) and set
# TEMPLATE_CI_SETUP=skip so a frozen install never runs inside a test
# timeout; local operator runs with a working toolchain skip it too.
if [[ "${TEMPLATE_CI_SETUP:-}" == "skip" ]]; then
  return 0
fi
if [[ "${CI:-}" != "true" ]] && command -v pnpm &>/dev/null; then
  return 0
fi

# Prefer a compatible Node already present on container runners. Bare runners
# fall back to fnm, which reads .nvmrc automatically. When fnm is not prebaked,
# install its pinned release archive with a checked SHA-256; never execute remote
# installers from PR-controlled scripts.
NODE_ENGINE_RANGE="^22.23.2 || ^24.0.0 || >=26.0.0"
FNM_VERSION="1.38.1"
FNM_LINUX_ZIP_SHA256="b69e5c9a05c1e17e4a7de9a17df14ba430d049f2591af791a6f850a170296069"
FNM_LINUX_ZIP_URL="https://github.com/Schniz/fnm/releases/download/v${FNM_VERSION}/fnm-linux.zip"

sha256_file() {
  if command -v sha256sum &>/dev/null; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

install_pinned_fnm() {
  if ! command -v curl &>/dev/null; then
    echo "curl must be preinstalled to fetch pinned fnm ${FNM_VERSION}." >&2
    exit 1
  fi
  if ! command -v python3 &>/dev/null; then
    echo "python3 must be preinstalled to unpack pinned fnm ${FNM_VERSION}." >&2
    exit 1
  fi
  local tmp_dir archive actual_sha install_dir
  tmp_dir="$(mktemp -d)"
  archive="$tmp_dir/fnm-linux.zip"
  curl -fsSL -o "$archive" "$FNM_LINUX_ZIP_URL"
  actual_sha="$(sha256_file "$archive")"
  if [[ "$actual_sha" != "$FNM_LINUX_ZIP_SHA256" ]]; then
    echo "fnm ${FNM_VERSION} checksum mismatch: expected ${FNM_LINUX_ZIP_SHA256}, got ${actual_sha}" >&2
    rm -rf "$tmp_dir"
    exit 1
  fi
  python3 -m zipfile -e "$archive" "$tmp_dir/extract"
  install_dir="${HOME:-$PWD}/.local/bin"
  mkdir -p "$install_dir"
  install -m 0755 "$tmp_dir/extract/fnm" "$install_dir/fnm"
  rm -rf "$tmp_dir"
  export PATH="$install_dir:$PATH"
}

node_version_is_compatible() {
  local version="${1#v}"
  if [[ ! "$version" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    return 1
  fi
  local major="${BASH_REMATCH[1]}"
  local minor="${BASH_REMATCH[2]}"
  local patch="${BASH_REMATCH[3]}"
  if ((major == 22)); then
    ((minor > 23 || (minor == 23 && patch >= 2)))
  elif ((major == 24)); then
    return 0
  else
    ((major >= 26))
  fi
}

node_is_compatible() {
  command -v node &>/dev/null && node_version_is_compatible "$(node --version)"
}

if ! node_is_compatible; then
  if ! command -v fnm &>/dev/null; then
    install_pinned_fnm
  fi
  if ! fnm --version | grep -Eq "(^| )${FNM_VERSION}($| )"; then
    echo "fnm version mismatch; expected $FNM_VERSION, got: $(fnm --version)" >&2
    exit 1
  fi
  eval "$(fnm env --shell bash)"
  fnm install
  fnm use
  if ! node_is_compatible; then
    echo "fnm failed to provide Node ${NODE_ENGINE_RANGE}; got: $(node --version 2>/dev/null || echo missing)" >&2
    exit 1
  fi
else
  echo "Using compatible preinstalled node $(node --version)."
fi

# pnpm: checksum-pinned standalone binary. Corepack verifies downloads against
# registry signature keys that rotate out from under pinned Node releases
# ("Cannot find matching keyid"), so it is avoided entirely.
PNPM_VERSION="10.12.1"
PNPM_LINUX_X64_SHA256="eb2dc1f109bca046ce734d062c8dd8f34db2b58a115992f9b086456efd7b2305"

if ! command -v pnpm &>/dev/null || [[ "$(pnpm --version 2>/dev/null)" != "$PNPM_VERSION" ]]; then
  if [[ "$(uname -s)_$(uname -m)" != "Linux_x86_64" ]]; then
    echo "pnpm $PNPM_VERSION must be preinstalled on non linux-x64 CI images." >&2
    exit 1
  fi
  pnpm_install_dir="${HOME:-$PWD}/.local/bin"
  mkdir -p "$pnpm_install_dir"
  curl -fsSL -o "$pnpm_install_dir/pnpm.download" \
    "https://github.com/pnpm/pnpm/releases/download/v${PNPM_VERSION}/pnpm-linux-x64"
  pnpm_actual_sha="$(sha256_file "$pnpm_install_dir/pnpm.download")"
  if [[ "$pnpm_actual_sha" != "$PNPM_LINUX_X64_SHA256" ]]; then
    echo "pnpm ${PNPM_VERSION} checksum mismatch: expected ${PNPM_LINUX_X64_SHA256}, got ${pnpm_actual_sha}" >&2
    exit 1
  fi
  install -m 0755 "$pnpm_install_dir/pnpm.download" "$pnpm_install_dir/pnpm"
  rm -f "$pnpm_install_dir/pnpm.download"
  export PATH="$pnpm_install_dir:$PATH"
fi

# Keep the pnpm store inside the workspace so the hosted CI cache volume can
# restore/save it across ephemeral hosted agents without writing repo config.
export npm_config_store_dir="$PWD/.pnpm-store"

run_without_ci_secrets() {
  local scrubbed_env=(env)
  local name
  while IFS='=' read -r name _; do
    case "$name" in
      *_TOKEN|*_API_KEY|*_DEPLOY_KEY|*_SECRET|*_PASSWORD|*_PRIVATE_KEY|*_CREDENTIALS|*_COOKIE_PASSWORD|CONVEX_DEPLOY_KEY*|CLOUDFLARE_*|WORKOS_*|OPENROUTER_*|ANTHROPIC_*|MAESTRO_WEB_*|SITE_URL*|VITE_CONVEX_URL*)
        scrubbed_env+=("-u" "$name")
        ;;
    esac
  done < <(env)
  "${scrubbed_env[@]}" "$@"
}

echo "pnpm store: $(run_without_ci_secrets pnpm store path)"
for cache_path in .pnpm-store node_modules .turbo packages/convex/reports; do
  if [ -e "$cache_path" ]; then
    du -sh "$cache_path" 2>/dev/null || true
  else
    echo "cache miss: $cache_path"
  fi
done

run_without_ci_secrets node --experimental-strip-types tooling/ci/candidate-sandbox.mts validate
run_without_ci_secrets pnpm fetch --frozen-lockfile --ignore-scripts
run_without_ci_secrets pnpm install --offline --frozen-lockfile --ignore-scripts

run_without_ci_secrets bash tooling/ci/seed-frozen-alpha2-store.sh
