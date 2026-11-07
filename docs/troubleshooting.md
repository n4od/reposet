# Troubleshooting

Symptom first. If your problem is not here, [open a bug report](../.github/ISSUE_TEMPLATE/bug_report.yml)
with the command you ran and its output.

- [Git hooks](#git-hooks)
- [Windows](#windows)
- [CLI](#cli)
- [GitHub Actions](#github-actions)
- [Git and GitHub](#git-and-github)

## Git hooks

### Nothing happens when I commit

Hooks are not committed; every clone opts in once.

```bash
lefthook install
```

Confirm the hook files exist in `.git/hooks/` and that `lefthook.yml` sits in the
repository root. If Lefthook is not installed at all, see the next section.

### `lefthook: command not found`

```powershell
winget install evilmartians.lefthook   # Windows
```

```bash
brew install lefthook                  # macOS
npm i -D lefthook                      # any OS, per project
```

Then run `lefthook install` again.

### `sh: command not found` on Windows

Git hooks run through `sh`. Git for Windows ships `/usr/bin/sh`, and Lefthook
invokes it inside a Git context where it resolves — so `run: sh .githooks/...`
works even though `sh` is not on your PowerShell `PATH`. If it does not, you are
probably using a Git without Git for Windows' bash; reinstall Git for Windows and
keep "Git Bash Here" checked.

### A commit is blocked and I do not know why

Every command prints its `fail_text` on failure. The common causes:

- **Secret scan** — remove the credential. If it is a false positive, mark the
  line `gitleaks:allow`, add the finding to `.gitleaksignore`, or skip once with
  `LEFTHOOK=0 git commit ...`.
- **Large file** — anything over 1 MiB. Move it to Git LFS, or raise the limit:
  `LIMIT_BYTES=5242880 git commit ...`.
- **Commit message** — Conventional Commits are required: `feat:`, `fix(scope):`,
  `feat!:`. `Merge`, `Revert`, `fixup!` and `squash!` are exempt.

### gitleaks is not installed

The hook falls back to a small built-in pattern list and says so. That fallback
catches obvious cases (AWS, GitHub, Slack, Stripe-style keys) but is not a real
scanner. Install gitleaks when you can:

```powershell
winget install gitleaks
```

### I need to commit without the hooks

```bash
git commit --no-verify           # skip all git hooks once
LEFTHOOK=0 git commit -m "wip"   # skip Lefthook specifically
```

Both are fine locally. Do not treat them as policy — enforce in CI.

## Windows

### `npm.ps1 cannot be loaded because running scripts is disabled`

PowerShell's execution policy blocks npm's shim. Use the `.cmd` shim:

```powershell
npm.cmd install
npx.cmd reposet init
```

Or allow local scripts:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

### Every file shows as modified with CRLF changes

The `.gitattributes` recipe normalizes to LF. If files were committed before you
added it, renormalize:

```bash
git add --renormalize .
git commit -m "chore: normalise line endings"
```

### `build-templates.ps1` will not run

Pass the policy for this invocation only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/build-templates.ps1
```

## CLI

### `npx reposet` runs an old version, or 404s

Pin the latest explicitly:

```bash
npx reposet@latest --version
```

### It says "Not a git repository"

That is a warning, not an error — files are still written. Run `git init` first
if you want the hooks to be installable.

### I want to preview without writing

```bash
npx reposet init . --dry-run
npx reposet init . --yes --json     # machine-readable plan for CI
```

### Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Runtime error (for example, a path conflict between recipes) |
| `2` | Usage error (unknown recipe, unknown flag) |

### My files were overwritten

They should not be — the default is never to overwrite. Overwrites only happen
with `--force`. If you lost work, check your editor's local history or `git stash`.

## GitHub Actions

### CodeQL fails on a private repository

Code scanning needs a public repository or GitHub Advanced Security. On a private
repository without GHAS, either make it public or delete
`.github/workflows/codeql.yml`.

### A workflow fails with `403 Resource not accessible by integration`

The workflow token is read-only by default. Add the specific scope the job needs:

```yaml
permissions:
  contents: write
```

Grant the narrowest scope that works — never `write-all`.

### Dependabot is not opening pull requests for Actions

Check that `.github/dependabot.yml` includes `package-ecosystem: "github-actions"`,
and that Dependabot is enabled under Settings → Code security.

### The release workflow did not run

It triggers on tags. Push one:

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

### A required check is skipped on some pull requests

`paths` / `branches` filters can skip a job — and a skipped required check blocks
the merge. Either remove the filter or add a job that always runs.

## Git and GitHub

### My default branch is `master`

Some templates link to `main`. Rename it in Settings → Branches, then locally:

```bash
git branch -M main
git push -u origin main
```

### The labeler needs `pull_request_target`

The labeler recipe uses `pull_request_target` so it can label pull requests from
forks. That event runs with a privileged token — never check out and execute pull
request code in a `pull_request_target` workflow.