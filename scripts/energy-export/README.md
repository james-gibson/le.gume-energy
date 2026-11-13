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
