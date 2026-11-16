# Contributing

## Workflow

1. Branch from `main` (e.g. `feat/…`, `fix/…`).
2. Keep each change focused; schema changes go in a **new** numbered file
   under `db/migrations/` with explicit `GRANT`s (never rely on default
   privileges).
3. Before opening a PR, run:

   ```bash
   npm run lint && npm run typecheck && npm test && npm run build
   ```

   Schema or RLS changes must also pass the tenant-isolation suite
   (`npm run test:db`, see [tests/db/README.md](./tests/db/README.md)).

4. Describe what changed and how you verified it in the PR.

## Security

Never commit secrets (`.env*` files are git-ignored). Report
vulnerabilities privately as described in
[.github/SECURITY.md](./.github/SECURITY.md).
