# .github & Git hooks — template kit

Copy-paste templates for the repo plumbing every project ends up needing:
issue forms, PR templates, CI, Dependabot, security policy, code owners,
release notes, and git hooks that actually run on Windows.

Nothing here is language-specific. Every file has `TODO` comments where you
need to make a decision.

---

## How this folder works

```
.
├── recipes/                 ← cherry-pick ONE concern at a time
│   ├── 01-issue-forms/
│   │   └── .github/ISSUE_TEMPLATE/...
│   ├── 02-pr-template/
│   │   └── .github/pull_request_template.md
│   └── ...
└── templates/
    └── generic/             ← recipes 01–11 merged, ready to drop in whole
```

**The rule:** every recipe folder mirrors the layout of your *target repo*.
So you copy the **contents** of a recipe into the **root** of your repo — not
the recipe folder itself.

> Example: copy the contents of `recipes/01-issue-forms/` into `my-project/`,
> and you get `my-project/.github/ISSUE_TEMPLATE/bug_report.yml`.

## 60-second start

**Option A — do everything at once**

```powershell
Copy-Item "templates\generic\*" -Destination "C:\path\to\my-repo" -Recurse -Force
```

**Option B — cherry-pick**

```powershell
# copy just the issue forms into an existing repo
Copy-Item "recipes\01-issue-forms\*" -Destination "C:\path\to\my-repo" -Recurse -Force
```

**Option C — manual**

Open the recipe folder in Explorer and drag its contents into your repo.

**Then, in the target repo, spend 5 minutes here:**

1. Replace `OWNER/REPO`, `@your-username`, `security@example.com`,
   `conduct@example.com` — see the checklist at the bottom.
2. Create the labels the templates reference (one-time, see the label table).
3. If you took the hooks: `lefthook install`.

---

## Recipe index

| # | Recipe | Adds | Take it when |
|---|---|---|---|
| 01 | [`issue-forms`](recipes/01-issue-forms) | Bug + feature forms, no blank issues | Any public repo with issues |
| 02 | [`pr-template`](recipes/02-pr-template) | PR description + checklist | Always — highest ROI file here |
| 03 | [`community-health`](recipes/03-community-health) | SECURITY, CONTRIBUTING, CoC, SUPPORT, FUNDING | Any repo others touch |
| 04 | [`codeowners`](recipes/04-codeowners) | Auto-assigned reviewers by path | Teams, or protecting critical files |
| 05 | [`dependabot`](recipes/05-dependabot) | Automated dependency PRs | Always — ships with Actions updates enabled |
| 06 | [`ci-basic`](recipes/06-ci-basic) | CI skeleton + repo hygiene job | Any repo that isn't CI'd yet |
| 07 | [`security-scan`](recipes/07-security-scan) | CodeQL scanning | Public repos (free), or private with GHAS |
| 08 | [`stale-and-labeler`](recipes/08-stale-and-labeler) | Stale bot, auto-labeling | Busy issue trackers |
| 09 | [`release-notes`](recipes/09-release-notes) | Grouped changelog + tag→release | Anything you version |
| 10 | [`githooks-lefthook`](recipes/10-githooks-lefthook) | Secret/large-file guards, commit-msg lint | Local safety net before CI |
| 11 | [`root-files`](recipes/11-root-files) | `.editorconfig`, `.gitattributes`, `.gitignore` | Always — prevents CRLF hell |
| 12 | [`reusable-workflows`](recipes/12-reusable-workflows) | One CI definition, many callers | 3+ repos with the same pipeline |

### If you only do five things

1. `02-pr-template` — makes every future PR reviewable.
2. `11-root-files` — kills line-ending and encoding diffs forever.
3. `05-dependabot` — free security updates.
4. `06-ci-basic` — nothing merges untested.
5. `10-githooks-lefthook` — stops secrets before they hit history.

---

## Recipe notes

### 01 — Issue forms
`.github/ISSUE_TEMPLATE/{bug_report.yml, feature_request.yml, config.yml}`

- **Edit:** `OWNER/REPO` in `config.yml` (Discussions + private advisory URLs).
- **Gotcha:** labels in `labels: [...]` must already exist in the repo, or they're
  silently skipped. Create them first.
- **Gotcha:** each `body` entry needs a unique `id`. Don't duplicate one.
- `blank_issues_enabled: false` forces people through a form. If you want the
  free-form option too, set it to `true`.
- Preview with the **Issues → New issue** button after pushing to your default branch.

### 02 — PR template
`.github/pull_request_template.md`

