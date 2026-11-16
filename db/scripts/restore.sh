#!/bin/sh
# Restore a pg_dump -Fc backup into the database. Run inside the `backup`
# container (it has the client tools, the backups volume and the
# credentials):
#
#   docker compose exec backup sh /scripts/restore.sh            # list dumps
#   docker compose exec backup sh /scripts/restore.sh latest     # newest dump
#   docker compose exec backup sh /scripts/restore.sh wacrm-20261116T020000Z.dump
#
# Optional second argument: target database name (default $PGDATABASE).
# Restoring into a NEW database first is the safe drill:
#   ... restore.sh latest wacrm_restore_test
#
# Stop the app first when restoring over the live database:
#   docker compose stop app cron
set -eu
DIR=/backups
TARGET="${2:-$PGDATABASE}"

if [ "${1:-}" = "" ]; then
  echo "Backups in $DIR:"
  ls -1t "$DIR"/*.dump 2>/dev/null || echo "  (none yet)"
  exit 0
fi

if [ "$1" = "latest" ]; then
  FILE="$(ls -1t "$DIR"/*.dump 2>/dev/null | head -n1)"
else
  FILE="$DIR/$(basename "$1")"
fi
[ -f "$FILE" ] || { echo "No such backup: $FILE" >&2; exit 1; }

echo "[restore] $(basename "$FILE") -> database '$TARGET'"
if [ "$TARGET" != "$PGDATABASE" ]; then
  psql -v ON_ERROR_STOP=1 -d postgres -c "DROP DATABASE IF EXISTS \"$TARGET\"" -c "CREATE DATABASE \"$TARGET\""
fi
# --clean --if-exists: replace objects in place; --no-owner keeps the
# original owners (roles already exist cluster-wide).
pg_restore --clean --if-exists --exit-on-error -d "$TARGET" "$FILE"
echo "[restore] done. Row counts:"
psql -d "$TARGET" -At -c "SELECT 'accounts', count(*) FROM public.accounts UNION ALL SELECT 'users', count(*) FROM auth.users UNION ALL SELECT 'contacts', count(*) FROM public.contacts UNION ALL SELECT 'messages', count(*) FROM public.messages"
