'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const recipes = require('./recipes');
const placeholders = require('./placeholders');
const { plan, apply } = require('./install');
const pkg = require('../package.json');

// ---------------------------------------------------------------- output ----

const color = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code) => (s) => (color ? `\u001b[${code}m${s}\u001b[0m` : String(s));
const bold = paint('1');
const dim = paint('2');
const green = paint('32');
const red = paint('31');
const yellow = paint('33');
const cyan = paint('36');

class UsageError extends Error {}

const REQUIRED_TOKENS = new Set(
  placeholders.TOKENS.filter((token) => token.required).map((token) => token.token)
);

const HELP = `${bold('reposet')} ${dim('v' + pkg.version)}

Add issue forms, PR templates, CI, Dependabot, CodeQL, release notes and
working git hooks to any repository. Zero dependencies.

${bold('Usage')}
  npx reposet init [target] [options]
  npx reposet check [target] [options]
  npx reposet list

${bold('Commands')}
  init [target]     Copy recipes into a repository (default: current directory)
  check [target]    Report placeholders still left in installed files
  list              Show every recipe

${bold('Options')}
  --only <list>     Recipe ids or names, comma separated (02,05 / pr-template,dependabot)
  --all             Every recipe except 12 (default)
  --force, -f       Overwrite files that already exist
  --dry-run, -n     Show what would happen without writing anything
  --yes, -y         Never prompt
  --json            Machine-readable result on stdout
  --help, -h        Show this help
  --version, -v     Show the version

${bold('Placeholders')}
  init fills OWNER/REPO, @your-username and the example emails in files it
  writes. Values are detected from GITHUB_REPOSITORY or the git remote, and
  from git config user.email — override them with:

  --owner <name>          GitHub user or org (OWNER)
  --repo <name>           Repository name (REPO)
  --user <handle>         Handle for @your-username (default: owner)
  --org <name>            Org for the commented your-org examples
  --email <addr>          Email for security@ and conduct@ contacts
  --security-email <addr> Override just the security contact
  --conduct-email <addr>  Override just the conduct contact
  --no-fill               Leave every placeholder untouched

${bold('Examples')}
  npx reposet init
  npx reposet init ../my-app --only pr-template,dependabot,root-files
  npx reposet init . --owner acme --repo widget --email dev@acme.dev
  npx reposet check .

${dim('Made by N4OD — https://github.com/n4od')}
`;

function printList() {
  const rows = recipes.all();
  const w1 = Math.max(...rows.map((r) => r.id.length));
  const w2 = Math.max(...rows.map((r) => r.slug.length));

  console.log('');
  console.log(`  ${bold('#'.padEnd(w1))}  ${bold('recipe'.padEnd(w2))}  ${bold('what it adds')}`);
  for (const r of rows) {
    console.log(`  ${cyan(r.id.padEnd(w1))}  ${r.slug.padEnd(w2)}  ${dim(r.description)}`);
  }
  console.log('');
  console.log(dim('  12 is an alternative to 06 — select it explicitly with --only 12.'));
  console.log('');
}

// ------------------------------------------------------------------ args ----

/** Flags that take a value, mapped to their option name. */
const VALUE_FLAGS = {
  '--only': 'only',
  '--owner': 'owner',
  '--repo': 'repo',
  '--user': 'user',
  '--org': 'org',
  '--email': 'email',
  '--security-email': 'securityEmail',
  '--conduct-email': 'conductEmail',
};

function takeValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) {
    throw new UsageError(`${flag} needs a value`);
  }
  return value;
}