- Applies automatically to every new PR. No configuration needed.
- It's markdown — edit freely. Keep it under ~40 lines or people delete it.
- Want multiple templates? Rename the file to
  `.github/PULL_REQUEST_TEMPLATE/bugfix.md` etc., then append
  `?template=bugfix.md` to the PR URL.

### 03 — Community health
`.github/{SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, SUPPORT.md, FUNDING.yml}`

- **Edit:** `OWNER/REPO`, `security@example.com`, `conduct@example.com`.
- GitHub surfaces these in the **Community Standards** tab and links them from
  the new-issue chooser automatically.
- `FUNDING.yml` only does something once GitHub Sponsors / a platform is set up.
  Delete it if you don't want a Sponsor button.
- The CoC is a summary that links the authoritative Contributor Covenant 2.1.

### 04 — CODEOWNERS
`.github/CODEOWNERS`

- **Edit:** every `@your-username`.
- Rules are matched **bottom-up**, last match wins. Put the catch-all `*` first.
- Works for users *and* org teams (`@org/team`). Teams require org-owned repos.
- For it to auto-request reviews, the repo must not have "require approvals"
  conflicting settings; enforcement is strongest with branch protection on.
- Verify it's valid: **Settings → Branches → Code owners** shows a warning if
  a pattern is invalid.

### 05 — Dependabot
`.github/dependabot.yml`

- Ships with **only** the `github-actions` ecosystem enabled — that's useful in
  every repo. Uncomment your stack (`npm`, `pip`, `gomod`, `cargo`, `docker`).
- `groups:` collapses updates into one PR per group instead of 20 noisy PRs.
  This is the difference between Dependabot being useful and being muted.
- Needs **Settings → Code security → Dependabot** enabled.
- `directory` is where the manifest lives. For monorepos, add one entry per package.

### 06 — CI skeleton
`.github/workflows/ci.yml`

- Two jobs: `build` (with `TODO` steps for install/lint/test) and `hygiene`
  (fails on committed conflict markers or CRLF files).
- **Edit:** uncomment one runtime setup block, replace the three `run:` commands,
  delete the rest.
- `concurrency` cancels superseded runs — free speed on busy branches.
- `permissions: contents: read` is deliberate. Add scopes per job as needed.
- The `hygiene` job is safe to delete if it annoys you.

### 07 — CodeQL
`.github/workflows/codeql.yml`

- Enabled for the `actions` language by default (scans your workflows).
  Uncomment `javascript-typescript`, `python`, `go`, etc.
- Free for public repos. Private repos need GitHub Advanced Security.
- Runs on push, PR, and weekly. Weekly matters — it finds *new* query results in
  *old* code.
- Compiled languages need the autobuild step; interpreted ones skip it.

### 08 — Stale + labeler
`.github/workflows/{stale.yml, labeler.yml}` + `.github/labeler.yml`

- **Edit:** create the `stale`, `documentation`, `ci`, `dependencies`, `tests`
  labels, or change the names in the config.
- Tune `days-before-*-stale` before turning it on. 60/14 is gentle.
- `pull_request_target` is used here on purpose: fork PRs get a read-only token
  under plain `pull_request`, so labeling silently fails. This workflow never
  checks out PR code, so it's not the dangerous `pull_request_target` pattern.

### 09 — Release notes + release workflow
`.github/release.yml` + `.github/workflows/release.yml`

- `release.yml` (config) groups auto-generated notes by label. **Edit:** the
  category labels to match what you actually use.
- `workflows/release.yml` fires on `v*.*.*` tags, builds, and creates a GitHub
  Release with generated notes via `gh`.
- `--generate-notes` uses PR titles/labels between the previous tag and this one,
  so it's only as good as your PR hygiene.
- Publishing to npm/PyPI is commented out — keep it in a separate job so a failed
  publish never blocks the release.

### 10 — Git hooks (Lefthook)
`lefthook.yml` + `.githooks/{check-secrets.sh, check-large-files.sh, commit-msg.sh}`

Blocks, before the commit exists:

- **secrets** — AWS keys, GitHub tokens, Google API keys, Slack tokens, OpenAI
  keys, private-key headers
- **large files** — anything over 1 MiB (override with `LIMIT_BYTES=...`)
- **commit messages** — Conventional Commits, with merge/revert/fixup exempt

Setup (one time per clone):

```powershell
winget install evilmartians.lefthook     # or: scoop install lefthook
lefthook install
lefthook run pre-commit                  # test it
```

Escape hatches:

```bash
git commit --no-verify          # skip hooks for this commit
LEFTHOOK=0 git commit -m "wip"  # skip lefthook specifically
```

