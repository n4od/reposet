#!/bin/sh
# Block staged files larger than LIMIT_BYTES (default 1 MiB).
# Large binaries belong in Git LFS or in release artifacts, not in history.
#
# Usage: sh .githooks/check-large-files.sh
# Override: LIMIT_BYTES=5242880 git commit ...

LIMIT=${LIMIT_BYTES:-1048576}
files=$(git diff --cached --name-only --diff-filter=ACMR)
[ -z "$files" ] && exit 0

hit=0
for f in $files; do
  [ -f "$f" ] || continue
  size=$(wc -c < "$f" | tr -d '[:space:]')
  if [ "$size" -gt "$LIMIT" ]; then
    echo "✖ Large file: $f ($size bytes, limit $LIMIT)"
    hit=1
  fi
done

if [ "$hit" -eq 1 ]; then
  echo ""
  echo "Commit blocked. Use Git LFS, or commit with: git commit --no-verify"
  exit 1
fi

exit 0
