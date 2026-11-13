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
| `src/pages/Charts.tsx` | Renders four SVG charts from that JSON |

`npm run build` runs the extractor first, so the charts cannot describe a different export than
the files under `public/data/`. Run it alone with:

```bash
npm run charts
```

## Why no chart library

The site already ships React and Tailwind. A charting dependency would add a renderer, a theme
model and a second source of truth for colours, in exchange for scales this page computes in a
few lines. The four charts are a bar series, a scatter, an area line and a ratio line.

The trade is real: there is no zoom, no brushing, no tooltip library. Tooltips are `<title>`
elements inside each mark, so the numbers survive without JavaScript, and the accessible name is
on the figure.

## What is plotted

- Monthly production, all 40 months.
- Clear-day residual, every clear day in the analysis.
- One clear day at 15-minute resolution: the highest-energy day in the record.
- The self-consumption ratio over the utility window.

## The sparse-interval trap

The 15-minute series contains production intervals, not a full day of zeros. The day curve is a
shape, not an energy total; the daily table is the authority. If you integrate the curve, you will
be a few percent low.
