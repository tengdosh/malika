#!/usr/bin/env bash
# Deploy to tengdosh.uzjoku.uz/malika (Astro SSR behind nginx, systemd unit "malika").
#
# The site is served from a SUBPATH under another domain, so SITE_BASE and the
# noindex flag are not optional — a build without them serves every link at the
# wrong path and invites Google to index the content under two hostnames.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env.deploy ] || { echo "missing .env.deploy — see README > Deployment"; exit 1; }
set -a; . ./.env.deploy; set +a

echo "==> building for ${SITE_ORIGIN}${SITE_BASE}"
pnpm build

echo "==> restarting service"
sudo systemctl restart malika.service
sleep 3
systemctl is-active --quiet malika.service || { echo "service failed to start"; exit 1; }

echo "==> smoke test"
fail=0
for path in "${SITE_BASE}" "${SITE_BASE}/yozuvlar" "${SITE_BASE}/rss.xml" "/keystatic"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${SITE_ORIGIN#https://}" "http://127.0.0.1${path}")
  printf '    %-28s %s\n' "$path" "$code"
  [ "$code" = "200" ] || fail=1
done
# The admin must ask for a password. A 200 here means the nginx auth block is gone.
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${SITE_ORIGIN#https://}" "http://127.0.0.1${SITE_BASE}/admin/statistika")
printf '    %-28s %s (expect 401)\n' "${SITE_BASE}/admin/statistika" "$code"
[ "$code" = "401" ] || { echo "!! admin is NOT password protected"; fail=1; }

[ "$fail" = "0" ] && echo "==> deployed" || { echo "==> smoke test FAILED"; exit 1; }
