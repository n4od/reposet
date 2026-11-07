'use strict';

/**
 * Removes the dotless `gitignore` twins created by scripts/pack-prepare.js.
 * Only deletes a twin when a real `.gitignore` exists next to it, so a stray
 * twin is never mistaken for source.
 */

const fs = require('node:fs');
const path = require('node:path');

const recipesRoot = path.join(__dirname, '..', 'recipes');

let removed = 0;

for (const entry of fs.readdirSync(recipesRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;

  const dir = path.join(recipesRoot, entry.name);
  const source = path.join(dir, '.gitignore');
  const twin = path.join(dir, 'gitignore');

  if (fs.existsSync(source) && fs.existsSync(twin)) {
    fs.unlinkSync(twin);
    removed += 1;
  }
}

console.log(`pack-clean: removed ${removed} gitignore twin(s)`);