function parseArgs(argv) {
  const opts = {
    command: null,
    target: null,
    only: null,
    all: false,
    force: false,
    dryRun: false,
    yes: false,
    json: false,
    help: false,
    version: false,
    noFill: false,
    owner: null,
    repo: null,
    user: null,
    org: null,
    email: null,
    securityEmail: null,
    conductEmail: null,
  };

  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    switch (arg) {
      case '--help':
      case '-h':
        opts.help = true;
        continue;
      case '--version':
      case '-v':
        opts.version = true;
        continue;
      case '--all':
        opts.all = true;
        continue;
      case '--force':
      case '-f':
        opts.force = true;
        continue;
      case '--dry-run':
      case '-n':
        opts.dryRun = true;
        continue;
      case '--yes':
      case '-y':
        opts.yes = true;
        continue;
      case '--json':
        opts.json = true;
        continue;
      case '--no-fill':
        opts.noFill = true;
        continue;
      case '--':
        positional.push(...argv.slice(i + 1));
        i = argv.length;
        continue;
      default:
        break;
    }

    const equals = arg.indexOf('=');
    if (arg.startsWith('--') && equals !== -1) {
      const flag = arg.slice(0, equals);
      const value = arg.slice(equals + 1);
      if (!Object.prototype.hasOwnProperty.call(VALUE_FLAGS, flag)) {
        throw new UsageError(`Unknown option: ${flag}`);
      }
      if (!value) throw new UsageError(`${flag} needs a value`);
      opts[VALUE_FLAGS[flag]] = value;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(VALUE_FLAGS, arg)) {
      opts[VALUE_FLAGS[arg]] = takeValue(argv, i, arg);
      i += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new UsageError(`Unknown option: ${arg}`);
    }

    positional.push(arg);
  }

  opts.command = positional[0] || null;
  opts.target = positional[1] || null;

  if (positional.length > 2) {
    throw new UsageError(`Unexpected argument: ${positional[2]}`);
  }

  return opts;
}

function selectByName(list) {
  const picked = [];
  for (const part of list) {
    const recipe = recipes.resolve(part);
    if (!recipe) {
      throw new UsageError(`Unknown recipe '${part}'. Run: reposet list`);
    }
    if (!picked.includes(recipe)) picked.push(recipe);
  }
  return picked;
}

function selectRecipes(opts) {
  if (opts.only) {
    const parts = opts.only.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) throw new UsageError('--only needs at least one recipe');
    return selectByName(parts);
  }
  return recipes.defaultSelection();
}

async function promptSelection() {
  if (!process.stdin.isTTY) return recipes.defaultSelection();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

  try {
    const total = recipes.defaultSelection().length;
    const answer = (await ask(`Install all ${total} recipes? [Y/n] `)).trim().toLowerCase();

    if (answer === '' || answer === 'y' || answer === 'yes') {
      return recipes.defaultSelection();
    }

    printList();
    const selection = (await ask('Recipe ids or names, comma separated: ')).trim();
    if (!selection) throw new UsageError('Nothing selected');

    return selectByName(selection.split(',').map((s) => s.trim()).filter(Boolean));
  } finally {
    rl.close();
  }
}

/**
 * Ask for owner/repo only when they could not be detected and we are allowed to
 * be interactive. Blank answers are fine — the placeholder is left in place and
 * `check` will report it later.
 */
async function promptIdentity(opts, target) {
  if (!process.stdin.isTTY || opts.yes || opts.json || opts.dryRun) return;

  const detected = placeholders.detect(target);
  const needOwner = !opts.owner && !detected.owner;
  const needRepo = !opts.repo && !detected.repo;
  if (!needOwner && !needRepo) return;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

  try {
    if (needOwner) {
      const answer = (await ask('GitHub owner (user or org), blank to skip: ')).trim();
      if (answer) opts.owner = answer;
    }
    if (needRepo) {
      const answer = (await ask('Repository name, blank to skip: ')).trim();
      if (answer) opts.repo = answer;
    }
  } finally {
    rl.close();
  }
}

// ------------------------------------------------------------------ init ----

function recipesHavePlaceholders(selected) {
  for (const recipe of selected) {
    for (const file of recipes.filesFor(recipe)) {
      const buffer = fs.readFileSync(file.abs);
      if (!placeholders.isBinary(buffer) && placeholders.scan(buffer.toString('utf8')).length > 0) {
        return true;
      }
    }
  }
  return false;
}

