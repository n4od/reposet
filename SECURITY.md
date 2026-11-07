# Security Policy

## Supported versions

The latest published version of `reposet` on npm receives security fixes. This
project is pre-1.0, so only the most recent release is supported.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub:

1. Go to the [Security tab](https://github.com/n4od/reposet/security) → **Report a vulnerability**
   (this opens a [private advisory](https://github.com/n4od/reposet/security/advisories/new)).
2. Or email **naodtiger@gmail.com** with `reposet security` in the subject.

Include, if you can:

- What is affected (the CLI, the installer, a generated workflow or hook)
- Steps to reproduce, or a proof of concept
- The impact you believe it has
- Your `reposet` and Node versions, and your OS

## What to expect

- An acknowledgement within a few days.
- An honest assessment — including "this is by design" if that is the answer.
- Credit in the advisory if you would like it, once a fix is released.

This is a small, unfunded project, so these are best-effort commitments, not a
support contract.

## Scope

In scope:

- The `reposet` CLI and its installer (`bin/`, `src/`)
- The published npm package and the `npm pack` pipeline
- The workflows, hooks and config files the recipes generate

Out of scope (report to the affected project instead):

- Vulnerabilities in GitHub, npm, gitleaks, Lefthook, or other tooling the
  templates point at
- Problems in *your* repository that follow from editing the generated files
- Secrets you committed yourself — the hooks are a convenience, not a guarantee

## A note on the hooks

The git hooks are a client-side convenience. A contributor can bypass them with
`--no-verify` or `LEFTHOOK=0`. Treat enforcement as belonging to CI and branch
protection, not to `pre-commit`.