# Changelog

All notable changes to this project are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `reposet init` now fills `OWNER/REPO`, `@your-username`, `your-org` and the
  example contact emails in every file it writes
- Placeholder values are detected from the target's git remote,
  `GITHUB_REPOSITORY`, `git config user.email` and `GITHUB_ACTOR`
- `--owner`, `--repo`, `--user`, `--org`, `--email`, `--security-email` and
  `--conduct-email` override detection; `--no-fill` opts out entirely
- `reposet check [target]` lists leftover placeholders with file and line, and
  exits `1` when a required one remains (`--json` supported)

### Changed

- `init` reports how many placeholders it filled and what is still left

## [0.1.0] - 2026-11-07

### Added

- `reposet init` — installs all 11 default recipes, never overwriting existing files
- `reposet list`, plus `--only`, `--force`, `--dry-run`, `--yes` and `--json`
- 12 recipes: issue forms, PR template, community health, CODEOWNERS, Dependabot,
  CI, CodeQL, stale + labeler, release notes, git hooks, root files, and reusable
  workflows
- `templates/generic/` — the 25-file drop-in set, generated from `recipes/`
- Git hooks: gitleaks secret scan with a dependency-free fallback, a 1 MiB
  large-file guard, and Conventional Commits enforcement
- 14 tests, plus CI that installs from the real npm tarball and a Windows job
  that runs real Lefthook

### Changed

- Published as `reposet`; `repox` and `repokit` are both blocked on npm

### Fixed

- npm silently drops `.gitignore` from tarballs — ship a `gitignore` twin and
  rename it on install
- Lefthook on Windows failed to parse quoted `run:` blocks, blocking every commit

[Unreleased]: https://github.com/n4od/reposet/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/n4od/reposet/releases/tag/v0.1.0