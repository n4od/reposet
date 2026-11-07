#!/bin/sh
# Enforce Conventional Commits on the commit subject line.
# Docs: https://www.conventionalcommits.org
#
# Usage: sh .githooks/commit-msg.sh .git/COMMIT_EDITMSG
# Git passes the path to the message file as the first argument.

msg_file="$1"
[ -f "$msg_file" ] || exit 0

# First line that is not a comment and not blank.
subject=$(grep -v '^#' "$msg_file" | sed '/^[[:space:]]*$/d' | head -n 1)
[ -z "$subject" ] && exit 0

# Let git's own generated messages through.
case "$subject" in
  "Merge "* | "Revert "* | "fixup! "* | "squash! "*) exit 0 ;;
esac

# type(optional scope)!: description
pattern='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._ -]+\))?!?: .+'

if ! printf '%s' "$subject" | grep -qE "$pattern"; then
  echo ""
  echo "✖ Commit message does not follow Conventional Commits."
  echo ""
  echo "    Got:      $subject"
  echo "    Expected: <type>(<scope>): <description>"
  echo "    Example:  feat(auth): add password reset flow"
  echo ""
  echo "    Types: feat fix docs style refactor perf test build ci chore revert"
  echo ""
  exit 1
fi

exit 0
