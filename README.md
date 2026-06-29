# agent-skills

Monorepo of agent skills used by all coding agents in the fleet.

This repo is the **single source of truth** for the skills listed below.
On every machine, each agent's global skills directory (e.g. `~/.claude/skills/`,
`~/.aider-desk/skills/`, etc.) is a junction/symlink pointing at this repo,
so editing a skill once updates every agent.

## Skills

Top-level directories — one per skill:

- `develop-userscripts/`
- `frontend-design/`
- `grill-me/`
- `karpathy-guidelines/`
- `playwright-cli/`
- `playwright-persistent-sessions/`
- `smithery-ai-cli/`

(See top-level dirs for the live set — this list is informative; the script reads the filesystem.)

## Setup

This repo lives as a git submodule of [oriz](https://github.com/oriz-org/workspace)
at `repos/own/infra/agent-skills/`. After `git submodule update` on a new
machine, wire it into every supported agent:

```bash
node repos/own/infra/agent-skills/scripts/wire-skills.mjs --workspaces C:\D\oriz
```

(Older `scripts/link.sh` still works for the 2-target Claude+agents flow — kept for compatibility.)

### `wire-skills.mjs` — 60+ agent registry, single command

What it does:

1. **Creates global junctions** at every agent's expected skills directory (`~/.claude/skills`, `~/.aider-desk/skills`, `~/.codeium/windsurf/skills`, etc.) pointing at this repo.
2. **Deletes project-path skill dirs** from the workspaces you pass — skills live globally only, not per-project.
3. **Refuses to clobber real directories** by default. Add `--force` to wipe and replace (irreversible).

Flags:

| Flag | Effect |
|---|---|
| `--workspaces <p1,p2>` | Workspaces to scan for project-path skill dirs to delete. Default: CWD. |
| `--force` | Wipe real directories (recursively) at target paths. Without it, the script refuses and reports. |
| `--dry-run` | Print the plan; write nothing. |
| `--json` | Machine-readable output. |

The agent registry is baked into the script (one line per agent). Add a new agent by adding an entry to `REGISTRY` and re-running.

### Recommended invocation order

```bash
# 1. See what would happen
node scripts/wire-skills.mjs --dry-run --workspaces C:\D\oriz

# 2. Run for real (refuses real dirs)
node scripts/wire-skills.mjs --workspaces C:\D\oriz

# 3. If refusals reported, decide whether to force
node scripts/wire-skills.mjs --force --workspaces C:\D\oriz
```

### Windows notes

`wire-skills.mjs` uses `cmd /c mklink /J` to create directory junctions on Windows — no Developer Mode required, works for non-admin.

`scripts/link.sh` (legacy) uses `mklink /D` for symbolic links — needs Developer Mode.

## Editing a skill

Edit files in this checkout directly — every agent's `<global>/skills/<skill>/` sees the change immediately via its junction. Commit and push from this directory; the `oriz` superproject tracks the submodule pointer.

## Adding a new skill

1. Drop a new top-level directory `<new-skill>/` into this repo.
2. Commit and push.
3. The new skill appears in every agent's skills list automatically (no rerun of `wire-skills.mjs` needed — the junction targets this repo's root, so new top-level dirs are picked up live).

## Adding a new agent

1. Add an entry to the `REGISTRY` array in `scripts/wire-skills.mjs` with the agent's project and global skill-dir paths.
2. Commit + push.
3. On each machine, re-run `wire-skills.mjs` to create the junction for the new agent.

## Removing an agent

1. Remove its entry from `REGISTRY`.
2. Re-run `wire-skills.mjs` — orphan detection deletes the junction (but never touches real directories).
