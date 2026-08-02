#!/usr/bin/env bash
set -euo pipefail

# invariant: secret scanning is a CI guardrail, so the scanner version and
# release checksums are deploy-time constants rather than policy.
GITLEAKS_VERSION="8.30.1"

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"

case "$arch" in
  x86_64 | amd64) asset_arch="x64" ;;
  arm64 | aarch64) asset_arch="arm64" ;;
  *)
    echo "unsupported gitleaks architecture: $arch" >&2
    exit 1
    ;;
esac

case "${os}_${asset_arch}" in
  darwin_arm64) sha256="b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5" ;;
  darwin_x64) sha256="dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709" ;;
  linux_arm64) sha256="e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080" ;;
  linux_x64) sha256="551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb" ;;
  *)
    echo "unsupported gitleaks platform: ${os}_${asset_arch}" >&2
    exit 1
    ;;
esac

asset="gitleaks_${GITLEAKS_VERSION}_${os}_${asset_arch}.tar.gz"
url="https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/${asset}"
install_dir="${HOME}/.local/bin"
installed_gitleaks="${install_dir}/gitleaks"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

mkdir -p "$install_dir"

if [ -x "$installed_gitleaks" ]; then
  if command -v sha256sum >/dev/null 2>&1; then
    installed_sha256="$(sha256sum "$installed_gitleaks" | awk '{print $1}')"
  else
    installed_sha256="$(shasum -a 256 "$installed_gitleaks" | awk '{print $1}')"
  fi
  if [ "$installed_sha256" = "$sha256" ] && [ "$("$installed_gitleaks" version)" = "$GITLEAKS_VERSION" ]; then
    exit 0
  fi
fi

curl -fsSL "$url" -o "${tmp_dir}/${asset}"
if command -v sha256sum >/dev/null 2>&1; then
  actual_sha256="$(sha256sum "${tmp_dir}/${asset}" | awk '{print $1}')"
else
  actual_sha256="$(shasum -a 256 "${tmp_dir}/${asset}" | awk '{print $1}')"
fi
if [ "$actual_sha256" != "$sha256" ]; then
  echo "gitleaks checksum mismatch for $asset" >&2
  exit 1
fi

tar -xzf "${tmp_dir}/${asset}" -C "$tmp_dir" gitleaks
install -m 0755 "${tmp_dir}/gitleaks" "$installed_gitleaks"

if [ "$("$installed_gitleaks" version)" != "$GITLEAKS_VERSION" ]; then
  echo "installed gitleaks version mismatch" >&2
  exit 1
fi
