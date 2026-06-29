#!/usr/bin/env node
/**
 * wire-skills.mjs
 *
 * Single-source-of-truth skills wiring for 60+ coding agents.
 *
 * What it does:
 *   1. For each agent in the registry, create a junction/symlink at the
 *      agent's GLOBAL skills path (e.g. ~/.claude/skills, ~/.aider-desk/skills)
 *      pointing at this repo (the canonical skills monorepo).
 *   2. For each skill in this repo, ALSO create per-skill symlinks at the
 *      agent's global path (some agents expect `<global>/<skill>/SKILL.md`,
 *      others accept `<global> -> repo`). We default to repo-level junction
 *      because it auto-picks-up newly-added skills.
 *   3. Delete any PROJECT-path skills directories the agent might create in
 *      a workspace (e.g. <workspace>/.kilocode/skills/) — per user locked
 *      decision: skills live globally only, never per-project.
 *   4. Detect orphan symlinks (link points at an old/dead path or agent was
 *      removed from registry) and remove them. Never touches real directories.
 *
 * Flags:
 *   --workspaces <p1,p2>  comma-separated workspaces to clean project-paths in.
 *                         Default: current working directory only.
 *   --force               wipe real directories (recursively) at target paths
 *                         when they're in the way. Default: refuse and report.
 *   --dry-run             show what would happen; write nothing.
 *   --json                output a machine-readable result table.
 *
 * Manual invocation only. No auto-trigger.
 *
 * Run from this repo:
 *   node scripts/wire-skills.mjs [--workspaces C:/D/oriz,C:/some/other] [--dry-run]
 *
 * See: AGENTS.md (oriz workspace) — agent-fleet-parity rule.
 */

