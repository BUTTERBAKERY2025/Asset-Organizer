#!/usr/bin/env bash
set -euo pipefail

if [[ "${NODE_ENV:-development}" == "production" ]]; then
  echo "Refusing to run a development migration with NODE_ENV=production." >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required." >&2
  exit 1
fi

db_host="$(node -e 'try { console.log(new URL(process.env.DATABASE_URL).hostname) } catch { process.exit(2) }')"
case "$db_host" in
  localhost|127.0.0.1|::1|helium|*.helium|*.helium.internal) ;;
  *)
    echo "Refusing remote database target: $db_host. This script is development-only." >&2
    exit 1
    ;;
esac

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/branch-complaints.sql