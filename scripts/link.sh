#!/usr/bin/env bash
# Symlink every top-level skill dir in this monorepo into
# ~/.claude/skills/<skill> AND ~/.agents/skills/<skill>.
#
# Idempotent. Refuses to clobber real directories.
#
# Windows: uses `cmd /c mklink /D` (requires Developer Mode for non-admin).
# macOS/Linux: uses `ln -s`.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Detect Windows (Git Bash / MSYS / Cygwin)
IS_WINDOWS=0
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) IS_WINDOWS=1 ;;
esac

TARGET_DIRS=(
  "$HOME/.claude/skills"
  "$HOME/.agents/skills"
)

# Discover skills: every top-level dir except /scripts and dotfiles.
mapfile -t SKILLS < <(
  cd "$REPO_ROOT"
  for d in */; do
    name="${d%/}"
    [[ "$name" == "scripts" ]] && continue
    [[ "$name" == .* ]] && continue
    echo "$name"
  done | sort
)

# Convert a Unix-style path to a Windows path for mklink.
to_winpath() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
  else
    echo "$1"
  fi
}

# Create one symlink. $1 = target (link path), $2 = source (real path).
make_symlink() {
  local target="$1" source="$2"
  if [[ $IS_WINDOWS -eq 1 ]]; then
    local win_target win_source
    win_target="$(to_winpath "$target")"
    win_source="$(to_winpath "$source")"
    cmd //c "mklink /D \"$win_target\" \"$win_source\"" >/dev/null
  else
    ln -s "$source" "$target"
  fi
}

# Check whether $1 is already a symlink that resolves to $2.
already_linked() {
  local link="$1" want="$2"
  [[ -L "$link" ]] || return 1
  local cur
  cur="$(readlink "$link" 2>/dev/null || true)"
  # Normalize: readlink on Windows may return either Unix or Windows path
  [[ "$cur" == "$want" || "$cur" == "$(to_winpath "$want")" ]]
}

ok=0
skipped=0
linked=0
refused=0

for target_root in "${TARGET_DIRS[@]}"; do
  mkdir -p "$target_root"
done

for skill in "${SKILLS[@]}"; do
  source="$REPO_ROOT/$skill"
  [[ -d "$source" ]] || { echo "skip (not a dir): $skill"; continue; }

  for target_root in "${TARGET_DIRS[@]}"; do
    target="$target_root/$skill"

    if already_linked "$target" "$source"; then
      echo "ok:      $target  (already linked)"
      ((skipped++))
      continue
    fi

    if [[ -L "$target" ]]; then
      # Symlink, but points elsewhere — replace it.
      rm "$target"
    elif [[ -e "$target" ]]; then
      echo "REFUSE:  $target exists as a real directory."
      echo "         Inspect and remove it manually, then re-run."
      echo "         (Suggested: rm -rf \"$target\"  — only if you have committed any local changes upstream.)"
      ((refused++))
      continue
    fi

    make_symlink "$target" "$source"
    echo "linked:  $target -> $source"
    ((linked++))
  done
done

echo
echo "Summary: $linked created, $skipped already-linked, $refused refused"
[[ $refused -gt 0 ]] && exit 1
exit 0
