#!/bin/bash
#
# Publish loop for every client at once.
#
#   CMS  writes files into this working copy and commits nothing
#   bot  commits and pushes from its own copy
#   edits from GitHub arrive on origin/main
#
# Two rules, in this order of importance:
#
#   1. Never discard uncommitted work. A post Malika just wrote in the admin is
#      the most expensive thing here.
#   2. Never PUBLISH content that does not build. Pushing a broken entry sends
#      it to every other client and stops the site updating — the exact failure
#      this project exists to prevent, and one nobody would be told about.
#
# So her edits are committed locally straight away (safe, private), validated,
# and only pushed once they are known to build. A failed validation leaves the
# commit sitting here, the previous build still serving, and the unit failed so
# `systemctl status malika-deploy` says so.
set -uo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
[ -f /etc/malika-build.env ] && set -a && . /etc/malika-build.env && set +a

SITE=/var/www/malika-bobonazarova.uz
cd "$SITE" || exit 1
git() { command git -c safe.directory="$SITE" "$@"; }
asmalika() { su malika -s /bin/bash -c "cd $SITE && $1"; }

before=$(git rev-parse HEAD)

# 1 — whatever the CMS wrote becomes a local commit. Not published yet.
if [ -n "$(git status --porcelain -- src/content src/assets)" ]; then
  echo "committing CMS edits"
  git add -- src/content src/assets
  git commit -q -m "content(cms): admin orqali tahrirlandi" || true
fi

# 2 — bring in everyone else's work. Needs a clean tree, hence step 1 first.
if git fetch -q origin main; then
  if ! git rebase -q origin/main; then
    git rebase --abort 2>/dev/null
    echo "CONFLICT with origin/main — resolve by hand. Nothing was discarded."
    exit 1
  fi
fi

ahead=$(git log --oneline origin/main..HEAD 2>/dev/null | wc -l)
after=$(git rev-parse HEAD)
[ "$before" = "$after" ] && [ "$ahead" = 0 ] && exit 0

# 3 — validate BEFORE publishing. `astro sync` parses every content entry and,
#     unlike a build, leaves dist/ alone if it fails, so the site keeps serving.
chown -R malika:malika "$SITE"
if ! asmalika "CI=true pnpm install --frozen-lockfile" >/dev/null 2>&1; then
  echo "install failed — not publishing"; exit 1
fi
if ! asmalika "pnpm exec astro sync" > /tmp/malika-validate.log 2>&1; then
  echo "CONTENT DOES NOT VALIDATE — not pushed, site untouched. Work is committed locally."
  tail -5 /tmp/malika-validate.log
  exit 1
fi

# 4 — build. Still not published if this fails.
if ! asmalika "pnpm fonts && pnpm build" > /tmp/malika-build.log 2>&1; then
  echo "BUILD FAILED — not pushed. Previous build still serving."
  tail -5 /tmp/malika-build.log
  exit 1
fi

# 5 — it builds, so it may be published.
if [ "$ahead" != 0 ]; then
  git push -q origin HEAD:main || echo "push failed; committed locally, will retry next run"
fi

systemctl restart malika
echo "published $after"
