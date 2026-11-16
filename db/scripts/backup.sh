#!/bin/sh
# Periodic logical backup, run by the compose `backup` service.
#
# Every BACKUP_INTERVAL_HOURS (default 24): pg_dump -Fc of $PGDATABASE
# into /backups/<db>-<UTC timestamp>.dump, written to a temp file and
# renamed only on success (no half-written "latest" dump). Dumps older
# than BACKUP_RETENTION_DAYS (default 14) are deleted.
#
# Connection comes from the standard libpq env (PGHOST, PGUSER,
# PGPASSWORD, PGDATABASE). Restore: see docs/docker.md.
set -eu

INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
DIR=/backups

log() { echo "[backup] $(date -u +%FT%TZ) $*"; }

until pg_isready -q; do
  log "waiting for database…"
  sleep 5
done

while true; do
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  out="$DIR/${PGDATABASE}-${stamp}.dump"
  if pg_dump -Fc --no-password -f "$out.partial"; then
    mv "$out.partial" "$out"
    log "wrote $(basename "$out") ($(du -h "$out" | cut -f1))"
  else
    rm -f "$out.partial"
    log "ERROR: pg_dump failed; will retry next cycle"
  fi
  find "$DIR" -name "${PGDATABASE}-*.dump" -type f -mtime "+${RETENTION_DAYS}" -print -delete \
    | sed 's/^/[backup] pruned /'
  sleep "$((INTERVAL_HOURS * 3600))"
done
