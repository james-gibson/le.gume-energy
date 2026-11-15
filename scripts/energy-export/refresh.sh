#!/bin/bash
#
# refresh.sh — the import job.
#
#   export the collector databases -> rebuild under the gates -> commit -> push
#
# The push is what deploys: deploy.yml rebuilds and publishes anything on main,
# so this never talks to Pages directly. If the gates fail, nothing is committed
# and the site keeps the last good record.
#
# It is deliberately quiet when the collector is not there. A laptop is allowed
# to be closed; the age of the published record is judged by the daily
# `freshness` workflow in CI, not by a local job that would cry wolf every night.
#
#   ./refresh.sh            one run (what launchd calls)
#   ./refresh.sh --dry-run  export and report, commit nothing
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$DIR/../.." && pwd)"
LOG="$DIR/logs/refresh.log"
DRY=""
[ "${1:-}" = "--dry-run" ] && DRY="1"

mkdir -p "$DIR/logs"
say() { printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "$LOG"; }

# launchd starts with a bare PATH; node lives under nvm on this machine.
NVM_BIN="$HOME/.nvm/versions/node/v24.21.0/bin"
[ -d "$NVM_BIN" ] && export PATH="$NVM_BIN:$PATH"

cd "$REPO"

# --- the machine-local paths, never committed ------------------------------
if [ -f "$DIR/collector.env" ]; then
	set -a
	# shellcheck disable=SC1091
	. "$DIR/collector.env"
	set +a
fi

missing=()
for name in SOLAREDGE_DB XCEL_DB; do
	eval "value=\${$name:-}"
	if [ -z "$value" ] || [ ! -f "$value" ]; then
		missing+=("$name=${value:-unset}")
	fi
done

if [ "${#missing[@]}" -gt 0 ]; then
	say "collector not mounted (${missing[*]}); nothing to import"
	say "the published record stays as it is — CI judges its age, not this job"
	exit 0
fi

# --- export ----------------------------------------------------------------
say "exporting from $SOLAREDGE_DB and $XCEL_DB"
args=(--solaredge-db "$SOLAREDGE_DB" --xcel-db "$XCEL_DB" --out "$REPO/public/data")
[ -n "${ANALYSIS_DB:-}" ] && [ -f "$ANALYSIS_DB" ] && args+=(--analysis-db "$ANALYSIS_DB")
python3 "$DIR/export_local.py" "${args[@]}" >>"$LOG" 2>&1 || {
	say "export failed — the previous good export is untouched, nothing published"
	exit 1
}

if git diff --quiet -- public/data; then
	say "export ran, no new rows; nothing to publish"
	exit 0
fi
say "new rows: $(git diff --numstat -- public/data | awk '{a+=$1; d+=$2} END {printf "+%d/-%d lines", a, d}')"

if [ -n "$DRY" ]; then
	say "dry run: not rebuilding, committing, or pushing"
	exit 0
fi

# --- rebuild under the gates, then publish --------------------------------
# npm run build runs the contrast, freshness, overflow and publish guards. A
# failure here is the point: a record that fails its own gates does not ship.
if ! npm run build >>"$LOG" 2>&1; then
	say "build failed — nothing committed, the last good record stays published"
	git checkout -- public/data src/data/charts.json 2>/dev/null || true
	exit 1
fi

git add public/data src/data/charts.json
git commit -q -m "data: refresh the export $(date -u '+%Y-%m-%dT%H:%MZ')"
say "committed $(git log -1 --format='%h %s')"

if git push origin main >>"$LOG" 2>&1; then
	say "pushed; deploy.yml will rebuild and publish"
else
	say "push failed — the commit is local and will go out on the next run"
	exit 1
fi
