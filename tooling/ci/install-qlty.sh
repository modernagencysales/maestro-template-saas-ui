#!/usr/bin/env bash
set -euo pipefail

QLTY_VERSION="0.631.0"

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"

case "$arch" in
  x86_64 | amd64) asset_arch="x86_64" ;;
  arm64 | aarch64) asset_arch="aarch64" ;;
  *)
    echo "unsupported qlty architecture: $arch" >&2
    exit 1
    ;;
esac

case "$os" in
  linux) platform="${asset_arch}-unknown-linux-gnu" ;;
  darwin) platform="${asset_arch}-apple-darwin" ;;
  *)
    echo "unsupported qlty platform: $os" >&2
    exit 1
    ;;
esac

case "$platform" in
  x86_64-unknown-linux-gnu) sha256="dce95e80c7fa404c1934100560c262381c9c95f08afaeb04e6856bdbabb36a3c" ;;
  *)
    echo "unsupported qlty release platform: $platform" >&2
    exit 1
    ;;
esac

asset="qlty-${platform}.tar.xz"
url="https://github.com/qltysh/qlty/releases/download/v${QLTY_VERSION}/${asset}"
install_dir="${HOME}/.local/bin"
installed_qlty="${install_dir}/qlty"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

mkdir -p "$install_dir"

if [ -x "$installed_qlty" ] && "$installed_qlty" --version | grep -Eq "(^| )${QLTY_VERSION}($| )"; then
  exit 0
fi

curl -fsSL "$url" -o "${tmp_dir}/${asset}"
actual_sha256="$(sha256_file "${tmp_dir}/${asset}")"
if [ "$actual_sha256" != "$sha256" ]; then
  echo "qlty checksum mismatch for $asset" >&2
  exit 1
fi

tar -xJf "${tmp_dir}/${asset}" -C "$tmp_dir" "${asset%.tar.xz}/qlty"
install -m 0755 "${tmp_dir}/${asset%.tar.xz}/qlty" "$installed_qlty"

if ! "$installed_qlty" --version | grep -Eq "(^| )${QLTY_VERSION}($| )"; then
  echo "installed qlty version mismatch" >&2
  exit 1
fi
