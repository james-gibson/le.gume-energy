---
title: Query the series
description: The self-consumption arithmetic, a pandas join, and the sparse-interval trap.
order: 3
updated: 2026-11-13
tags: pandas, analysis
seeds: homeowner, starter
---

# Query the series

The joined table is the cheapest question to ask: one row per local day, with solar and utility
already aligned.

```python
import pandas as pd

day = pd.read_csv('energy-daily-joined.csv', parse_dates=['date_local'])
day = day[day.grid_series_count > 0]
day[['date_local', 'solar_production_kwh', 'grid_consumption_kwh', 'grid_export_kwh',
     'self_consumed_kwh', 'self_consumption_ratio']].tail(7)
```

## The arithmetic

```text
consumption_kwh       = sum of non-generated daily meter series
export_kwh            = -sum of generated daily meter series
net_grid_kwh          = consumption_kwh - export_kwh
self_consumed_kwh     = production_kwh - export_kwh
self_consumption_ratio = self_consumed_kwh / production_kwh
```

The ratio is empty when production is missing or zero. It can be negative when the meter reports
more export than the solar series reports production; that is a source disagreement, not a
physical result.

## Normalized questions

Use the daily table, not the interval table, for energy:

```python
day = pd.read_csv('solar-production-daily.csv', parse_dates=['date_local'])
clear = day[day.clear_day == 1]
clear.nlargest(10, 'residual')[['date_local', 'residual', 'snowfall_cm', 'precipitation_mm']]
```

## The trap

The interval files are sparse: SolarEdge returns only intervals with production. Missing rows are
not zeros. If you integrate the interval series, you get a shape, not a daily total; the daily
table is the authority and can differ by a few percent.

For the repeated hour when daylight saving ends, filter on `interval_start_utc`, not the local
string.