function nextSteps(selected, counts, hasPlaceholders) {
  const ids = new Set(selected.map((r) => r.id));
  const steps = [];
  const remaining = Object.keys(counts.remaining || {}).filter((token) => REQUIRED_TOKENS.has(token));

  if (remaining.length) {
    steps.push(
      `Fill placeholders (${remaining.join(', ')}): reposet init . --owner <owner> --repo <repo> --email <you@example.com>`
    );
  }

  const labels = new Set();
  if (ids.has('01')) {
    ['bug', 'enhancement', 'needs-triage'].forEach((l) => labels.add(l));
  }
  if (ids.has('08')) {
    ['stale', 'documentation', 'ci', 'dependencies', 'tests'].forEach((l) => labels.add(l));
  }
  if (ids.has('09')) {
    ['feature', 'fix', 'breaking', 'performance', 'chore', 'refactor', 'skip-changelog', 'pinned', 'security']
      .forEach((l) => labels.add(l));
  }

  if (labels.size) {
    steps.push(`Create labels (Issues -> Labels): ${[...labels].join(', ')}`);
  }

  if (ids.has('10')) {
    steps.push('Install git hooks: winget install evilmartians.lefthook  then  lefthook install');
  }

  if (hasPlaceholders) {
    steps.push('Re-check any time: reposet check .');
  }

  return steps;
}

async function init(opts) {
  const target = path.resolve(opts.target || '.');

  if (!fs.existsSync(target)) {
    if (opts.dryRun) {
      console.log(dim(`(would create directory ${target})`));
    } else {
      fs.mkdirSync(target, { recursive: true });
      console.log(dim(`Created ${target}`));
    }
  }

  const selected = opts.only || opts.yes ? selectRecipes(opts) : await promptSelection();

  if (selected.length === 0) throw new UsageError('No recipes selected');

  for (const recipe of selected) {
    const alternative = recipes.ALTERNATIVES[recipe.id];
    if (alternative && selected.some((r) => r.id === alternative)) {
      console.log(
        yellow(
          `! ${recipe.slug} is an alternative to ${alternative}; both are selected, so you will get two CI workflows.`
        )
      );
    }
  }

  let values = null;
  const hasPlaceholders = recipesHavePlaceholders(selected);
  if (!opts.noFill && hasPlaceholders) {
    await promptIdentity(opts, target);
    values = placeholders.resolveValues(opts, target);
  }

  const items = plan(selected, target, { force: opts.force });
  const counts = apply(items, { dryRun: opts.dryRun, values });

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          target,
          dryRun: opts.dryRun,
          recipes: selected.map((r) => r.slug),
          counts,
          files: items.map((i) => ({ path: i.rel, status: i.status, recipe: i.recipe })),
        },
        null,
        2
      )
    );
    return;
  }

  if (opts.dryRun) {
    for (const item of items) {
      const mark = item.status === 'create' ? green('+') : item.status === 'overwrite' ? yellow('~') : dim('=');
      console.log(`  ${mark} ${item.rel}${item.status === 'skip' ? dim('  (exists)') : ''}`);
    }
    console.log('');
  }

  if (!fs.existsSync(path.join(target, '.git'))) {
    console.log(yellow('! Not a git repository. Files are written, but nothing is committed.'));
    console.log('');
  }

  const written = opts.dryRun ? 'would be written' : 'files written';
  const parts = [`${green(String(counts.created))} ${written}`];
  if (counts.overwritten) parts.push(`${yellow(String(counts.overwritten))} overwritten`);
  if (counts.skipped) parts.push(`${dim(String(counts.skipped) + ' skipped (exists)')}`);
  if (counts.filled) parts.push(`${green(String(counts.filled))} placeholders filled`);

  console.log(`${bold('Done.')} ${parts.join(', ')} — ${selected.length} recipes.`);

  if (counts.skipped && !opts.force) {
    console.log(dim('Existing files were left alone. Use --force to overwrite them.'));
  }

  const remaining = Object.entries(counts.remaining || {});
  const requiredLeft = remaining.filter(([token]) => REQUIRED_TOKENS.has(token));
  const optionalLeft = remaining.filter(([token]) => !REQUIRED_TOKENS.has(token));

  if (requiredLeft.length) {
    const total = requiredLeft.reduce((sum, [, n]) => sum + n, 0);
    console.log(yellow(`! ${total} required placeholder(s) left: ${requiredLeft.map(([token]) => token).join(', ')}`));
    if (opts.noFill) console.log(dim('  --no-fill was used, so nothing was replaced.'));
  } else if (optionalLeft.length) {
    console.log(
      dim(
        `Optional examples left: ${optionalLeft.map(([token]) => token).join(', ')} — fill with --org if you want them replaced.`
      )
    );
  }

  console.log('');
  console.log(bold('Next steps'));
  const steps = nextSteps(selected, counts, hasPlaceholders);
  if (steps.length === 0) steps.push('Nothing else to do.');
  steps.forEach((step, index) => {
    console.log(`  ${dim(String(index + 1) + '.')} ${step}`);
  });
  console.log('');
}

