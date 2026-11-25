import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import lint from '@commitlint/lint';
import load from '@commitlint/load';

const {
  values: { from, to },
} = parseArgs({
  options: {
    from: { type: 'string' },
    to: { type: 'string' },
  },
});

if (!from || !to) {
  throw new Error('Specify both --from <base> and --to <head>.');
}

const commits = execFileSync(
  'git',
  [
    'log',
    '--no-merges',
    '-z',
    '--format=%H%x00%B',
    '--end-of-options',
    `${from}..${to}`,
    '--',
  ],
  { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 },
).split('\0');
commits.pop();

const config = await load();
const options = {
  defaultIgnores: config.defaultIgnores,
  ignores: config.ignores,
  parserOpts: config.parserPreset?.parserOpts,
  plugins: config.plugins,
};

for (let index = 0; index < commits.length; index += 2) {
  const sha = commits[index].slice(0, 7);
  const message = commits[index + 1];
  if (!message.trim()) {
    console.error(`${sha} commit message is empty`);
    process.exitCode = 1;
    continue;
  }

  const result = await lint(message, config.rules, options);
  const problems = [...result.errors, ...result.warnings];
  if (problems.length) {
    console.error(`${sha} ${message.split('\n', 1)[0]}`);
    for (const problem of problems) {
      console.error(`  ${problem.message} [${problem.name}]`);
    }
  }

  if (!result.valid) {
    process.exitCode = 1;
  }
}

console.log(`Commit messages checked (${commits.length / 2}).`);
