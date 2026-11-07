# Releasing

How a new version of `reposet` ships. Read the whole thing before your first
release; the pre-flight list is the part that catches mistakes.

## Versioning

`reposet` follows [Semantic Versioning](https://semver.org). For a template kit
the interesting question is what counts as "breaking": consumers *copy* these
files, so a change to a generated file can break someone even though no API
changed.

| Change | Bump |
|---|---|
| Docs, README, comments only | patch |
| New recipe, new CLI flag, new optional file | minor |
| Changed or removed generated file, renamed recipe, changed install path | minor if additive, **major** if it removes something consumers depend on |
| Bug fix in the CLI or a script | patch |

Before 1.0, follow semver but do not be afraid of minor releases for meaningful
template changes — say so in the release notes.

## Pre-flight checklist

Run all of this from a clean working tree, on the release commit:

```bash
git status                       # must be clean
node --test                      # all tests passing
```

```powershell
# templates are generated from recipes; CI fails on drift
powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/build-templates.ps1 -Check
```

```bash
# every YAML file still parses
python -c "import pathlib,yaml; [yaml.safe_load(p.read_text(encoding='utf-8')) for p in pathlib.Path('.').rglob('*.y*ml')]"
```

```bash
# the packed artefact installs cleanly (this is what users get)
npm pack
mkdir -p /tmp/e2e /tmp/target
tar -xzf reposet-*.tgz -C /tmp/e2e
node /tmp/e2e/package/bin/reposet.js init /tmp/target --yes
ls /tmp/target/.gitignore /tmp/target/.githooks/commit-msg.sh
rm reposet-*.tgz
```

Also run the git hooks once against a scratch repository. CI's Windows job does
this automatically, but it caught a real bug once, so it is worth knowing how.

## Release steps

1. **Update `CHANGELOG.md`.** Move the relevant entries from `[Unreleased]` into
   a new version section with today's date, then add the comparison links at the
   bottom:

   ```markdown
   ## [0.2.0] - 2026-11-20
   ...
   [0.2.0]: https://github.com/n4od/reposet/compare/v0.1.0...v0.2.0
   ```

   Describe recipe changes in plain language — consumers copy those files.

2. **Bump the version** (this commits and tags locally):

   ```bash
   npm version patch    # or minor / major
   ```

3. **Publish to npm:**

   ```bash
   npm publish
   ```

   Complete the 2FA prompt. Expect `+ reposet@X.Y.Z`.

4. **Push the commit and tag:**

   ```bash
   git push --follow-tags
   ```

5. **Create the GitHub release** (or use the web UI):

   ```bash
   gh release create vX.Y.Z --generate-notes
   ```

   Edit the generated notes so recipe changes are described in plain language,
   not just commit titles, and keep them consistent with `CHANGELOG.md`.

6. **Smoke-test the published version:**

   ```bash
   npx reposet@latest --version
   npx reposet@latest init /tmp/scratch --dry-run
   ```

## Things that will bite you

- **npm drops files named `.gitignore`.** `prepack` creates a dotless `gitignore`
  twin and `postpack` removes it; the installer renames it back. If a release
  ever installs a repository *without* `.gitignore`, this is why. Do not remove
  the workaround.
- **A name is not free until it is published.** `npm publish --dry-run` never
  checks name ownership; only a real publish reveals a `403`. Earlier names
  (`repox`, `repokit`) were blocked by the registry; `reposet` was clear. If you
  ever rename, publish a `0.0.x` immediately to claim the name before doing more
  work on it.
- **`prepack` / `postpack` must leave the tree clean.** CI asserts
  `git status --porcelain` is empty after `npm pack`. If you add files, make sure
  they are not mistaken for pack leftovers.

## If a release is wrong

- **Bad but harmless** — publish a patch.
- **Dangerous** — deprecate it so installs warn, then publish a fixed version:

  ```bash
  npm deprecate reposet@X.Y.Z "Broken, use X.Y.(Z+1)"
  ```

- **Unpublishing** is only allowed within 72 hours and, for popular packages, not
  at all. Prefer deprecation. Once a package is fully unpublished, the name is
  held for 24 hours before it can be reused — which is also why you should never
  unpublish a name you might want back.