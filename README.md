# reposet

> The twelve files every repository ends up needing — issue forms, PR template,
> CI, Dependabot, CodeQL, release notes, code owners, and git hooks that actually
> work on Windows.

[![npm version](https://img.shields.io/npm/v/reposet.svg)](https://www.npmjs.com/package/reposet)
[![npm downloads](https://img.shields.io/npm/dm/reposet.svg)](https://www.npmjs.com/package/reposet)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Runtime dependencies: none](https://img.shields.io/badge/runtime%20deps-none-brightgreen)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)

```bash
npx reposet init
```

Most repos don't rot because of bad code. They rot because nobody wrote down how
to report a bug, what a PR is supposed to contain, which reviewers own which
folder, or where CI lives. So every new project starts with the same hour of
copying files from the last one.

This kit is that hour, done once, for any stack.

Nothing here is language-specific. Every file has `TODO` comments where a
decision is yours to make.

---

## What's in the box

| Concern | Files |
|---|---|
| Issue intake | Bug + feature forms, blank issues disabled, contact links |
| PRs | Template with change type, test evidence, checklist |
| Community health | `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SUPPORT.md`, `FUNDING.yml` |
| Ownership | `CODEOWNERS` with per-path reviewers |
| Dependencies | `dependabot.yml` with grouping, Actions enabled by default |
| CI | Workflow skeleton + language-agnostic hygiene job (conflict markers, CRLF) |
| Security | CodeQL scanning on push, PR, and weekly |
| Triage | Stale bot + path-based auto-labeling |
| Releases | Grouped auto-generated notes + tag→release workflow |
| Git hooks | Secret scan (gitleaks, with a built-in fallback), large-file block, Conventional Commits |
| Repo config | `.editorconfig`, `.gitattributes`, `.gitignore` |
| Scale-out | Reusable `workflow_call` CI for many repos |

## 60-second start

```bash
npx reposet init
```

That writes all 11 default recipes into the current repository, **never
overwriting** a file that already exists.

```bash
npx reposet init ../my-app                                  # another folder
npx reposet init ../my-app --only pr-template,dependabot     # cherry-pick
npx reposet list                                            # see everything
npx reposet init . --dry-run                                # plan only
```

| Option | What it does |
|---|---|
| `--only <list>` | Recipe ids or names, comma separated (`02,05` or `pr-template,dependabot`) |
| `--all` | Every recipe except 12 (this is the default) |
| `--force, -f` | Overwrite files that already exist |
| `--dry-run, -n` | Print the plan, write nothing |
| `--yes, -y` | Never prompt (for scripts and CI) |
| `--json` | Machine-readable result |

The CLI needs Node 18+ and has **zero dependencies** — no lockfile, no install
tree, ~70 KB unpacked.

### Then, in the target repo

1. Replace `OWNER/REPO`, `@your-username`, `security@example.com`,
   `conduct@example.com` — [checklist below](#placeholders).
2. Create the labels the templates reference — [list below](#labels-to-create-once).
3. If you took the hooks: `winget install evilmartians.lefthook && lefthook install`.
4. Push to your default branch, then check **Issues → New issue** to confirm the
   forms render.

The CLI prints these steps for exactly the recipes you chose.

### No Node? Copy the files instead

Every recipe folder mirrors your target repo's layout, so you copy **its
contents**, not the folder itself. Copying `recipes/02-pr-template/` produces
`my-repo/.github/pull_request_template.md`.

```powershell
# everything
Copy-Item "templates\generic\*" -Destination "C:\path\to\my-repo" -Recurse -Force

# or one concern
Copy-Item "recipes\02-pr-template\*" -Destination "C:\path\to\my-repo" -Recurse -Force
```

```bash
# macOS / Linux
cp -r templates/generic/. /path/to/my-repo/
```

No package to install, no config to generate, no lock-in — it's files you own
outright.

## Why not just use the defaults?

| The obvious option | Where it stops | What this adds |
|---|---|---|
| The green **"Configure"** button (`actions/starter-workflows`) | Language CI only — nothing for issues, PRs, ownership, releases | One coherent set across 12 concerns, named consistently |
| `.gitignore` generators | Only `.gitignore` | `.editorconfig` + `.gitattributes`, which kill CRLF and lockfile diff noise |
| Husky | Requires Node in every repo that uses it | Lefthook: one binary, any stack, no Node |
| Hand-rolled `.git/hooks` | Never reaches teammates — `.git/` isn't committed | `lefthook install` and committed config |
| gitleaks on its own | Excellent scanner, but you still have to wire and tune it | Wired into `pre-commit`: gitleaks when present, zero-dep pattern fallback when not |
| Contributor Covenant + docs | Authoritative text, but manual assembly | Assembled, cross-linked, with a response-time table |
| Dependabot settings UI | One ecosystem at a time, no grouping | Grouped configs for npm/pip/go/cargo/docker; Actions on by default |

## Verified, not just written

- Tested on **Windows 11 + Git for Windows 2.45 + PowerShell 5.1**.
- Every YAML file parses; CI re-checks it on every push.
- Hook scripts are exercised in CI against valid and invalid commit messages,
  a leaked AWS key, and a 2 MB staged file.
- Confirmed that `sh` resolves inside git hooks on Windows (Git for Windows
  provides `/usr/bin/sh`), so Lefthook's `run: sh .githooks/...` works even when
  `sh` is not on your PowerShell `PATH`.
- `templates/generic/` is generated from `recipes/` and CI fails on drift, so the
  two never disagree.
- The CLI has a test suite (`node --test`) covering selection, idempotent installs,
  `--force`, `--dry-run`, `--json`, and usage errors — all run in CI.
- CI packs the real npm tarball, extracts it, and installs from it, which caught
  npm silently dropping `.gitignore` from published packages (the CLI ships a
  packed twin and renames it back).

---

## Repo layout

```
.
├── bin/
│   └── reposet.js      ← CLI entry point (npx reposet)
├── src/                     ← CLI: arg parsing, recipe manifest, installer
├── recipes/                 ← source of truth: cherry-pick ONE concern at a time
│   ├── 01-issue-forms/
│   │   └── .github/ISSUE_TEMPLATE/...
│   ├── 02-pr-template/
│   │   └── .github/pull_request_template.md
│   └── ...
├── templates/
│   └── generic/             ← recipes 01–11 merged, ready to drop in whole
├── scripts/
│   ├── build-templates.ps1  ← regenerates templates/generic (maintainers)
│   └── pack-*.js            ← work around npm dropping .gitignore
├── test/                    ← CLI tests (node --test)
└── .github/workflows/
    └── verify.yml           ← this repo's CI (not copied to consumers)
```

## Recipes

Pass either the id or the name to `--only`: `--only 2,05,root-files`.

| # | Recipe | Take it when |
|---|---|---|
| 01 | [`issue-forms`](recipes/01-issue-forms) | Any public repo with issues |
| 02 | [`pr-template`](recipes/02-pr-template) | Always — highest ROI file here |
| 03 | [`community-health`](recipes/03-community-health) | Any repo other people touch |
| 04 | [`codeowners`](recipes/04-codeowners) | Teams, or protecting critical files |
| 05 | [`dependabot`](recipes/05-dependabot) | Always — Actions updates enabled by default |
| 06 | [`ci-basic`](recipes/06-ci-basic) | Any repo that isn't CI'd yet |
| 07 | [`security-scan`](recipes/07-security-scan) | Public repos (free), or private with GHAS |
| 08 | [`stale-and-labeler`](recipes/08-stale-and-labeler) | Busy issue trackers |
| 09 | [`release-notes`](recipes/09-release-notes) | Anything you version |
| 10 | [`githooks-lefthook`](recipes/10-githooks-lefthook) | Local safety net before CI |
| 11 | [`root-files`](recipes/11-root-files) | Always — prevents CRLF and encoding diffs |
| 12 | [`reusable-workflows`](recipes/12-reusable-workflows) | 3+ repos sharing one pipeline (select explicitly) |

### If you only do five things

1. `02-pr-template` — makes every future PR reviewable.
2. `11-root-files` — kills line-ending and encoding diffs forever.
3. `05-dependabot` — free dependency security updates.
4. `06-ci-basic` — nothing merges untested.
5. `10-githooks-lefthook` — stops secrets before they reach history.

---

<details>
<summary><b>01 — Issue forms</b> · <code>.github/ISSUE_TEMPLATE/</code></summary>

- **Edit:** `OWNER/REPO` in `config.yml` (Discussions and private-advisory URLs).
- **Gotcha:** labels in `labels: [...]` must already exist, or they're silently
  skipped. Create them first.
- **Gotcha:** each `body` entry needs a unique `id`.
- `blank_issues_enabled: false` forces people through a form; set `true` to keep
  free-form issues.
- GitHub validates this YAML on push — a typo makes the template vanish from the
  chooser. Verify at **Issues → New issue**.
</details>

<details>
<summary><b>02 — PR template</b> · <code>.github/pull_request_template.md</code></summary>

- Applies to every new PR automatically. No configuration.
- Keep it under ~40 lines or people delete it on sight.
- Multiple templates: move to `.github/PULL_REQUEST_TEMPLATE/bugfix.md`, then
  append `?template=bugfix.md` to the PR URL.
</details>

<details>
<summary><b>03 — Community health</b> · <code>.github/SECURITY.md</code> etc.</summary>

- **Edit:** `OWNER/REPO`, `security@example.com`, `conduct@example.com`.
- GitHub surfaces these in **Community Standards** and links them from the
  new-issue chooser automatically.
- `FUNDING.yml` only does something once a sponsorship platform is set up.
  Delete it if you don't want a Sponsor button.
- The CoC is a summary that links the authoritative Contributor Covenant 2.1.
</details>

<details>
<summary><b>04 — CODEOWNERS</b> · <code>.github/CODEOWNERS</code></summary>

- **Edit:** every `@your-username`.
- Rules match **bottom-up**; the last match wins. Keep the catch-all `*` first.
- Works with users and org teams (`@org/team`); teams require org-owned repos.
- Invalid patterns show a warning under **Settings → Branches → Code owners**.
</details>

<details>
<summary><b>05 — Dependabot</b> · <code>.github/dependabot.yml</code></summary>

- Ships with **only** `github-actions` enabled — useful in every repo. Uncomment
  your stack (`npm`, `pip`, `gomod`, `cargo`, `docker`).
- `groups:` collapses updates into one PR per group instead of twenty noisy ones.
  This is what separates "useful" from "muted".
- Requires **Settings → Code security → Dependabot** to be enabled.
- `directory` is the folder holding the manifest; monorepos need one entry each.
</details>

<details>
<summary><b>06 — CI skeleton</b> · <code>.github/workflows/ci.yml</code></summary>

- Two jobs: `build` (with `TODO` steps) and `hygiene` (fails on committed
  conflict markers or CRLF files).
- **Edit:** uncomment one runtime setup, replace three `run:` commands, delete
  the rest.
- `concurrency` cancels superseded runs — free speed on busy branches.
- `permissions: contents: read` is deliberate; add scopes per job.
- The `hygiene` job is safe to delete if it annoys you.
</details>

<details>
<summary><b>07 — CodeQL</b> · <code>.github/workflows/codeql.yml</code></summary>

- Enabled for the `actions` language by default; uncomment your languages.
- Free for public repos. Private repos need GitHub Advanced Security.
- Weekly runs matter: they find *new* query results in *old* code.
- Compiled languages use the autobuild step; interpreted ones skip it.
</details>

<details>
<summary><b>08 — Stale + labeler</b> · <code>.github/workflows/</code> + <code>.github/labeler.yml</code></summary>

- **Edit:** create the `stale`, `documentation`, `ci`, `dependencies`, `tests`
  labels, or rename them in the config.
- Tune `days-before-*-stale` before enabling. 60/14 is gentle.
- `pull_request_target` is used on purpose: fork PRs get a read-only token under
  `pull_request`, so labeling silently fails. This workflow never checks out PR
  code, so it avoids the dangerous `pull_request_target` pattern.
</details>

<details>
<summary><b>09 — Release notes</b> · <code>.github/release.yml</code> + workflow</summary>

- `release.yml` (config) groups auto-generated notes by label. **Edit** the
  category labels to match what you actually use.
- The workflow fires on `v*.*.*` tags, builds, and creates a Release via `gh`.
- `--generate-notes` reads PR titles and labels between tags, so it's only as good
  as your PR hygiene.
- Registry publishing is commented out and kept in a separate job, so a failed
  publish never blocks the release.
</details>

<details>
<summary><b>10 — Git hooks</b> · <code>lefthook.yml</code> + <code>.githooks/</code></summary>

Blocks, before the commit exists:

- **Secrets** — via [gitleaks](https://github.com/gitleaks/gitleaks) when it is
  installed; the hook otherwise falls back to a dependency-free pattern list, so
  you're never left unprotected. Both paths live in `.githooks/check-secrets.sh`.
- **Large files** — anything over 1 MiB (override with `LIMIT_BYTES=...`).
- **Commit messages** — Conventional Commits; merge/revert/fixup exempt.

```powershell
winget install evilmartians.lefthook     # or scoop / brew / npm i -D lefthook
lefthook install
lefthook run pre-commit                  # test it
```

Escape hatches:

```bash
git commit --no-verify          # skip hooks for this commit
LEFTHOOK=0 git commit -m "wip"  # skip lefthook specifically
```

Why Lefthook instead of a `.git/hooks` folder: `.git/hooks` is **not committed**,
so it never reaches teammates, and raw shell hooks break on Windows. Here you
commit a YAML file, everyone runs `lefthook install`, and the same hooks work
everywhere.

Keep `pre-commit` fast (formatters, secret scan). Put tests in `pre-push`.
</details>

<details>
<summary><b>11 — Root files</b> · <code>.editorconfig</code>, <code>.gitattributes</code>, <code>.gitignore</code></summary>

- `.gitattributes` forces `LF` in the repo, keeps `.bat/.cmd/.ps1` as CRLF, and
  marks lockfiles as generated so they stop wrecking diffs. This is the single
  best fix for "why does every file look changed on Windows?".
- `.gitignore` has a safe base plus commented per-language sections.
- `.editorconfig` is respected natively by VS Code, JetBrains, and most editors.
</details>

<details>
<summary><b>12 — Reusable workflows</b> · <code>workflow_call</code></summary>

- **This is an alternative to recipe 06, not an addition.** Copying both runs two
  identical `CI` workflows.
- `workflow_call` defines the pipeline once; callers pass inputs.
- Across repos, the workflow's repo must be public (or same org with access).
  Pin `@main` to a tag or SHA.
- A called workflow cannot exceed the caller's `permissions`.
</details>

---

## Labels to create once

Create these under **Issues → Labels**:

| Label | Used by |
|---|---|
| `bug`, `enhancement`, `needs-triage` | issue forms |
| `stale` | stale bot |
| `documentation`, `ci`, `dependencies`, `tests` | labeler |
| `breaking`, `breaking-change`, `feature`, `fix`, `performance` | release notes |
| `chore`, `refactor`, `build`, `test` | release notes |
| `skip-changelog` | release notes (excluded) |
| `pinned`, `security` | stale bot (exempt) |

```bash
gh label create "needs-triage" --color "fbca04"
```

## Placeholders

| Placeholder | Appears in |
|---|---|
| `OWNER/REPO` | `ISSUE_TEMPLATE/config.yml`, `SECURITY.md`, `SUPPORT.md`, `CONTRIBUTING.md` |
| `@your-username` | `CODEOWNERS`, `FUNDING.yml`, issue form `assignees` |
| `security@example.com` | `SECURITY.md` |
| `conduct@example.com` | `CODE_OF_CONDUCT.md` |
| `your-username` | `FUNDING.yml` |
| `TODO:` | every workflow — deliberate |

---

## Gotchas worth knowing

- **Never commit `.git/hooks/`.** It's local-only by design.
- **`--no-verify` skips hooks.** Hooks are convenience, not a security boundary.
  Enforcement belongs in CI and branch protection.
- **Hooks run client-side.** A determined contributor bypasses them. Server-side
  checks are the real gate.
- **`pull_request_target` + checking out PR code = RCE.** Only use it for
  metadata-only actions, as the labeler recipe does.
- **New repos default to read-only workflow tokens.** A 403 means add the
  specific scope to `permissions:`, not `write-all`.
- **`paths`/`branches` filters** can silently skip a required check. If a job is
  required in branch protection, make sure it always runs.
- **Cron is UTC** and often delayed under load. Don't rely on minute precision.
- **Stuck?** [docs/troubleshooting.md](docs/troubleshooting.md) covers hooks that
  don't fire, `sh` on Windows, CodeQL on private repos, exit codes, and more.

## What this deliberately does not replace

Branch protection rules, required reviews, environment secrets, signed commits,
and org-level policy. Those are settings and process, not files. This kit gets a
repo to "well-kept"; it can't get it to "governed".

---

## Using it as a GitHub template

To give others a one-click **"Use this template"** button:

```bash
gh api -X PATCH repos/OWNER/REPO -f is_template=true
gh repo create my-new-project --template OWNER/REPO
```

For **org-wide defaults**, name a repo `.github` and push these files there —
GitHub falls back to it for every repo in the org. Add `profile/README.md` for
the org landing page.

## Maintaining this kit

`recipes/` is the source of truth. `templates/generic/` is generated:

```powershell
# Windows: pass -ExecutionPolicy Bypass, or scripts may be disabled on your box.
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/build-templates.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/build-templates.ps1 -Check
```

```bash
# macOS / Linux (PowerShell 6+)
pwsh -NoProfile -File ./scripts/build-templates.ps1 -Check
```

Rules:

- One concern per recipe folder; the folder mirrors the target repo layout.
- No two recipes may provide the same path — the build script fails loudly.
- `12-reusable-workflows` is excluded from the merge because it replaces `06`.
- `templates/generic/` is never edited by hand.

Further reading:

- [CONTRIBUTING.md](CONTRIBUTING.md) — the ground rules, local setup, and how to add a recipe.
- [docs/releasing.md](docs/releasing.md) — versioning and the publish checklist.
- [docs/troubleshooting.md](docs/troubleshooting.md) — fixes for common problems.
- [SECURITY.md](SECURITY.md) — how to report a vulnerability.

### Publishing the CLI

1. `npm login`, then `npm publish`.
2. Smoke-test: `npx reposet@latest init /tmp/scratch --dry-run`.

`repository`, `bugs`, `homepage` and `author` in `package.json` already point at
**n4od**; update them if you move the repo.

`npm pack` runs `scripts/pack-prepare.js` / `pack-clean.js`, because npm drops
files named `.gitignore` from tarballs. Don't remove that workaround — the
packaging test in CI exists to catch it if it breaks.

## License

[MIT](LICENSE). The config files are meant to be copied; keep the notice in
place and you're done.

---

Built by **N4OD** · [github.com/n4od](https://github.com/n4od)

If this saved you an hour, a ⭐ helps other people find it.
