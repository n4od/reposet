'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RECIPES_ROOT = path.join(ROOT, 'recipes');
const manifest = require('./recipes.json');

/** Recipes that are included by default (`--all`). */
const DEFAULT_IDS = manifest
  .filter((r) => r.id !== '12')
  .map((r) => r.id);

/**
 * Recipe 12 defines a workflow also named "CI" and is an alternative to 06,
 * not an addition to it.
 */
const ALTERNATIVES = { '12': '06' };

/**
 * npm hard-excludes files named `.gitignore` from tarballs, so the published
 * package ships them as `gitignore` (see scripts/pack-prepare.js). Map them
 * back to their real name on install.
 */
const INSTALL_NAMES = { gitignore: '.gitignore' };

function installPath(relativePath) {
  const parts = relativePath.split('/');
  const base = parts.pop();
  parts.push(Object.prototype.hasOwnProperty.call(INSTALL_NAMES, base) ? INSTALL_NAMES[base] : base);
  return parts.join('/');
}

function all() {
  return manifest;
}

function defaultSelection() {
  return manifest.filter((r) => DEFAULT_IDS.includes(r.id));
}

/**
 * Accepts "2", "02", "pr-template", "02-pr-template".
 * @returns {object|null}
 */
function resolve(selector) {
  const raw = String(selector).trim().toLowerCase();
  if (!raw) return null;

  const id = raw.padStart(2, '0');
  const normalized = raw.replace(/[^a-z0-9]/g, '');

  return (
    manifest.find((r) => r.id === id) ||
    manifest.find((r) => r.slug === raw || r.dir === raw) ||
    manifest.find((r) => r.slug.replace(/[^a-z0-9]/g, '') === normalized) ||
    null
  );
}

/** Every file a recipe would install, relative to the target repository root. */
function filesFor(recipe) {
  const root = path.join(RECIPES_ROOT, recipe.dir);
  if (!fs.existsSync(root)) {
    throw new Error(`Recipe folder missing: ${recipe.dir}`);
  }

  const out = [];

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        out.push({
          abs: full,
          rel: installPath(path.relative(root, full).split(path.sep).join('/')),
          exec: entry.name.endsWith('.sh'),
        });
      }
    }
  };

  walk(root);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * Sanity-check the manifest against the folders on disk.
 * Used by the test suite and by `reposet list`.
 */
function validate() {
  const problems = [];

  for (const recipe of manifest) {
    const dir = path.join(RECIPES_ROOT, recipe.dir);
    if (!fs.existsSync(dir)) {
      problems.push(`manifest lists '${recipe.dir}' but the folder is missing`);
      continue;
    }
    if (filesFor(recipe).length === 0) {
      problems.push(`recipe '${recipe.dir}' contains no files`);
    }
  }

  const known = new Set(manifest.map((r) => r.dir));
  if (fs.existsSync(RECIPES_ROOT)) {
    for (const entry of fs.readdirSync(RECIPES_ROOT, { withFileTypes: true })) {
      if (entry.isDirectory() && !known.has(entry.name)) {
        problems.push(`folder 'recipes/${entry.name}' is not in src/recipes.json`);
      }
    }
  }

  return problems;
}

module.exports = {
  ROOT,
  RECIPES_ROOT,
  ALTERNATIVES,
  all,
  defaultSelection,
  resolve,
  installPath,
  filesFor,
  validate,
};
