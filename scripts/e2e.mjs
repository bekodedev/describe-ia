// pnpm test:e2e
// Starts the whole stack in Docker Compose with the fake model (LLM_FAKE=1), seeds the demo products,
// runs the Playwright tests of apps/web/e2e-stack against it, and always tears it down.
// It uses its own Compose project, so your development database and photos are not touched;
// stop the development stack first (it uses the same ports).
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync } from 'node:fs';

const project = ['-p', 'describe-ia-e2e'];
const env = { ...process.env, LLM_FAKE: '1', STACK_SEEDED: '1' };
const shell = process.platform === 'win32';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell, env, ...options });
  return result.status ?? 1;
}

if (!existsSync('.env')) {
  copyFileSync('.env.example', '.env'); // the fake model needs no key
  console.log('Created .env from .env.example');
}

let status = 1;
try {
  if (run('docker', ['compose', ...project, 'up', '-d', '--build', '--wait']) !== 0) {
    throw new Error('The stack did not start (is another stack using ports 3000, 4000 or 5432?)');
  }
  if (run('docker', ['compose', ...project, 'exec', '-T', 'api', 'pnpm', 'seed:demo']) !== 0) {
    throw new Error('seed:demo failed');
  }
  status = run('pnpm', [
    '--filter',
    'web',
    'exec',
    'playwright',
    'test',
    '-c',
    'playwright.stack.config.ts',
  ]);
  if (status !== 0) run('docker', ['compose', ...project, 'logs', '--tail', '60', 'api', 'web']);
} catch (error) {
  console.error(error.message);
  run('docker', ['compose', ...project, 'logs', '--tail', '60']);
} finally {
  run('docker', ['compose', ...project, 'down', '-v']);
}
process.exit(status);
