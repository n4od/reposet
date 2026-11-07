'use strict';

const { spawnSync } = require('node:child_process');

const TOKENS = require('./placeholders.json');

/**
 * Longest first, so `OWNER/REPO` wins over `OWNER` and `@your-username` wins
 * over `your-username` in a single left-to-right pass.
 */
const SOURCE = TOKENS.map((t) => t.token)
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join('|');

const BY_TOKEN = new Map(TOKENS.map((t) => [t.token, t]));

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function pattern() {
  // Word boundaries stop `OWNER` matching inside `CODEOWNERS` and `REPO`
  // matching inside `REPOSITORY`.
  return new RegExp(`(?<![A-Za-z0-9_])(?:${SOURCE})(?![A-Za-z0-9_])`, 'g');
}

function valueFor(field, values) {
  switch (field) {
    case 'repoFull':
      return values.owner && values.repo ? `${values.owner}/${values.repo}` : null;
    case 'user':
      return values.user || null;
    case 'org':
      return values.org || null;
    case 'securityEmail':
      return values.securityEmail || values.email || null;
    case 'conductEmail':
      return values.conductEmail || values.email || null;
    case 'owner':
      return values.owner || null;
    case 'repo':
      return values.repo || null;
    default:
      return null;
  }
}

/**
 * Replace every known placeholder that has a value. Unknown or unresolved
 * placeholders are left untouched so `scan()`/`check` can report them.
 * @returns {{text: string, filled: number}}
 */
function fill(text, values) {
  let filled = 0;

  const out = text.replace(pattern(), (token) => {
    const spec = BY_TOKEN.get(token);
    if (!spec) return token;

    const value = valueFor(spec.field, values);
    if (!value) return token;

    filled += 1;
    return (spec.prefix || '') + value;
  });

  return { text: out, filled };
}

/**
 * Find every known placeholder still present in a block of text.
 * @returns {{line: number, token: string, required: boolean}[]}
 */
function scan(text) {
  const hits = [];
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const re = pattern();
    let match;
    while ((match = re.exec(line)) !== null) {
      const spec = BY_TOKEN.get(match[0]);
      hits.push({ line: index + 1, token: match[0], required: Boolean(spec && spec.required) });
    }
  });

  return hits;
}

function isBinary(buffer) {
  return buffer.includes(0);
}

/** `owner/repo` from https, ssh or git+https remote URLs. */
function parseRemote(url) {
  if (!url) return null;

  const match = url.trim().match(/(?:^|[/@])github\.com[:/]+([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!match) return null;

  return { owner: match[1], repo: match[2].replace(/\.git$/i, '') };
}

function git(target, args) {
  const result = spawnSync('git', ['-C', target, ...args], { encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  const out = (result.stdout || '').trim();
  return out || null;
}

/**
 * Best-effort defaults: CI env first, then the target's git remote and config.
 */
function detect(target) {
  const found = {};

  // Prefer the target's own remote; fall back to CI's GITHUB_REPOSITORY.
  const remote = parseRemote(git(target, ['remote', 'get-url', 'origin']));
  if (remote) {
    found.owner = remote.owner;
    found.repo = remote.repo;
  } else {
    const slug = process.env.GITHUB_REPOSITORY;
    if (slug && slug.includes('/')) {
      const [owner, repo] = slug.split('/');
      found.owner = owner;
      found.repo = repo;
    }
  }

  if (process.env.GITHUB_ACTOR) found.user = process.env.GITHUB_ACTOR;

  const email = git(target, ['config', 'user.email']);
  if (email) found.email = email;

  return found;
}

function resolveValues(opts, target) {
  const detected = detect(target);

  return {
    owner: opts.owner || detected.owner,
    repo: opts.repo || detected.repo,
    user: opts.user || detected.user || opts.owner || detected.owner,
    org: opts.org,
    email: opts.email || detected.email,
    securityEmail: opts.securityEmail || opts.email || detected.email,
    conductEmail: opts.conductEmail || opts.email || detected.email,
  };
}

module.exports = {
  TOKENS,
  fill,
  scan,
  isBinary,
  parseRemote,
  detect,
  resolveValues,
};