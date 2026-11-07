#!/bin/sh
# Block commits that look like they contain credentials.
#
# Usage: sh .githooks/check-secrets.sh [files...]
# With no arguments it falls back to the staged files.
#
# Note: filenames containing spaces are not handled perfectly — this is a
# best-effort net, not a substitute for secret scanning in CI.

files="$*"
[ -z "$files" ] && files=$(git diff --cached --name-only --diff-filter=ACMR)
[ -z "$files" ] && exit 0

# Common credential formats + private key headers.
pattern='(AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)'

hit=0
for f in $files; do
  [ -f "$f" ] || continue
  if grep -nEI "$pattern" "$f" >/dev/null 2>&1; then
    echo "✖ Possible secret in: $f"
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

exit 0
