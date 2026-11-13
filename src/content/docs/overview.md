---
title: The record
description: What the dataset contains, how far it reaches, and what it is not.
order: 1
updated: 2026-11-13
tags: dataset, overview
seeds: homeowner, starter, agent-operations
---

# The record

This site publishes one household's solar and utility record after the identifiers have been
removed. It is not a dashboard and it does not update in the browser: it is a set of CSV files,
a manifest, and the method used to produce them.

## Coverage

| Series | Rows | Window |
| --- | ---: | --- |
| Solar production, 15-minute | 61,019 | 2023-08-14 → 2026-11-13 |
| Solar production, hourly | 17,368 | 2023-08-14 → 2026-11-13 |
| Solar production, daily | 1,188 | 2023-08-14 → 2026-11-13 |
| Solar production, monthly | 40 | 2023-08 → 2026-11 |
| Solar production, yearly | 4 | 2023 → 2026 |
| Grid usage, 15-minute | 431 | 2025-08-29 → 2026-11-13 |
| Grid usage, hourly | 3,023 | 2025-05-01 → 2026-11-13 |
| Grid usage, daily | 336 | 2025-05-01 → 2026-11-13 |
| Grid usage, monthly | 13 | 2025-11 → 2026-11 |
| Joined daily | 1,188 | 2023-08-14 → 2026-11-13 |
| Analysis events | 33 | 2023-10 → 2026-10 |

The system is 7.0 kWp across 21 panels on one string, installed on 2023-02-04 in the
`America/Denver` time zone.

## What it is not

- **Not the raw capture.** The site, account, street address, postal code, coordinates, meter
  key, account id and panel serials were never selected. See [the privacy contract](/docs/privacy).
- **Utility history is a window plus a backfill.** The collector covers 15 minutes for the
  current day, hourly for two days and daily for about 30 days. A backfilled May–August 2025
  hourly/15-minute history fills the earlier gap. Daily utility coverage then has a gap until the
  collector window opens again in October 2026; one 15-minute window on 2026-09-20 is present at
  interval resolution only. Backfilled daily rows have no TOU split, so on/off-peak columns are empty.
- **Not panel-level.** `panel_usage` is empty, so there is no per-array or A/B series here.
- **Not proof of soiling.** The analysis events are screening flags. Rain, snow and outages
  imitate cleaning and soiling; the weather context is how they are separated.

## Start here

- [Quickstart](/docs/quickstart) — the three files worth opening first.
- [Time model](/docs/time-model) — local time, UTC, and the DST repeat.
- [Normalization](/docs/normalization) — how a raw kWh becomes a residual.
- [Charts](/charts) — monthly production, clear-day residuals, one clear day, self-consumption.
- [The universe](/universes) — the record as local-time segments and keyframes.
- [How the charts are built](/docs/charts) — the build-time summary and the SVG.
- [Download](/guides/download) — every file, with links and counts.
