---
title: Regenerate the export
description: Run the exporter, understand its three checks, and keep the previous good export.
order: 2
updated: 2026-11-13
tags: export, verification
seeds: starter, agent-operations
---

# Regenerate the export

The exporter is `scripts/energy-export/export_local.py`. It reads three SQLite databases and writes
the files under `public/data/`.

## Inputs

| Source | What it supplies |
| --- | --- |
| SolarEdge collector | Production intervals, daily/monthly/yearly energy, panel metadata |
| Xcel collector | Utility intervals and the monthly gas series |
| Analysis database | Weather, normalized index, residual, events |

The defaults are machine-specific. Pass the paths explicitly:

```bash
python3 scripts/energy-export/export_local.py \
  --solaredge-db /path/to/solaredge.sqlite3 \
  --xcel-db /path/to/xcel-usage.sqlite3 \
  --analysis-db /path/to/analysis.sqlite3 \
  --out public/data
```

The analysis database is optional. Without it the daily production still exports; the normalized
columns are blank.

## The three checks

1. **Collector agreement.** Local time is recomputed from UTC and compared with the collector's
   stored local rendering. A wrong offset aborts the run.
2. **Output round-trip.** Every `*_local` timestamp must denote the same instant as its `*_utc`.
3. **Identifier scan.** Every CSV is searched for the excluded site, account, address, postal,
   coordinate, meter, account and serial values. A hit reports the category, never the value.

The run stages into a temporary directory. Only after all three pass does it replace
`public/data/`. A failed run leaves the previous export untouched.

## Then build

```bash
npm run build
npm run smoke
```

The publish guard is inside `npm run build`. It does not know about the SQLite sources; it checks
what actually reached `dist/`.
