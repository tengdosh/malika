# Deployment

Three clients write to this repository, and one loop publishes all of them.

```
CMS  (/cms)        writes files into the server's working copy, commits nothing
bot  (Telegram)    commits and pushes from its own checkout
GitHub             anything pushed by hand arrives on origin/main
                              │
                              ▼
                  deploy/publish-loop.sh
              commit → pull → validate → build → push → restart
```

Install:

```sh
sudo cp deploy/publish-loop.sh /usr/local/sbin/malika-deploy.sh
sudo cp deploy/malika-deploy.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now malika-deploy.timer
```

## Why the order matters

Two rules, in this order of importance:

**1. Never discard uncommitted work.** The CMS in `local` storage writes files
and commits nothing, so anything Malika has just saved exists only as a dirty
working tree until the loop runs. An earlier version of this script began with
`git reset --hard origin/main`, which would have deleted a post she had written
minutes before. That is the single most expensive failure this system can
produce.

**2. Never publish content that does not build.** The first working version
committed, pushed, and *then* built. A broken entry therefore reached
`origin/main` and every other client before anyone discovered it, and the site
quietly stopped updating — the exact failure this project exists to prevent, and
one nobody would have been told about. Validation now happens before the push.

`astro sync` is the gate rather than a full build: it parses every content entry
and, unlike a build, leaves `dist/` untouched when it fails, so the previous
build keeps serving while the problem is fixed.

## When it fails

The unit exits non-zero and `systemctl status malika-deploy` shows why.

| Message | What happened | State |
|---|---|---|
| `CONTENT DOES NOT VALIDATE` | An entry has bad frontmatter | Committed locally, not pushed. Site serving the previous build. |
| `BUILD FAILED` | Content is valid but the build broke | Same. |
| `CONFLICT with origin/main` | Two clients changed the same file | Rebase aborted, nothing discarded. Resolve by hand. |
| `push failed` | Network or credentials | Committed locally; the next run retries. |

Nothing in this table loses work. If one of them ever does, that is a bug worth
treating as urgent.

## Environment

| File | Read by | Holds |
|---|---|---|
| `/etc/malika.env` | `malika.service` (runtime) | `ADMIN_USER`, `ADMIN_PASSWORD` |
| `/etc/malika-build.env` | the publish loop (build time) | analytics, `PUBLIC_KEYSTATIC_STORAGE=local` |
| `/etc/malika-bot.env` | `malika-bot.service` | bot token, allowlist, analytics |

All three are `600` and owned by root. None of them belong in this repository —
see `.env.example` for the shape.

## The working copy needs push access

The loop pushes, so `/var/www/<site>` needs a git identity with write access —
an SSH deploy key is the usual arrangement:

```sh
git -C /var/www/<site> remote set-url origin git@github.com:<owner>/<repo>
git -C /var/www/<site> config core.sshCommand 'ssh -i /path/to/key -o IdentitiesOnly=yes'
```

It must not be a shallow clone; `git fetch --unshallow` once if it is, or the
rebase and push in the loop cannot work.
