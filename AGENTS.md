# AGENTS.md

Zero-dependency Node CLI (`reposet`) that copies `.github` config and git-hook
files into other repositories. `recipes/` is the source of truth;
`templates/generic/` is generated. CommonJS, Node >= 18, no build step, no
lockfile, no runtime deps.

## Commands

```bash
node --test                                   # all 14 tests
node --test test/cli.test.js                  # one file
node --test --test-name-pattern "tarball"     # one test by name
node bin/reposet.js init <dir> --yes --dry-run
node bin/reposet.js list
```

```powershell
# Regenerate templates/generic from recipes/ (required after recipe edits)
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/build-templates.ps1
# CI's drift check (rebuilds to temp and diffs)
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/build-templates.ps1 -Check
```

YAML check (what CI runs):

```bash
python -c "import pathlib,yaml; [yaml.safe_load(p.read_text(encoding='utf-8')) for p in pathlib.Path('.').rglob('*.y*ml')]"
```

Packaging check (what users actually get):

```bash
npm pack
mkdir -p /tmp/e2e /tmp/target
tar -xzf reposet-*.tgz -C /tmp/e2e
node /tmp/e2e/package/bin/reposet.js init /tmp/target --yes
rm reposet-*.tgz
```

On Windows PowerShell, `npm.ps1` may be blocked by execution policy — use
`npm.cmd` / `npx.cmd`.

## Architecture invariants

- Each `recipes/NN-slug/` folder mirrors the **target** repo layout; files are
  copied as-is. `recipes/02-pr-template/.github/pull_request_template.md` installs
  to `.github/pull_request_template.md`.
- `src/recipes.json` is the manifest and must match the folders on disk;
  `recipes.validate()` enforces this.
- Recipe `12` (`reusable-workflows`) is an **alternative** to `06`, not an
  addition: excluded from `templates/generic`, excluded from `DEFAULT_IDS`, only
  selectable with `--only 12`. `ALTERNATIVES` in `src/recipes.js` records this.
- `templates/generic/` is generated. Never edit it by hand; CI fails on drift.
- No two recipes may provide the same path — the build script and installer both
  throw.
- The installer never deletes: it only creates, skips, or overwrites (`--force`).
  `--dry-run` must stay side-effect free. Exit codes: `0` ok, `1` runtime, `2` usage.

## Adding or changing a recipe

1. Add/change files under `recipes/NN-slug/`, mirroring the target layout.
2. Register it in `src/recipes.json` (`id`, `slug`, `dir`, `title`, `description`).
3. Regenerate `templates/generic/` with the build script (`-Check` must pass).
4. Add the row to the README recipe table; update `CHANGELOG.md` `[Unreleased]`.
5. Run `node --test`.

## Root `.github/` vs recipes

The root `.github/` is this project's **own** config (its CI, issue forms, PR
template, CODEOWNERS). Recipe content lives under `recipes/<NN>/...`. Don't copy
root `.github` files into recipes or vice versa — they serve different audiences
and the recipe copies contain `OWNER/REPO`-style placeholders.

## Packaging gotchas — do not "fix" these

- npm hard-drops files named `.gitignore` from tarballs. `prepack`
  (`scripts/pack-prepare.js`) creates a dotless `gitignore` twin;
  `installPath()` in `src/recipes.js` renames it back to `.gitignore` on install;
  `postpack` deletes the twins. `recipes/*/gitignore` and `*.tgz` are gitignored.
- `package.json` `files` is a whitelist: only `bin/`, `src/`, `recipes/`,
  `LICENSE` ship (plus npm's automatic README/package.json). `docs/`, `test/`,
  `scripts/`, `.github/` are excluded. Confirm with `npm pack` before assuming a
  file is published.

## Git-hook quirks

- Lefthook on Windows wraps each `run:` command in double quotes **without
  escaping quotes inside it**. An inline `"` in a `run:` block breaks parsing and
  blocks every commit. Keep multi-line logic in `.githooks/*.sh` and call
  `sh .githooks/foo.sh`; use single quotes if an echo is unavoidable.
- `.githooks/check-secrets.sh` uses gitleaks when installed and a built-in
  pattern fallback otherwise. `SECRET_SCAN_FALLBACK=1` forces the fallback; CI's
  fallback test depends on it.
- On Windows, `sh` is not on the PowerShell `PATH` but resolves inside Git hooks
  (Git for Windows).

## CI

`.github/workflows/verify.yml` belongs to the kit — it is not a recipe and is not
copied to consumers. Jobs: template drift, YAML parse, `node --test` + real
tarball install, hook-script behaviour, and a `windows-latest` job running real
Lefthook.

When editing CI, keep `pwsh -File ./scripts/build-templates.ps1` rather than
`shell: pwsh` — dot-sourcing mangles arguments.

## Conventions

- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `ci:`).
- Zero runtime dependencies; don't add one without explicit agreement.
- Commit, bump the version, and `npm publish` only on explicit request —
  publishing requires the owner's 2FA.
- More detail: `CONTRIBUTING.md`, `docs/releasing.md`, `docs/troubleshooting.md`.