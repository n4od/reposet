'use strict';

const fs = require('node:fs');
const path = require('node:path');

const recipes = require('./recipes');

/**
 * Work out what would happen, without touching the filesystem.
 * @param {object[]} selected  recipes from recipes.all()/resolve()
 * @param {string} target      absolute path to the target repository
 * @param {{force?: boolean}} options
 */
function plan(selected, target, options = {}) {
  const force = Boolean(options.force);
  const owner = new Map();
  const items = [];

  for (const recipe of selected) {
    for (const file of recipes.filesFor(recipe)) {
      if (owner.has(file.rel)) {
        throw new Error(
          `Path conflict: '${file.rel}' comes from both '${owner.get(file.rel)}' ` +
            `and '${recipe.slug}'. Select one of them with --only.`
        );
      }
      owner.set(file.rel, recipe.slug);

      const dest = path.join(target, file.rel);
      const exists = fs.existsSync(dest);

      items.push({
        rel: file.rel,
        source: file.abs,
        dest,
        recipe: recipe.slug,
        exec: file.exec,
        status: exists ? (force ? 'overwrite' : 'skip') : 'create',
      });
    }
  }

  return items.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * Execute a plan. Never deletes anything; only writes files.
 */
function apply(items, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const counts = { created: 0, overwritten: 0, skipped: 0 };

  for (const item of items) {
    if (item.status === 'skip') {
      counts.skipped += 1;
      continue;
    }

    if (item.status === 'overwrite') counts.overwritten += 1;
    else counts.created += 1;

    if (dryRun) continue;

    fs.mkdirSync(path.dirname(item.dest), { recursive: true });
    fs.copyFileSync(item.source, item.dest);

    if (item.exec) {
      try {
        fs.chmodSync(item.dest, 0o755);
      } catch {
        // Permission bits are a no-op or restricted on some platforms.
      }
    }
  }

  return counts;
}

module.exports = { plan, apply };
