#!/bin/sh
# Secret scan for the pre-commit hook.
#
# Uses gitleaks when it is on PATH (recommended), otherwise falls back to the
# small pattern list below. The fallback only matches a handful of well-known
# token formats — it is NOT a replacement for a real scanner.
#
# Usage: sh .githooks/check-secrets.sh [files...]
# With no arguments it falls back to the staged files.
#
# Why a script instead of an inline `run:` block in lefthook.yml?
# Lefthook on Windows wraps a `run:` command in double quotes without escaping
# quotes inside it, so `echo "..."` in a multiline block breaks the hook.
# Keeping the logic in a file sidesteps that entirely.
#
# Set SECRET_SCAN_FALLBACK=1 to force the built-in patterns (used by the tests
# so they don't depend on whether gitleaks happens to be installed).

if [ -z "${SECRET_SCAN_FALLBACK:-}" ] && command -v gitleaks >/dev/null 2>&1; then
  gitleaks git --pre-commit --staged --redact --no-banner -v
  code=$?
  [ "$code" -eq 0 ] && exit 0
  [ "$code" -eq 1 ] && exit 1
  # gitleaks before 8.19 has no `git` subcommand; fall back to `protect`.
  gitleaks protect --staged --redact --no-banner -v
  exit $?
fi

files="$*"
[ -z "$files" ] && files=$(git diff --cached --name-only --diff-filter=ACMR)
[ -z "$files" ] && exit 0

# Common credential formats + private key headers.
pattern='(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'

hit=0
for f in $files; do
  [ -f "$f" ] || continue
  if grep -nEI "$pattern" "$f" >/dev/null 2>&1; then
    echo "Possible secret in: $f"
    grep -nEI "$pattern" "$f" | cut -c1-160 | sed 's/^/    /'
    hit=1
  fi
done

if [ "$hit" -eq 1 ]; then
  echo ""
  echo "Commit blocked. Remove the credential or move it to an environment variable."
  echo "False positive? Skip with: LEFTHOOK=0 git commit ..."
  exit 1
fi

echo "! gitleaks not installed — used the built-in pattern fallback."
echo "  Install it: winget install gitleaks   (or see README)"

exit 0
