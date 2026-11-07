# Contributing

Thanks for wanting to contribute! This guide keeps things predictable for everyone.

## Before you start

- For anything larger than a typo, **open an issue first** so we can agree on the approach.
- Check existing issues and pull requests to avoid duplicate work.
- Security issues go through [SECURITY.md](SECURITY.md), never the public tracker.

## Development setup

```bash
git clone https://github.com/OWNER/REPO.git
cd REPO

# TODO: replace with your real setup
# npm ci        |  pip install -e ".[dev]"  |  go mod download

# Install git hooks (Lefthook) — one time per clone
lefthook install
```

## Project layout

```
# TODO: 2-4 lines explaining where things live
```

## Making a change

1. Create a branch: `git switch -c feat/short-description`
2. Make your change, with tests.
3. Run the checks locally:
   ```bash
   # TODO: replace with your commands
   # npm run lint && npm test
   ```
4. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   ```
   feat(auth): add password reset flow
   fix(api): handle empty response body
   docs: clarify install steps
   ```
5. Push and open a pull request against `main`.

## Pull request expectations

- One logical change per PR. Split unrelated refactors out.
- Describe **what** changed and **why**, plus how you tested it.
- Keep the diff reviewable. Large PRs get reviewed slowly or not at all.
- A maintainer will review. Address feedback by pushing new commits
  (we squash on merge, so don't force-push mid-review unless asked).

## Code style

- Match the style of the surrounding code.
- Formatting is enforced by tooling, not review comments.
  Run the formatter before pushing.
- Add tests for behavior changes. Bug fixes should include a failing test first.

## Commit message rules

Enforced by the `commit-msg` hook:

```
<type>(<optional scope>): <description>

type = feat | fix | docs | style | refactor | perf | test | build | ci | chore | revert
```

Breaking changes use `!`: `feat(api)!: remove v1 endpoints`.

## Licensing

By contributing you agree that your contributions are licensed under the
same license as this project.
