# Energy export

`export_local.py` turns the SolarEdge, Xcel and analysis databases into the eleven CSVs and the
manifest under `public/data/`.

## Run

```bash
python3 scripts/energy-export/export_local.py \
  --solaredge-db /path/to/solaredge.sqlite3 \
  --xcel-db /path/to/xcel-usage.sqlite3 \
  --analysis-db /path/to/analysis.sqlite3 \
  --out public/data
```

The analysis database is optional; without it the daily production still exports and the
normalized columns are blank. The collector paths are machine-specific and are not published.

## Checks

1. Local time is recomputed from UTC and compared with the collector's stored rendering.
2. Every exported `*_local` timestamp must denote the same instant as its `*_utc` pair.
3. Every CSV is scanned for the excluded identifiers before publication.

Output is staged, verified, then swapped. A failed run leaves the previous good export untouched.

## Fields

Columns are a fixed whitelist. Adding one means updating the privacy record in `manifest()` in the
same commit. If a value could reconstruct a person or an address, it does not belong here.

## Schedule

The export reads databases that only exist on the collector machine, so CI cannot run it. It runs
here, daily, as a launchd agent:

```bash
cp collector.env.example collector.env && chmod 600 collector.env   # fill in the three paths
./install.sh            # symlink into ~/Library/LaunchAgents and load
./install.sh status     # loaded? when did it last run? what did it say?
./install.sh run        # one run now, through launchd
./install.sh uninstall
```

`refresh.sh` is the job body: export → `npm run build` under every gate → commit `public/data` and
`src/data/charts.json` → push. The push is what deploys, because `deploy.yml` publishes main; if a
gate fails, nothing is committed and the site keeps the last good record.

- **It skips quietly when the collector is not mounted.** A laptop is allowed to be closed. The age
  of the published record is judged in CI by `.github/workflows/freshness.yml` (`--max-age 2`), not
  by a local job that would cry wolf every night.
- **`collector.env` is gitignored.** Machine paths stay off the published site, as this README says
  they must.
- **The page states the age regardless.** `npm run freshness --require-stamp dist` fails the build
  if the charts page stops saying how old the record is, so an offline collector produces a dated
  page rather than a page that looks current.
