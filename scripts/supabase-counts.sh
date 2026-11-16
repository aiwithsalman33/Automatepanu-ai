#!/usr/bin/env bash
# Live "how much Supabase is left" counts, reported after every
# checkpoint of the Supabase removal (docs/saas-migration-plan.md).
# Every number is a plain grep so anyone can re-run and audit it.
#   bash scripts/supabase-counts.sh
set -u
cd "$(dirname "$0")/.."

SRC_GLOBS=(--include='*.ts' --include='*.tsx' --include='*.mts' --include='*.mjs')
prod() { grep -v -E '\.test\.(ts|tsx)$|/__tests__/'; }
count() { wc -l | tr -d ' '; }

echo "== 1. files importing @supabase/* (src/)"
echo "   cmd: grep -rlE \"from ['\\\"]@supabase/\" src | (non-test)"
printf '   non-test: %s\n' "$(grep -rlE "from ['\"]@supabase/" src "${SRC_GLOBS[@]}" | prod | count)"
printf '   tests:    %s\n' "$(grep -rlE "from ['\"]@supabase/" src "${SRC_GLOBS[@]}" | grep -E '\.test\.' | count)"

echo "== 2. call sites in src/ (non-test files; occurrences)"
for pat in 'supabase\.from\(' '\.rpc\(' '\.auth\.' '\.storage\.' '\.channel\('; do
  n=$(grep -rnoE "$pat" src "${SRC_GLOBS[@]}" | prod | count)
  printf '   %-18s %s   (cmd: grep -rnoE "%s" src | non-test)\n' "$pat" "$n" "$pat"
done

printf '   %-18s %s   (cmd: grep -rnoE "^\\s*\\.from\\(['"'"'\\"]" src | non-test; multi-line builder chains)\n' \
  '.from( chained' "$(grep -rnoE "^\s*\.from\(['\"]" src "${SRC_GLOBS[@]}" | prod | count)"
printf '   %-18s %s   (cmd: grep -rlE "createServerClient|createBrowserClient|createClient\\(process\\.env\\.NEXT_PUBLIC_SUPABASE" src)\n' \
  'client factories' "$(grep -rlE "createServerClient|createBrowserClient|NEXT_PUBLIC_SUPABASE_URL" src "${SRC_GLOBS[@]}" | prod | count)"

echo "== 3. SQL references (occurrences)"
for dir in supabase/migrations db/migrations; do
  [ -d "$dir" ] || continue
  for pat in 'auth\.uid\(\)' 'auth\.users' '\bstorage\.' 'supabase_realtime'; do
    n=$(grep -rnoE "$pat" "$dir" --include='*.sql' | count)
    printf '   %-20s %-22s %s\n' "$dir" "$pat" "$n"
  done
done

echo "== 4. Supabase env vars"
VARS='NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_[A-Z_]+'
printf '   read by code (src/, non-test files): %s\n' \
  "$(grep -rlE "process\.env\.($VARS)" src "${SRC_GLOBS[@]}" | prod | count)"
for f in .env.example .env.dokploy docker-compose.yml Dockerfile .github/workflows/*.yml; do
  [ -f "$f" ] || continue
  printf '   %-36s %s lines\n' "$f" "$(grep -cE "$VARS" "$f")"
done
