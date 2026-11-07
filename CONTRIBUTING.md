# Contributing to reposet

Thanks for wanting to help. This kit exists so people stop re-copying the same
files into every repository, and contributions that move that goal forward are
welcome — bug fixes, new recipes, better docs.

- [Ways to contribute](#ways-to-contribute)
- [Ground rules](#ground-rules)
- [Local setup](#local-setup)
- [Adding a recipe](#adding-a-recipe)
- [Changing the CLI](#changing-the-cli)
- [Commit style](#commit-style)
- [Pull requests](#pull-requests)
- [Licence](#licence)

## Ways to contribute

- **Report a bug** — open an issue; the form asks for the details needed.
- **Suggest a recipe** — a new concern worth dropping into any repo.
- **Improve a recipe** — better defaults, clearer TODO comments, fewer stack assumptions.
- **Fix the CLI or docs** — `src/`, `bin/`, `README.md`, `docs/`.

If you are unsure whether something fits, open an issue first. It is cheaper than
a pull request that has to be reshaped.

## Ground rules

These keep the whole kit coherent. A pull request that breaks one will need changes:

1. **One concern per recipe.** A recipe is a folder under `recipes/` that solves
   exactly one problem. "CI and also Dependabot and also a changelog" is three.
2. **A recipe mirrors the target repo's layout.** `recipes/02-pr-template/.github/pull_request_template.md`
   installs to `.github/pull_request_template.md`. Copy the *contents*, not the folder.
3. **No two recipes may provide the same path.** The build script fails loudly
   if they do; when two recipes overlap, one is an alternative to the other
   (see how `12-reusable-workflows` relates to `06`).
4. **Language-agnostic by default.** No Node/Python/Go/Rust assumptions in the
   copied files. Leave language-specific bits as commented examples (see the
   formatter/linter stubs in `lefthook.yml`).
5. **No secrets, ever.** Not in fixtures, not in tests.
6. **LF line endings and UTF-8.** `.gitattributes` enforces this; don't fight it.

## Local setup

Requires **Node 18+**. Nothing else — the CLI has zero runtime dependencies.

```bash
git clone https://github.com/n4od/reposet.git
cd reposet

node --test                 # the test suite
node bin/reposet.js --help  # run the CLI straight from source
node bin/reposet.js list
```

`node --test` is the gate. It covers recipe selection, idempotent installs,
`--force`, `--dry-run`, `--json`, usage errors, and the packaging workaround.

To exercise the real, packed artefact (what users actually get):

```bash
npm pack
tar -xzf reposet-*.tgz -C /tmp/e2e
node /tmp/e2e/package/bin/reposet.js init /tmp/target --yes
```

## Adding a recipe

1. **Create the folder** `recipes/NN-slug/`, where `NN` is the next two-digit id
   and `slug` is kebab-case — for example `recipes/13-funding/`.
2. **Add the files**, mirroring the target repo layout exactly.
3. **Register it** in `src/recipes.json` (`id`, `slug`, `dir`, `title`,
   `description`).
4. **Register any placeholders** the recipe introduces in
   `src/placeholders.json`; `init` fills them and `reposet check` reports them.
5. **Regenerate the merged templates** (required — CI fails on drift):

   ```powershell
   # Windows
   powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/build-templates.ps1
   powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/build-templates.ps1 -Check
   ```

   ```bash
   # macOS / Linux (PowerShell 6+)
   pwsh -NoProfile -File ./scripts/build-templates.ps1 -Check
   ```

6. **Add a row** to the recipe table in `README.md` and, if the recipe is
   optional or has prerequisites, a short `<details>` block.
7. **Decide the default.** Recipes are included by default except `12`. If yours
   is an alternative to an existing recipe, add it to `ALTERNATIVES` in
   `src/recipes.js` and exclude it from `DEFAULT_IDS`.

`templates/generic/` is **generated** — never edit it by hand. If you change a
recipe, re-run the build script; the `-Check` mode is what CI runs.

If a recipe installs a `.gitignore`, do not be surprised by the `gitignore` twin
you will see during `npm pack`: npm silently drops files named `.gitignore` from
tarballs, so `scripts/pack-prepare.js` creates a dotless copy and the installer
renames it back. Leave that machinery alone.

## Changing the CLI

- Zero runtime dependencies. If a change seems to need one, open an issue first.
- CommonJS, Node 18, no build step.
- Never delete files in a target repo — `install.js` only creates, skips, or
  overwrites, and `--dry-run` must stay side-effect free.
- New behaviour needs a test in `test/cli.test.js`.

## Commit style

Commits follow [Conventional Commits](https://www.conventionalcommits.org):
`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `ci:`. The shipped
hooks enforce this in consumer repos; here it is expected but not enforced by CI.

## Pull requests

- Keep pull requests small and single-purpose. One recipe, or one bug, per PR.
- Fill in the PR template — especially the drift-check box.
- CI must be green: template drift, YAML parsing, `node --test`, install from the
  packed tarball, the hook scripts, and a Windows job that runs real Lefthook.
- Update docs when behaviour changes. "The code is the docs" is not how this repo works.

## Licence

By contributing you agree your work is released under the [MIT licence](LICENSE),
the same terms as the project.
