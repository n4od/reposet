'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'repox.js');
const pkg = require('../package.json');

function run(args, options = {}) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    ...options,
  });
}

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repox-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('list shows every recipe and exits 0', () => {
  const result = run(['list']);
  assert.strictEqual(result.status, 0, result.stderr);
  for (const recipe of require('../src/recipes.json')) {
    assert.match(result.stdout, new RegExp(recipe.slug));
  }
});

test('--version prints the package version', () => {
  const result = run(['--version']);
  assert.strictEqual(result.status, 0);
  assert.strictEqual(result.stdout.trim(), pkg.version);
});

test('no arguments prints help', () => {
  const result = run([]);
  assert.strictEqual(result.status, 0);
  assert.match(result.stdout, /Usage/);
});

test('init copies every default recipe', (t) => {
  const target = tempDir(t);
  const result = run(['init', target, '--yes']);
  assert.strictEqual(result.status, 0, result.stderr);

  assert.ok(fs.existsSync(path.join(target, '.github', 'pull_request_template.md')));
  assert.ok(fs.existsSync(path.join(target, '.github', 'ISSUE_TEMPLATE', 'bug_report.yml')));
  assert.ok(fs.existsSync(path.join(target, '.githooks', 'commit-msg.sh')));
  assert.ok(fs.existsSync(path.join(target, '.editorconfig')));
  assert.ok(fs.existsSync(path.join(target, 'lefthook.yml')));

  // Recipe 12 must not be included by default: it would add a duplicate CI workflow.
  assert.ok(!fs.existsSync(path.join(target, '.github', 'workflows', 'ci-caller.yml')));
});

test('init --only accepts ids and slugs', (t) => {
  const target = tempDir(t);
  const result = run(['init', target, '--only', '2,root-files', '--yes']);
  assert.strictEqual(result.status, 0, result.stderr);

  assert.ok(fs.existsSync(path.join(target, '.github', 'pull_request_template.md')));
  assert.ok(fs.existsSync(path.join(target, '.gitignore')));
  assert.ok(!fs.existsSync(path.join(target, '.github', 'ISSUE_TEMPLATE')));
  assert.ok(!fs.existsSync(path.join(target, 'lefthook.yml')));
});

test('running twice leaves existing files untouched', (t) => {
  const target = tempDir(t);
  run(['init', target, '--only', 'root-files', '--yes']);

  const file = path.join(target, '.gitignore');
  fs.writeFileSync(file, '# mine\n');

  const result = run(['init', target, '--only', 'root-files', '--yes']);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), '# mine\n');
  assert.match(result.stdout, /skipped/);
});

test('--force overwrites existing files', (t) => {
  const target = tempDir(t);
  run(['init', target, '--only', 'root-files', '--yes']);

  const file = path.join(target, '.gitignore');
  fs.writeFileSync(file, '# mine\n');

  const result = run(['init', target, '--only', 'root-files', '--yes', '--force']);
  assert.strictEqual(result.status, 0, result.stderr);

  const written = fs.readFileSync(file, 'utf8');
  assert.notStrictEqual(written, '# mine\n');
  assert.match(written, /OS junk/);
});

test('--dry-run writes nothing', (t) => {
  const target = tempDir(t);
  const result = run(['init', target, '--yes', '--dry-run']);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.deepStrictEqual(fs.readdirSync(target), []);
  assert.match(result.stdout, /would be written/);
});

test('--json reports a machine-readable plan', (t) => {
  const target = tempDir(t);
  const result = run(['init', target, '--only', '02', '--yes', '--json']);
  assert.strictEqual(result.status, 0, result.stderr);

  const parsed = JSON.parse(result.stdout);
  assert.deepStrictEqual(parsed.recipes, ['pr-template']);
  assert.strictEqual(parsed.counts.created, 1);
  assert.strictEqual(parsed.files[0].path, '.github/pull_request_template.md');
});

test('unknown recipe is a usage error (exit 2)', (t) => {
  const target = tempDir(t);
  const result = run(['init', target, '--only', 'nope', '--yes']);
  assert.strictEqual(result.status, 2);
  assert.match(result.stderr, /Unknown recipe/);
});

test('unknown option is a usage error (exit 2)', () => {
  const result = run(['init', '--bogus']);
  assert.strictEqual(result.status, 2);
});

test('hook scripts are marked executable (posix only)', (t) => {
  if (process.platform === 'win32') return;

  const target = tempDir(t);
  run(['init', target, '--only', '10', '--yes']);

  const mode = fs.statSync(path.join(target, '.githooks', 'commit-msg.sh')).mode;
  assert.ok(mode & 0o111, 'expected the executable bit to be set');
});

test('the recipe manifest matches the folders on disk', () => {
  const recipes = require('../src/recipes');
  assert.deepStrictEqual(recipes.validate(), []);
});

test('packaged gitignore twin installs under its real name', () => {
  const recipes = require('../src/recipes');
  assert.strictEqual(recipes.installPath('gitignore'), '.gitignore');
  assert.strictEqual(recipes.installPath('.gitignore'), '.gitignore');
  assert.strictEqual(recipes.installPath('.githooks/commit-msg.sh'), '.githooks/commit-msg.sh');
  assert.strictEqual(recipes.installPath('lefthook.yml'), 'lefthook.yml');
});
