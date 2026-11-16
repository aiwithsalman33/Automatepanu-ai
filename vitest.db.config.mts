import { defineConfig } from 'vitest/config';

// DB-backed suite (tenant isolation, privilege guards). Needs a running
// Postgres — see tests/db/README.md. Kept out of `npm test` so the unit
// suite stays dependency-free. Run it via `npm run test:db`
// (tests/db/run.mjs), which also works around a Windows drive-letter
// casing issue that otherwise loads vitest twice.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    include: ['tests/db/**/*.test.ts'],
    // One connection + one never-committed transaction per file; run
    // files one at a time so globally-unique values can't contend.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    clearMocks: true,
  },
});
