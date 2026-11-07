'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const recipes = require('./recipes');
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

const HELP = `${bold('repox')} ${dim('v' + pkg.version)}

Add issue forms, PR templates, CI, Dependabot, CodeQL, release notes and
working git hooks to any repository. Zero dependencies.

${bold('Usage')}
  npx repox init [target] [options]
  npx repox list

${bold('Commands')}
  init [target]     Copy recipes into a repository (default: current directory)
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

${bold('Examples')}
  npx repox init
  npx repox init ../my-app --only pr-template,dependabot,root-files
  npx repox init . --all --yes

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
  };

  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    switch (arg) {
      case '--help':
      case '-h':
        opts.help = true;
        break;
      case '--version':
      case '-v':
        opts.version = true;
        break;
      case '--all':
        opts.all = true;
        break;
      case '--force':
      case '-f':
        opts.force = true;
        break;
      case '--dry-run':
      case '-n':
        opts.dryRun = true;
        break;
      case '--yes':
      case '-y':
        opts.yes = true;
        break;
      case '--json':
        opts.json = true;
        break;
      case '--only': {
        const value = argv[i + 1];
        if (!value || value.startsWith('-')) {
          throw new UsageError('--only needs a value, for example --only 02,05');
        }
        opts.only = value;
        i += 1;
        break;
      }
      default:
        if (arg.startsWith('--only=')) {
          opts.only = arg.slice('--only='.length);
        } else if (arg === '--') {
          positional.push(...argv.slice(i + 1));
          i = argv.length;
        } else if (arg.startsWith('-')) {
          throw new UsageError(`Unknown option: ${arg}`);
        } else {
          positional.push(arg);
        }
    }
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
      throw new UsageError(`Unknown recipe '${part}'. Run: repox list`);
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

// ------------------------------------------------------------------ init ----

function nextSteps(selected) {
  const ids = new Set(selected.map((r) => r.id));
  const steps = [];

  steps.push('Replace placeholders: OWNER/REPO, @your-username, security@example.com, conduct@example.com');

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

  const items = plan(selected, target, { force: opts.force });
  const counts = apply(items, { dryRun: opts.dryRun });

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

  console.log(`${bold('Done.')} ${parts.join(', ')} — ${selected.length} recipes.`);

  if (counts.skipped && !opts.force) {
    console.log(dim('Existing files were left alone. Use --force to overwrite them.'));
  }

  console.log('');
  console.log(bold('Next steps'));
  nextSteps(selected).forEach((step, index) => {
    console.log(`  ${dim(String(index + 1) + '.')} ${step}`);
  });
  console.log('');
}

// ------------------------------------------------------------------ main ----

async function main(argv) {
  let opts;

  try {
    opts = parseArgs(argv);
  } catch (error) {
    console.error(red(`error: ${error.message}`));
    console.error(dim('Run: repox --help'));
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

    if (opts.command !== 'init') {
      throw new UsageError(`Unknown command '${opts.command}'. Try: init or list`);
    }

    await init(opts);
  } catch (error) {
    const known = error instanceof UsageError;
    console.error(red(`error: ${error.message}`));
    if (known) console.error(dim('Run: repox --help'));
    process.exitCode = known ? 2 : 1;
  }
}

module.exports = { main, parseArgs, selectRecipes };
