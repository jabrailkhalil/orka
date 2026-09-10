#!/bin/bash
set -euo pipefail

echo "Installing Kubebuilder development tools..."

ARCH=$(go env GOARCH)

# Install Bun (pinned to the version used by the UI test job)
PINNED_BUN_VERSION="1.3.13"
BUN_PATH=$(type -P bun || true)
if [ -z "${BUN_PATH}" ] || [ "$(bun --version)" != "${PINNED_BUN_VERSION}" ]; then
  case "${ARCH}" in
    amd64)
      BUN_ARCH=x64
      if ! grep -qw avx2 /proc/cpuinfo; then
        BUN_ARCH=x64-baseline
      fi
      ;;
    arm64) BUN_ARCH=aarch64 ;;
    *) echo "ERROR: Bun is not supported on linux-${ARCH}" >&2; exit 1 ;;
  esac
  if ! command -v unzip &> /dev/null; then
    apt-get update >/dev/null
    apt-get install -y --no-install-recommends unzip >/dev/null
  fi
  echo "Installing Bun ${PINNED_BUN_VERSION} (linux-${BUN_ARCH})..."
  curl -fsSL "https://github.com/oven-sh/bun/releases/download/bun-v${PINNED_BUN_VERSION}/bun-linux-${BUN_ARCH}.zip" -o /tmp/bun.zip \
    || { echo "ERROR: failed to download Bun ${PINNED_BUN_VERSION} for linux-${BUN_ARCH}" >&2; exit 1; }
  unzip -o /tmp/bun.zip -d /usr/local
  chmod +x "/usr/local/bun-linux-${BUN_ARCH}/bun"
  ln -sf "/usr/local/bun-linux-${BUN_ARCH}/bun" /usr/local/bin/bun
  # Keep an existing Bun earlier on PATH pinned in subsequent shells too.
  if [ -n "${BUN_PATH}" ] && ! [ "${BUN_PATH}" -ef /usr/local/bin/bun ]; then
    ln -sf /usr/local/bin/bun "${BUN_PATH}"
  fi
  rm -f /tmp/bun.zip
fi
if [ "$(bun --version)" != "${PINNED_BUN_VERSION}" ]; then
  echo "ERROR: Bun ${PINNED_BUN_VERSION} is not the active version on PATH" >&2
  exit 1
fi

# Install kind
if ! command -v kind &> /dev/null; then
  curl -Lo ./kind "https://kind.sigs.k8s.io/dl/latest/kind-linux-${ARCH}"
  chmod +x ./kind
  mv ./kind /usr/local/bin/kind
fi

# Install kubebuilder
if ! command -v kubebuilder &> /dev/null; then
  curl -L -o kubebuilder "https://go.kubebuilder.io/dl/latest/linux/${ARCH}"
  chmod +x kubebuilder
  mv kubebuilder /usr/local/bin/
fi

# Install kubectl
if ! command -v kubectl &> /dev/null; then
  KUBECTL_VERSION=$(curl -L -s https://dl.k8s.io/release/stable.txt)
  curl -LO "https://dl.k8s.io/release/${KUBECTL_VERSION}/bin/linux/${ARCH}/kubectl"
  chmod +x kubectl
  mv kubectl /usr/local/bin/kubectl
fi

# Wait for Docker to be ready
for i in {1..30}; do
  if docker info >/dev/null 2>&1; then
    break
  fi
  if [ $i -eq 30 ]; then
    echo "WARNING: Docker not ready after 30s"
  fi
  sleep 1
done

# Create kind network, ignore errors if exists or conflicts
docker network inspect kind >/dev/null 2>&1 || docker network create kind || true

# Verify installations
echo "Installed versions:"
bun --version
kind version
kubebuilder version
kubectl version --client
docker --version
go version

echo "DevContainer ready!"
