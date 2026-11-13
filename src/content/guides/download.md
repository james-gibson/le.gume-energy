---
title: Download
description: Every file, its row count, and the manifest that vouches for it.
order: 1
updated: 2026-11-13
tags: csv, manifest
seeds: homeowner, starter
---

# Download

All files are static and served from this site. The manifest records the row count, byte size and
SHA-256 of each file for the current export.

| File | Rows | What it is |
| --- | ---: | --- |
| [`manifest.json`](https://james-gibson.github.io/le.gume-energy/data/manifest.json) | — | Coverage, counts, hashes, privacy record |
| [`solar-production-15min.csv`](https://james-gibson.github.io/le.gume-energy/data/solar-production-15min.csv) | 61,015 | Interval production in kW |
| [`solar-production-hourly.csv`](https://james-gibson.github.io/le.gume-energy/data/solar-production-hourly.csv) | 17,367 | Hourly production in kW |
| [`solar-production-daily.csv`](https://james-gibson.github.io/le.gume-energy/data/solar-production-daily.csv) | 1,188 | Daily kWh, weather, index, residual |
| [`solar-production-monthly.csv`](https://james-gibson.github.io/le.gume-energy/data/solar-production-monthly.csv) | 40 | Monthly kWh |
| [`solar-production-yearly.csv`](https://james-gibson.github.io/le.gume-energy/data/solar-production-yearly.csv) | 4 | Yearly kWh |
| [`grid-usage-15min.csv`](https://james-gibson.github.io/le.gume-energy/data/grid-usage-15min.csv) | 64 | Utility 15-minute series |
| [`grid-usage-hourly.csv`](https://james-gibson.github.io/le.gume-energy/data/grid-usage-hourly.csv) | 94 | Utility hourly series |
| [`grid-usage-daily.csv`](https://james-gibson.github.io/le.gume-energy/data/grid-usage-daily.csv) | 90 | Utility daily series, long format |
| [`grid-usage-monthly.csv`](https://james-gibson.github.io/le.gume-energy/data/grid-usage-monthly.csv) | 13 | Gas therms on the billing cycle |
| [`energy-daily-joined.csv`](https://james-gibson.github.io/le.gume-energy/data/energy-daily-joined.csv) | 1,188 | Production, consumption, export, net, self-consumption |
| [`analysis-events.csv`](https://james-gibson.github.io/le.gume-energy/data/analysis-events.csv) | 33 | Event screening |

## The manifest is the receipt

```python
import json, urllib.request

manifest = json.load(urllib.request.urlopen('https://james-gibson.github.io/le.gume-energy/data/manifest.json'))
print(manifest['generated_at_local'], manifest['timezone'])
for entry in manifest['files']:
    print(entry['name'], entry['rows'], entry['sha256'][:12])
```

Row counts grow as the collectors run. Trust the manifest over this table.

## Format

UTF-8, comma-separated, one header row, LF line endings. Numbers are fixed-precision so a diff
between exports is readable: energy to three decimals, power to four, normalized indices to five,
temperatures to one, cloud cover to zero.

Empty cells mean "not available", not zero. The utility windows do not cover 2023, and the newest
day has no normalized columns.