Why Lefthook instead of a `.git/hooks` folder: `.git/hooks` is **not committed**,
so it never reaches your teammates, and raw shell hooks break on Windows. With
Lefthook you commit a YAML file, everyone runs `lefthook install`, and the same
hooks work on Windows/macOS/Linux.

**Windows note:** the hooks call `sh`. That's fine — Git for Windows provides
one and puts it on `PATH` while running hooks, even if `sh` isn't on your
PowerShell PATH. Verified: `sh` resolves to `/usr/bin/sh` inside a hook.

**Where to add linters:** `lefthook.yml` has commented `format`/`lint` blocks.
Keep `pre-commit` fast (formatters, secret scan). Put tests in `pre-push`.

### 11 — Root files
`.editorconfig`, `.gitattributes`, `.gitignore`

- `.gitattributes` forces `LF` in the repo, keeps `.bat/.cmd/.ps1` as CRLF, and
  marks lockfiles as generated so they don't wreck diffs. This is the single
  best fix for "why does every file look changed on Windows?".
- `.gitignore` has a safe base plus commented per-language sections.
- `.editorconfig` is respected by VS Code, JetBrains, and most editors natively.

### 12 — Reusable workflows
`.github/workflows/{reusable-ci.yml, ci-caller.yml}`

- **This is an alternative to recipe 06**, not an addition — don't copy both or
  you'll run two identical `CI` workflows.
- `workflow_call` lets one file define the pipeline. Callers pass inputs.
- Across repos, the reusable workflow's repo must be public (or same org with
  access). Pin `@main` to a tag/SHA, never `@main` in production.
- Called workflows can't exceed the caller's `permissions`.

---

## Labels to create once

Create these under **Issues → Labels** before or right after copying:

| Label | Used by |
|---|---|
| `bug` | issue forms, release notes |
| `enhancement` | issue forms, release notes |
| `needs-triage` | issue forms |
| `stale` | stale bot |
| `documentation` | labeler, release notes |
| `ci` | labeler, release notes |
| `dependencies` | labeler, release notes |
| `tests` | labeler |
| `breaking`, `breaking-change` | release notes |
| `feature`, `fix`, `performance` | release notes |
| `chore`, `refactor`, `build`, `test` | release notes |
| `skip-changelog` | release notes (excluded) |
| `pinned`, `security` | stale bot (exempt) |

Tip: `gh label create "needs-triage" --color "fbca04"` or bulk-create them
once from the GitHub UI.

---

## Placeholder checklist

Search-replace these after copying:

| Placeholder | Appears in |
|---|---|
| `OWNER/REPO` | `ISSUE_TEMPLATE/config.yml`, `SECURITY.md`, `SUPPORT.md`, `CONTRIBUTING.md` |
| `@your-username` | `CODEOWNERS`, `FUNDING.yml`, issue form `assignees` |
| `security@example.com` | `SECURITY.md` |
| `conduct@example.com` | `CODE_OF_CONDUCT.md` |
| `your-username` | `FUNDING.yml` |
| `TODO:` | every workflow — these are deliberate |

---

## Gotchas worth knowing

- **Never commit `.git/hooks/`.** It's local-only and untracked by design.
- **`--no-verify` skips hooks.** Hooks are a convenience, not a security boundary.
  Real enforcement belongs in CI and branch protection.
- **Hooks run on the client.** A malicious contributor's clone can bypass them.
  Server-side checks (CI, required reviews) are the enforcement layer.
- **`pull_request_target` + checkout of PR code = RCE.** Only use it for
  metadata-only actions, as the labeler recipe does.
- **Workflow permissions default to read-only** in newer repos. If a step fails
  with 403, add the specific scope to `permissions:`, not `write-all`.
- **`paths`/`branches` filters** on `push` can silently skip your required check.
  If a job is required in branch protection, make sure it always runs or use a
  separate always-running workflow.
- **Cron schedules are UTC** and often delayed under load. Don't depend on
  minute precision.
- **Issue form YAML is validated on push.** A typo makes the template vanish from
  the chooser. Check **Issues → New issue** after changing it.

## Optional next steps

- Turn this folder into a **GitHub template repository** (Settings → Template
  repository) so new repos get a "Use this template" button. `gh repo create
  my-new --template you/this-repo`.
- Want org-wide defaults? Name a repo `.github` and put these files in it —
  GitHub uses them as the fallback for every repo in the org. Add
  `profile/README.md` for the org landing page.
- Add `actionlint` to CI to validate workflows themselves:
  `docker run --rm -v "$PWD:/repo" rhysd/actionlint:latest -color`.
