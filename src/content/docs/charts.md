---
title: How the charts are built
description: A build-time summary, hand-drawn SVG, and no chart library at runtime.
order: 7
updated: 2026-11-13
tags: charts, svg, build
seeds: starter, agent-operations
---

# How the charts are built

The charts are a live route, not a Markdown page, because the content model does not host
widgets. The route is `/charts`; the data is a small JSON summary; the drawing is SVG.

## The two files

| File | Role |
| --- | --- |
| `scripts/chart-data.mjs` | Reads the published CSVs and writes `src/data/charts.json` |
| `src/pages/Charts.tsx` | Renders eight SVG charts from that JSON |

`npm run build` runs the extractor first, so the charts cannot describe a different export than
the files under `public/data/`. Run it alone with:

```bash
npm run charts
```

## Why no chart library

The site already ships React and Tailwind. A charting dependency would add a renderer, a theme
model and a second source of truth for colours, in exchange for scales this page computes in a
few lines. The charts are bar series, a scatter, area and line series, a stacked split and a
histogram — all of them primitives the browser already draws.

The trade is real: there is no zoom, no brushing, no tooltip library. Tooltips are `<title>`
elements inside each mark, so the numbers survive without JavaScript, and the accessible name is
on the figure.

## What is plotted

- The last sixty days of daily production, with clear days solid and the rest
  faded, a recorded-event band, the house's grid draw where the utility join
  reaches, and a solid rule marking any declared intervention. The window ends
  on the last published day, never on today.
- Declared interventions: what a person did, against which circuit, what was
  measured, and the seven days either side. See [declared interventions](/docs/interventions).
- The clear-day residual before and after each of the last eight recorded
  events — the closest thing the record has to an A/B pair.
- Three thirty-day windows side by side: the last, the one before, and the same
  dates a year earlier. Production, clear-day count, weather-normalized residual
  and, where the utility join reaches, self-consumption and export share.
- Monthly production, all 40 months.
- Calendar years, with the first and last marked as partial by the note.
- Mean output at each clock hour, summer against winter. The denominator is the
  number of *days* in the season, not rows: the intervals are sparse, so a row
  count would reward a sunny month with more intervals.
- One clear day at 15-minute resolution: the highest-energy day in the record.
- The self-consumption ratio over the utility window.
- Where monthly production goes: self-consumed and exported stacked, with the
  house's grid draw as a dot. Only the months the utility join covers, placed by
  date so the gap is visible.
- Clear-day residual, every clear day in the analysis.
- The distribution of that residual, binned at 0.02, with the share inside ±0.02.

Two of these are derived in `scripts/chart-data.mjs` beyond the raw sums:
`diurnal` (mean kW per clock hour per season, over the distinct days) and
`balance` (monthly self-consumed / exported / drawn, over rows the utility series
covers). Both are committed in `src/data/charts.json` with the rest.

## What A/B can and cannot mean here

The record is observational. Two thirty-day windows do not see the same weather,
the same loads or the same daylight, and the residual normalizes for the sun
only — it says the array produced what a clear day of that season should, not
that a change caused it. So the comparison is a way to ask whether a level held
or stepped when nothing else did, and the paired before/after bars are a
screening flag, not a controlled result. A single change in one window and not
the other is the only thing this can isolate; two changes at once cannot be
separated by any window.

## The sparse-interval trap

The 15-minute series contains production intervals, not a full day of zeros. The day curve is a
shape, not an energy total; the daily table is the authority. If you integrate the curve, you will
be a few percent low.