// ----------------------------------------------------------------- check ----

/** Every path any recipe can install, so `check` never scans unrelated files. */
function installedPaths() {
  const paths = new Set();
  for (const recipe of recipes.all()) {
    for (const file of recipes.filesFor(recipe)) paths.add(file.rel);
  }
  return [...paths].sort();
}

function check(opts) {
  const target = path.resolve(opts.target || '.');
  const hits = [];
  let files = 0;

  for (const rel of installedPaths()) {
    const abs = path.join(target, rel);
    if (!fs.existsSync(abs)) continue;

    const buffer = fs.readFileSync(abs);
    if (placeholders.isBinary(buffer)) continue;

    files += 1;
    for (const hit of placeholders.scan(buffer.toString('utf8'))) {
      hits.push({ path: rel, line: hit.line, token: hit.token, required: hit.required });
    }
  }

  const required = hits.filter((hit) => hit.required);
  const ok = required.length === 0;

  if (opts.json) {
    const counts = {};
    for (const hit of hits) counts[hit.token] = (counts[hit.token] || 0) + 1;

    console.log(JSON.stringify({ target, ok, files, placeholders: hits, counts }, null, 2));
    if (!ok) process.exitCode = 1;
    return;
  }

  if (hits.length === 0) {
    console.log(`${green('OK')} — no placeholders left in ${files} installed file(s).`);
    return;
  }

  for (const hit of hits) {
    const mark = hit.required ? red('!') : dim('·');
    console.log(`  ${mark} ${hit.path}:${hit.line}  ${hit.token}`);
  }
  console.log('');

  if (ok) {
    console.log(
      `No required placeholders left; ${dim(String(hits.length) + ' optional')} (commented examples) in ${files} file(s).`
    );
    return;
  }

  console.log(
    `${red(String(required.length))} required placeholder(s) left in ${files} installed file(s).`
  );
  console.log(dim('Fill them: reposet init . --owner <owner> --repo <repo> --email <you@example.com>'));
  process.exitCode = 1;
}

// ------------------------------------------------------------------ main ----

async function main(argv) {
  let opts;

  try {
    opts = parseArgs(argv);
  } catch (error) {
    console.error(red(`error: ${error.message}`));
    console.error(dim('Run: reposet --help'));
    process.exitCode = 2;
    return;
  }

  if (opts.version) {
    console.log(pkg.version);
    return;
  }

  if (opts.help || !opts.command) {
    console.log(HELP);
    return;
  }

  try {
    if (opts.command === 'list') {
      const problems = recipes.validate();
      printList();
      if (problems.length) {
        for (const problem of problems) console.log(red(`! ${problem}`));
        process.exitCode = 1;
      }
      return;
    }

    if (opts.command === 'check') {
      check(opts);
      return;
    }

    if (opts.command !== 'init') {
      throw new UsageError(`Unknown command '${opts.command}'. Try: init, check or list`);
    }

    await init(opts);
  } catch (error) {
    const known = error instanceof UsageError;
    console.error(red(`error: ${error.message}`));
    if (known) console.error(dim('Run: reposet --help'));
    process.exitCode = known ? 2 : 1;
  }
}

module.exports = { main, parseArgs, selectRecipes };