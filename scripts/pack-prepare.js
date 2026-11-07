'use strict';

/**
 * npm hard-excludes files literally named `.gitignore` from published tarballs,
 * so `npx repox init` would silently install a repo without one.
 *
 * Before packing, copy each recipe `.gitignore` to a dotless `gitignore` twin.
 * The installer maps `gitignore` back to `.gitignore` (see src/recipes.js).
 * `scripts/pack-clean.js` removes the twins again after the tarball is built.
 */

const fs = require('node:fs');
const path = require('node:path');

const recipesRoot = path.join(__dirname, '..', 'recipes');

let created = 0;

for (const entry of fs.readdirSync(recipesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const dir = path.join(recipesRoot, entry.name);
  const source = path.join(dir, '.gitignore');
  const twin = path.join(dir, 'gitignore');

  if (fs.existsSync(source)) {
    fs.copyFileSync(source, twin);
    created += 1;
  }
}

console.log(`pack-prepare: created ${created} gitignore twin(s)`);
