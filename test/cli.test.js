'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const BIN = path.join(__dirname, '..', 'bin', 'reposet.js');
const pkg = require('../package.json');

function run(args, options = {}) {
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    ...options,
  });
}

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reposet-'));
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

// ------------------------------------------------------------ placeholders ----

test('init fills placeholders from flags', (t) => {
  const target = tempDir(t);
  const result = run([
    'init', target, '--only', '3,4',
    '--owner', 'acme', '--repo', 'widget', '--user', 'alice', '--email', 'dev@acme.test',
    '--yes',
  ]);
  assert.strictEqual(result.status, 0, result.stderr);

  const security = fs.readFileSync(path.join(target, '.github', 'SECURITY.md'), 'utf8');
  assert.match(security, /github\.com\/acme\/widget/);
  assert.match(security, /dev@acme\.test/);
  assert.doesNotMatch(security, /OWNER\/REPO|security@example\.com/);

  const codeowners = fs.readFileSync(path.join(target, '.github', 'CODEOWNERS'), 'utf8');
  assert.match(codeowners, /@alice/);
  assert.doesNotMatch(codeowners, /your-username/);
});

test('does not substitute tokens inside longer words', (t) => {
  const target = tempDir(t);
  run([
    'init', target, '--only', '4',
    '--owner', 'acme', '--repo', 'widget', '--user', 'alice',
    '--yes',
  ]);

  const text = fs.readFileSync(path.join(target, '.github', 'CODEOWNERS'), 'utf8');
  assert.match(text, /CODEOWNERS/);
  assert.doesNotMatch(text, /CODEacmeS|CODEaliceS/);
  assert.match(text, /@alice/);
});

test('recipes without placeholders get no placeholder hints', (t) => {
  const target = tempDir(t);
  const result = run(['init', target, '--only', '02', '--yes']);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /reposet check/);
  assert.doesNotMatch(result.stdout, /placeholders? filled/);
});

test('--no-fill leaves placeholders untouched', (t) => {
  const target = tempDir(t);
  const result = run([
    'init', target, '--only', '3',
    '--owner', 'acme', '--repo', 'widget', '--email', 'dev@acme.test',
    '--no-fill', '--yes',
  ]);
  assert.strictEqual(result.status, 0, result.stderr);

  const security = fs.readFileSync(path.join(target, '.github', 'SECURITY.md'), 'utf8');
  assert.match(security, /security@example\.com/);
  assert.match(security, /OWNER\/REPO/);
});

test('check exits 1 when required placeholders remain', (t) => {
  const target = tempDir(t);
  run(['init', target, '--only', '3', '--no-fill', '--yes']);

  const result = run(['check', target]);
  assert.strictEqual(result.status, 1, result.stderr);
  assert.match(result.stdout, /security@example\.com/);
  assert.match(result.stdout, /OWNER\/REPO/);
});

test('check exits 0 once placeholders are filled', (t) => {
  const target = tempDir(t);
  run([
    'init', target, '--only', '3',
    '--owner', 'acme', '--repo', 'widget', '--user', 'alice', '--email', 'dev@acme.test',
    '--yes',
  ]);

  const result = run(['check', target]);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
});

test('check exits 0 when only optional examples remain', (t) => {
  const target = tempDir(t);
  run([
    'init', target, '--only', '4',
    '--owner', 'acme', '--repo', 'widget', '--user', 'alice',
    '--yes',
  ]);

  const result = run(['check', target]);
  assert.strictEqual(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /optional/i);
});

test('check --json reports remaining placeholders', (t) => {
  const target = tempDir(t);
  run(['init', target, '--only', '1', '--no-fill', '--yes']);

  const result = run(['check', target, '--json']);
  assert.strictEqual(result.status, 1);

  const parsed = JSON.parse(result.stdout);
  assert.strictEqual(parsed.ok, false);
  assert.ok(parsed.placeholders.length > 0);
  assert.ok(parsed.counts['OWNER/REPO'] >= 1);
});

test('init detects owner and repo from the git remote', (t) => {
  const target = tempDir(t);
  spawnSync('git', ['init', '-q'], { cwd: target });
  spawnSync('git', ['remote', 'add', 'origin', 'https://github.com/acme/widget.git'], { cwd: target });

  const result = run(['init', target, '--only', '3', '--yes']);
  assert.strictEqual(result.status, 0, result.stderr);

  const security = fs.readFileSync(path.join(target, '.github', 'SECURITY.md'), 'utf8');
  assert.match(security, /github\.com\/acme\/widget/);
  assert.doesNotMatch(security, /OWNER\/REPO/);
});

test('placeholder filling does not modify existing files', (t) => {
  const target = tempDir(t);
  const file = path.join(target, '.github', 'SECURITY.md');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'keep security@example.com\n');

  const result = run([
    'init', target, '--only', '3',
    '--owner', 'acme', '--repo', 'widget', '--email', 'dev@acme.test',
    '--yes',
  ]);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(fs.readFileSync(file, 'utf8'), 'keep security@example.com\n');
});

test('--dry-run reports filled placeholders but writes nothing', (t) => {
  const target = tempDir(t);
  const result = run([
    'init', target, '--only', '3',
    '--owner', 'acme', '--repo', 'widget', '--email', 'dev@acme.test',
    '--dry-run', '--yes',
  ]);
  assert.strictEqual(result.status, 0, result.stderr);
  assert.deepStrictEqual(fs.readdirSync(target), []);
  assert.match(result.stdout, /placeholders filled/);
});

test('--json includes placeholder counts', (t) => {
  const target = tempDir(t);
  const result = run(['init', target, '--only', '3', '--no-fill', '--yes', '--json']);
  assert.strictEqual(result.status, 0, result.stderr);

  const parsed = JSON.parse(result.stdout);
  assert.strictEqual(parsed.counts.filled, 0);
  assert.ok(Object.keys(parsed.counts.remaining).length > 0);
});

test('parses the common git remote URL shapes', () => {
  const { parseRemote } = require('../src/placeholders');

  assert.deepStrictEqual(parseRemote('https://github.com/acme/widget.git'), { owner: 'acme', repo: 'widget' });
  assert.deepStrictEqual(parseRemote('git@github.com:acme/widget.git'), { owner: 'acme', repo: 'widget' });
  assert.deepStrictEqual(parseRemote('ssh://git@github.com/acme/widget'), { owner: 'acme', repo: 'widget' });
  assert.deepStrictEqual(parseRemote('git+https://github.com/acme/widget.git'), { owner: 'acme', repo: 'widget' });
  assert.strictEqual(parseRemote('https://gitlab.com/acme/widget.git'), null);
  assert.strictEqual(parseRemote('https://notgithub.com/acme/widget.git'), null);
});
