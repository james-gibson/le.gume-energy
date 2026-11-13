---
title: Quickstart
description: Open the manifest, take the daily table, and know which column is the instant.
order: 2
updated: 2026-11-13
tags: start, csv
seeds: starter
---

# Quickstart

Three files answer most questions. Download them, or read them from the repository.

1. **`manifest.json`** is the run receipt: coverage, row counts, field lists, SHA-256 per file,
   the time zone, and the privacy record. Read it before trusting a column.
2. **`solar-production-daily.csv`** is the analysis table: production, weather, the normalized
   index, the seasonal baseline and the residual.
3. **`energy-daily-joined.csv`** is the utility join: production, consumption, export, net and
   self-consumption, keyed by local date.

```python
import pandas as pd

day = pd.read_csv('solar-production-daily.csv', parse_dates=['date_local'])
day.loc[day.clear_day == 1, ['date_local', 'production_kwh', 'residual']].tail()
```

## The one rule

Use `date_local` to join, and `interval_start_utc` when two local timestamps could be the same
instant. Local time is what the meter and the reader use; UTC is what survives the autumn
transition. Both are in every interval row.

## Next

- [Regenerate the export](/guides/regenerate) if you have the collector databases.
- [Query the series](/guides/query) for the self-consumption arithmetic.
