---
title: The time model
description: Local ISO 8601 with an offset, the same instant in UTC, and why both are published.
order: 3
updated: 2026-11-13
tags: time, dst, sqlite
seeds: starter, agent-operations
---

# The time model

Every interval row carries two representations of one instant:

```text
interval_start_local,interval_start_utc
2026-11-12T00:00:00-07:00,2026-11-12T07:00:00Z
```

`interval_start_local` is ISO 8601 in `America/Denver`, with the offset that was in force.
`interval_start_utc` is the same instant in UTC. `date_local` is the local calendar date and is
the join key for daily tables.

## Why both

Local time alone is ambiguous once a year. When daylight saving ends, 01:00–02:00 occurs twice;
when it starts, 02:00–03:00 does not occur at all. Sorting local strings puts the repeated hour in
the wrong order, and a naive date parser silently picks one of the two. The UTC column is the
tiebreaker, and the offset in the local column makes the intended zone explicit.

## How it is verified

The collector databases store a UTC instant and a collector-rendered local string in different
formats. The exporter ignores the rendering, recomputes local time with `zoneinfo`, and aborts if
the two describe different instants. It then re-reads its own output and checks that every local
timestamp denotes the same instant as its UTC pair.

A wrong offset is a failed run, not a warning. In the 2026-11-13 export, 82,251 source timestamps
were checked with zero disagreements.

## Sparse intervals

SolarEdge returns intervals with production, not a full day of zeros. A summer day can hold fewer
than 96 fifteen-minute rows; a winter day far fewer. Missing rows are not zero-production rows.

Do not divide a daily total by the row count. Use the daily table for energy and the interval
table for shape. The daily endpoint is the authority; the integral of the interval series can
differ from it by a few percent.

## The latest day

The newest day is partial until the next collector run. Its weather-normalized columns are left
blank rather than publishing a residual computed from an older snapshot of the same day.
