#!/usr/bin/env node
// Launcher for the DB suite (`npm run test:db`).
//
// On Windows, a shell whose cwd uses a lower-case drive letter (`d:\…`,
// as Git Bash and some editors produce) makes Vite load `vitest` twice
// (`d:` vs `D:`), and every DB test file then dies with "Vitest failed
// to find the runner". Re-launching from the canonical path fixes it;
// on Linux/macOS this is a no-op.
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync.native(
  join(dirname(fileURLToPath(import.meta.url)), '..', '..')
);
const require = createRequire(join(root, 'package.json'));
const vitestBin = join(
  dirname(require.resolve('vitest/package.json')),
  'vitest.mjs'
);

const result = spawnSync(
  process.execPath,
  [
    vitestBin,
    'run',
    '--config',
    'vitest.db.config.mts',
    ...process.argv.slice(2),
  ],
  { cwd: root, stdio: 'inherit' }
);
process.exit(result.status ?? 1);
