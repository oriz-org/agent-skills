# agent-skills

Monorepo of agent skills used by both Claude Code and the cross-agent harness.

This repo is the **single source of truth** for the skills listed below.
On every machine, `~/.claude/skills/<skill>` and `~/.agents/skills/<skill>`
are symlinks pointing into this checkout, so editing a skill once updates
both harnesses.

## Skills

Top-level directories — one per skill:

- `develop-userscripts/`
- `frontend-design/`
- `github-actions-docs/`
- `grill-me/`
- `karpathy-guidelines/`
- `playwright-cli/`
- `secure-linux-web-hosting/`
- `smithery-ai-cli/`
- `use-my-browser/`
- `webapp-testing/`
- `web-design-reviewer/`

## Setup

This repo lives as a git submodule of [oriz](https://github.com/oriz-org/oriz)
at `repos/oriz/own/content/skills/agent-skills/`. After `git submodule update`
on a new machine:

```bash
bash repos/oriz/own/content/skills/agent-skills/scripts/link.sh
```

That script creates the symlinks into `~/.claude/skills/` and
`~/.agents/skills/`. It is idempotent and refuses to clobber any real
directory already at the target path — clean those up manually first.

### Windows notes

`scripts/link.sh` shells out to `cmd /c mklink /D` on Windows. Requires
**Developer Mode** (Settings → For developers → Developer Mode) for non-admin
symlink creation. Run it from Git Bash.

## Editing a skill

Edit files in this checkout directly — both `~/.claude/skills/<skill>` and
`~/.agents/skills/<skill>` see the change immediately via the symlinks.
Commit and push from this directory; the oriz superproject tracks the
submodule pointer.

## Adding a new skill

1. Drop a new top-level directory `<new-skill>/` into this repo.
2. Commit and push.
3. Re-run `scripts/link.sh` on each machine to create the new symlinks.
