#!/usr/bin/env bash
#
# Rebuild and (optionally) restart. Intended to be driven by the server's own
# scheduler once a day, so baked-in view counts stay current between posts.
#
# This script deliberately knows nothing about the process manager. Set
# RESTART_COMMAND to whatever the server uses; leave it unset and this only
# rebuilds, which is safe to run anywhere.
#
#   RESTART_COMMAND='systemctl restart <unit>' scripts/rebuild.sh
#
# Build-time environment (SITE_ORIGIN, analytics credentials, …) must already be
# present — see README > Deployment.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> building"
pnpm install --frozen-lockfile --prod=false
pnpm build

if [ -n "${RESTART_COMMAND:-}" ]; then
  echo "==> restarting: ${RESTART_COMMAND}"
  eval "${RESTART_COMMAND}"
else
  echo "==> RESTART_COMMAND not set; built only. The running server still serves the previous build."
fi

echo "==> done"