import { readdirSync, lstatSync, readlinkSync, realpathSync, unlinkSync, rmdirSync, rmSync, mkdirSync, existsSync, symlinkSync } from 'fs';
import { homedir } from 'os';
import { join, resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..').replace(/\\/g, '/');
const HOME = homedir().replace(/\\/g, '/');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const AS_JSON = args.includes('--json');
const FORCE = args.includes('--force');
const wsArg = args.find(a => a.startsWith('--workspaces'));
const WORKSPACES = wsArg
  ? wsArg.split('=')[1]?.split(',').map(s => s.trim().replace(/\\/g, '/')) ??
    args[args.indexOf(wsArg) + 1]?.split(',').map(s => s.trim().replace(/\\/g, '/'))
  : [process.cwd().replace(/\\/g, '/')];

const IS_WIN = process.platform === 'win32';

// ── Agent registry (locked 2026-06-29) ────────────────────────────
// Format: { name, project, global }
// `project` = path under a workspace where this agent looks for skills.
// `global`  = path under HOME where this agent looks for skills.
// `null`    = agent does not use that surface.
//
// Sourced from chirag127/skills 60-agent reference.
const REGISTRY = [
  { name: 'aider-desk',       project: '.aider-desk/skills',     global: '.aider-desk/skills' },
  { name: 'amp',              project: '.agents/skills',         global: '.config/agents/skills' },
  { name: 'antigravity',      project: '.agents/skills',         global: '.gemini/antigravity/skills' },
  { name: 'antigravity-cli',  project: '.agents/skills',         global: '.gemini/antigravity-cli/skills' },
  { name: 'astrbot',          project: 'data/skills',            global: '.astrbot/data/skills' },
  { name: 'autohand-code',    project: '.autohand/skills',       global: '.autohand/skills' },
  { name: 'augment',          project: '.augment/skills',        global: '.augment/skills' },
  { name: 'bob',              project: '.bob/skills',            global: '.bob/skills' },
  { name: 'claude-code',      project: '.claude/skills',         global: '.claude/skills' },
  { name: 'openclaw',         project: 'skills',                 global: '.openclaw/skills' },
  { name: 'cline',            project: '.agents/skills',         global: '.agents/skills' },
  { name: 'dexto',            project: '.agents/skills',         global: '.agents/skills' },
  { name: 'kimi-code-cli',    project: '.agents/skills',         global: '.agents/skills' },
  { name: 'loaf',             project: '.agents/skills',         global: '.agents/skills' },
  { name: 'warp',             project: '.agents/skills',         global: '.agents/skills' },
  { name: 'zed',              project: '.agents/skills',         global: '.agents/skills' },
  { name: 'codearts-agent',   project: '.codeartsdoer/skills',   global: '.codeartsdoer/skills' },
  { name: 'codebuddy',        project: '.codebuddy/skills',      global: '.codebuddy/skills' },
  { name: 'qwen-code',        project: '.qwen/skills',           global: '.qwen/skills' },
  { name: 'reasonix',         project: '.reasonix/skills',       global: '.reasonix/skills' },
  { name: 'rovodev',          project: '.rovodev/skills',        global: '.rovodev/skills' },
  { name: 'roo',              project: '.roo/skills',            global: '.roo/skills' },
  { name: 'tabnine-cli',      project: '.tabnine/agent/skills',  global: '.tabnine/agent/skills' },
  { name: 'terramind',        project: '.terramind/skills',      global: '.terramind/skills' },
  { name: 'tinycloud',        project: '.tinycloud/skills',      global: '.tinycloud/skills' },
  { name: 'trae',             project: '.trae/skills',           global: '.trae/skills' },
  { name: 'trae-cn',          project: '.trae/skills',           global: '.trae-cn/skills' },
  { name: 'windsurf',         project: '.windsurf/skills',       global: '.codeium/windsurf/skills' },
  { name: 'zencoder',         project: '.zencoder/skills',       global: '.zencoder/skills' },
  { name: 'zenflow',          project: '.zencoder/skills',       global: '.zencoder/skills' },
  { name: 'neovate',          project: '.neovate/skills',        global: '.neovate/skills' },
  { name: 'pochi',            project: '.pochi/skills',          global: '.pochi/skills' },
  { name: 'promptscript',     project: '.agents/skills',         global: null },
  { name: 'adal',             project: '.adal/skills',           global: '.adal/skills' },
  { name: 'opencode',         project: '.opencode/skills',       global: '.opencode/skills' },
  { name: 'kilocode',         project: '.kilocode/skills',       global: '.kilocode/skills' },
  { name: 'gemini-cli',       project: '.gemini/skills',         global: '.gemini/skills' },
  { name: 'aider',            project: '.aider/skills',          global: '.aider/skills' },
  { name: 'continue',         project: '.continue/skills',       global: '.continue/skills' },
  { name: 'goose',            project: '.goose/skills',          global: '.goose/skills' },
  { name: 'cursor',           project: '.cursor/skills',         global: '.cursor/skills' },
  { name: 'cody',             project: '.cody/skills',           global: '.cody/skills' },
  { name: 'codex',            project: '.codex/skills',          global: '.codex/skills' },
  { name: 'crush',            project: '.crush/skills',          global: '.crush/skills' },
  { name: 'droid',            project: '.droid/skills',          global: '.droid/skills' },
  { name: 'junie',            project: '.junie/skills',          global: '.junie/skills' },
  { name: 'kiro',             project: '.kiro/skills',           global: '.kiro/skills' },
  { name: 'iflow',            project: '.iflow/skills',          global: '.iflow/skills' },
];

// ── Filesystem helpers ─────────────────────────────────────────────
// On Windows: junctions report isSymbolicLink()=false but lstat sets a
// reparse-point flag; readlinkSync THROWS on junctions (only works on
// symlinks). We use realpathSync to resolve where the path goes and
// compare to the expected target.
function isLink(p) {
  try {
    const st = lstatSync(p);
    if (st.isSymbolicLink()) return true;
    // Junction heuristic on Windows: directory whose realpath differs from itself
    if (IS_WIN && st.isDirectory()) {
      try {
        const real = realpathSync(p).replace(/\\/g, '/');
        return real.toLowerCase() !== p.replace(/\\/g, '/').toLowerCase();
      } catch { return false; }
    }
    return false;
  } catch { return false; }
}
function linkTarget(p) {
  try { return realpathSync(p).replace(/\\/g, '/'); } catch { return null; }
}
function isManagedLink(p, expectedTarget) {
  if (!isLink(p)) return false;
  const t = linkTarget(p);
  if (!t) return false;
  return t.toLowerCase() === expectedTarget.toLowerCase();
}
function isRealDir(p) {
  try {
    const st = lstatSync(p);
    if (!st.isDirectory()) return false;
    if (st.isSymbolicLink()) return false;
    return !isLink(p);  // not a junction either
  } catch { return false; }
}
function mkParent(p) {
  if (DRY) return;
  mkdirSync(dirname(p), { recursive: true });
}
function makeJunction(linkPath, targetPath) {
  if (DRY) return;
  mkParent(linkPath);
  if (IS_WIN) {
    // mklink /J creates a junction (works for dirs without admin).
    const lp = linkPath.replace(/\//g, '\\');
    const tp = targetPath.replace(/\//g, '\\');
    execSync(`cmd /c mklink /J "${lp}" "${tp}"`, { stdio: 'pipe' });
  } else {
    symlinkSync(targetPath, linkPath, 'dir');
  }
}
function removeLink(p) {
  if (DRY) return;
  try {
    if (IS_WIN && isLink(p)) {
      // Junction on Windows: rmdir (or unlink for symlinks)
      try { rmdirSync(p); } catch { unlinkSync(p); }
    } else {
      unlinkSync(p);
    }
  } catch (e) {
    try { rmdirSync(p); } catch {}
  }
}

// ── Plan + execute ─────────────────────────────────────────────────
const results = {
  globalCreated: [],
  globalKept: [],
  globalRefused: [],
  projectDeleted: [],
  projectRefused: [],
};

// 1) GLOBAL paths: create junction <HOME>/<global> -> REPO_ROOT
const seenGlobals = new Set();
for (const agent of REGISTRY) {
  if (!agent.global) continue;
  const linkPath = join(HOME, agent.global).replace(/\\/g, '/');
  if (seenGlobals.has(linkPath)) continue;  // multiple agents may share e.g. ~/.agents/skills
  seenGlobals.add(linkPath);

  if (isManagedLink(linkPath, REPO_ROOT)) {
    results.globalKept.push({ agent: agent.name, path: linkPath });
    continue;
  }
  if (existsSync(linkPath)) {
    if (isRealDir(linkPath)) {
      if (!FORCE) {
        results.globalRefused.push({ agent: agent.name, path: linkPath, reason: 'real directory exists; rerun with --force to wipe and replace' });
        continue;
      }
      // FORCE: rmdir recursively
      if (!DRY) {
        try {
          rmSync(linkPath, { recursive: true, force: true });
        } catch (e) {
          results.globalRefused.push({ agent: agent.name, path: linkPath, reason: `--force rm failed: ${e.message}` });
          continue;
        }
      }
    } else {
      removeLink(linkPath);
    }
  }
  try {
    makeJunction(linkPath, REPO_ROOT);
    results.globalCreated.push({ agent: agent.name, path: linkPath, target: REPO_ROOT });
  } catch (e) {
    results.globalRefused.push({ agent: agent.name, path: linkPath, reason: e.message });
  }
}

// 2) PROJECT paths in each workspace: DELETE any that exist (dedupe by path)
for (const ws of WORKSPACES) {
  const seenProject = new Set();
  for (const agent of REGISTRY) {
    if (!agent.project) continue;
    const p = join(ws, agent.project).replace(/\\/g, '/');
    if (seenProject.has(p)) continue;
    seenProject.add(p);
    if (!existsSync(p)) continue;

    if (isLink(p)) {
      removeLink(p);
      results.projectDeleted.push({ workspace: ws, path: p, kind: 'link' });
    } else if (isRealDir(p)) {
      if (!FORCE) {
        results.projectRefused.push({ workspace: ws, path: p, reason: 'real directory; rerun with --force to wipe' });
      } else {
        if (!DRY) {
          try { rmSync(p, { recursive: true, force: true }); }
          catch (e) {
            results.projectRefused.push({ workspace: ws, path: p, reason: `--force rm failed: ${e.message}` });
            continue;
          }
        }
        results.projectDeleted.push({ workspace: ws, path: p, kind: 'dir (--force)' });
      }
    }
  }
}

// ── Report ─────────────────────────────────────────────────────────
if (AS_JSON) {
  console.log(JSON.stringify(results, null, 2));
} else {
  const tag = DRY ? '[dry-run] ' : '';
  console.log(`\n${tag}🪝 Global skills junctions`);
  console.log(`  created : ${results.globalCreated.length}`);
  for (const r of results.globalCreated) console.log(`    + ${r.path}`);
  console.log(`  kept    : ${results.globalKept.length} (already linked)`);
  console.log(`  refused : ${results.globalRefused.length}`);
  for (const r of results.globalRefused) console.log(`    ! ${r.path}  — ${r.reason}`);

  console.log(`\n${tag}🧹 Project-path skill dirs`);
  console.log(`  deleted : ${results.projectDeleted.length}`);
  for (const r of results.projectDeleted) console.log(`    - ${r.path}`);
  console.log(`  refused : ${results.projectRefused.length} (real dirs; manual cleanup)`);
  for (const r of results.projectRefused) console.log(`    ! ${r.path}  — ${r.reason}`);

  console.log(`\nAgents in registry: ${REGISTRY.length}`);
  console.log(`Workspaces scanned: ${WORKSPACES.length} (${WORKSPACES.join(', ')})`);
}

process.exit(results.globalRefused.length + results.projectRefused.length > 0 ? 1 : 0);
