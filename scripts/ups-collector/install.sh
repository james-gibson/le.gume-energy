#!/bin/bash
#
# install.sh — run the UPS collector as a launchd agent, once a minute.
#
#   ./install.sh            install (or reinstall) and load
#   ./install.sh status     is it loaded, when did it last run, what did it say
#   ./install.sh run        one run now, through launchd
#   ./install.sh uninstall  stop and remove the link
#
# The plist lives beside this script and is symlinked into ~/Library/LaunchAgents,
# the same arrangement as scripts/energy-export/install.sh: the repository is the
# source of truth, the symlink is the installation.
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="dev.james-gibson.le-gume-ups.collect"
PLIST="$DIR/$LABEL.plist"
LINK="$HOME/Library/LaunchAgents/$LABEL.plist"
UID_NUM="$(id -u)"
LOG="$DIR/logs/ups.log"

die() { printf '%s\n' "$*" >&2; exit 1; }

case "${1:-install}" in
	install|restart)
		[ -f "$PLIST" ] || die "missing $PLIST"
		plutil -lint "$PLIST" >/dev/null || die "$PLIST does not parse"
		mkdir -p "$DIR/logs"
		launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true
		ln -sfn "$PLIST" "$LINK"
		launchctl bootstrap "gui/$UID_NUM" "$LINK"
		printf 'installed %s\n' "$LABEL"
		if [ ! -f "$DIR/collector.env" ]; then
			printf '\n  no collector.env yet: the job will load but cannot poll.\n'
			printf '  cp %s %s  and set UPS_HOST.\n\n' \
				"$DIR/collector.env.example" "$DIR/collector.env"
		fi
		printf 'runs so far: %s\n' "$(launchctl print "gui/$UID_NUM/$LABEL" 2>/dev/null | awk '/runs = /{print $3; exit}')"
		printf 'schedule: every 60 seconds (StartInterval)\n'
		;;
	status)
		if launchctl print "gui/$UID_NUM/$LABEL" >/dev/null 2>&1; then
			printf 'loaded: %s\n' "$LABEL"
			launchctl print "gui/$UID_NUM/$LABEL" | awk '
				/runs = /      {print "runs: " $3}
				/last exit code = / {print "last exit: " $5}
				/state = /     {print "state: " $3, $4; exit}'
		else
			printf 'not loaded: %s\n' "$LABEL"
		fi
		printf 'collector.env: %s\n' "$([ -f "$DIR/collector.env" ] && echo present || echo missing)"
		printf '\nlast 12 log lines:\n'
		tail -n 12 "$LOG" 2>/dev/null || printf '  (no log yet)\n'
		;;
	run)
		launchctl kickstart -k "gui/$UID_NUM/$LABEL"
		sleep 2
		tail -n 12 "$LOG" 2>/dev/null || true
		;;
	uninstall)
		launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true
		rm -f "$LINK"
		printf 'removed %s\n' "$LABEL"
		;;
	*) die "usage: ./install.sh [install|status|run|uninstall]" ;;
esac
