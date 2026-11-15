---
title: Cornichon — a chart that is a file, not a library
description: A committed summary derived from the published CSVs, and an SVG drawn at build time, so the page has no chart runtime and no second copy of the numbers.
order: 3
updated: 2026-11-13
slots: data, metric, window
presumes: node-22, csv, svg, no-chart-library
tags: isotope, charts, build
seeds: isotopes, agent-operations
---

# Cornichon — a chart that is a file, not a library

This page is called **cornichon** — a small gherkin, picked often. A recurring job that turns one
published table into one picture, at build time, and leaves the picture as text you can read in a
diff.

It is the isotope this site runs: `npm run charts` regenerates `src/data/charts.json`, and the build
runs it before Vite ever sees the route.

## What it proves

A chart does not need a runtime. If the data is already a file in the repository, the chart can be:

1. a **derivation** — a small script that reads the published CSV and writes a committed summary;
2. a **summary** — JSON small enough to bundle, with the source file named inside it;
3. a **renderer** — a React route that draws SVG from the summary with `currentColor`.

The result is a chart that works with JavaScript off, survives a hard reload, and cannot describe a
different export than the one on disk.

## The parts

| Part | File | What it does |
| --- | --- | --- |
| Derivation | `scripts/chart-data.mjs` | Reads four published CSVs, writes `src/data/charts.json` |
| Summary | `src/data/charts.json` | Months, clear-day residuals, one day's curve, self-consumption |
| Renderer | `src/pages/Charts.tsx` | SVG from the summary; no chart library, no fetch |
| Hook | `npm run charts`, and `npm run build` | Regenerates before the build, so a stale summary never ships |
| Contract | `src/content/docs/charts.md` | States the method and the limit next to the picture |

## The shape

The derivation is a handful of `filter`/`map` calls over `parseCsv`, and a `generated_from` block
that names every input:

```js
const daily = await read('solar-production-daily.csv')
const clear = daily
  .filter((row) => row.clear_day === '1' && row.residual !== '')
  .map((row) => ({ d: row.date_local, r: round(row.residual, 4) }))

const payload = {
  generated_from: {
    daily: 'public/data/solar-production-daily.csv',
    /* …three more… */
  },
  summary,
  monthly,
  residuals: clear,
}
```

`generated_from` is the part people skip. A summary without its sources is a rumour with a
timestamp; with them, a reader can regenerate it and a reviewer can diff it.

The renderer is plain SVG, coloured by the page:

```jsx
<rect x={x} y={y} width={bar} height={height} className="text-series-1" fill="currentColor">
  <title>{`${row.m}: ${row.kwh.toFixed(1)} kWh`}</title>
</rect>
```

`currentColor` is not decoration. It lets the chart inherit the site's palette instead of shipping a
second colour system that drifts the first time the theme changes — and it is also what makes the
ink auditable, because the build can read the class and say which token reached the screen. An
`opacity` on the same element would undo that: 85% of a declared ink is an undeclared one, and the
ladder has a token for the case where a shape really is meant to be quieter.


## Why a summary, and not the CSV

The full series is 61,015 interval rows and eleven files. Bundling them to draw forty bars would
cost more than the rest of the site. The summary is the smallest thing that answers the questions the
charts ask — and it is committed, so the diff shows the data moving.

The limit is written on the page: the summary is a fixed set of views. A question outside the set
needs a new field in the script, not a filter in the browser.

## The slots

| Slot | Question | Example |
| --- | --- | --- |
| `data` | Which published file should the summary read? | `solar-production-daily.csv` |
| `metric` | Which column should become the picture? | `residual` |
| `window` | Which range should it cover? | `monthly` |

A shortcut can bind some of them. `…?window=monthly` means "monthly, ask me the other two".

## Agent prompt

```text
You are implementing le.gume isotope cornichon (draw a chart from a published table at build time).

Bound slots: window=monthly
Ask for any slot that is not bound above, one question at a time:
  data   — which published CSV should the summary read?
  metric — which column of it should become the picture?
Then:
1. Read scripts/chart-data.mjs and add a derivation for that metric; extend `generated_from` with
   the file you read. Do not fetch anything at runtime.
2. Commit the regenerated src/data/charts.json in the same change.
3. Render it in src/pages/Charts.tsx as SVG using currentColor. No chart library.
4. State the axis, the unit and one limit in the figure's caption.
5. Run `npm run build`; the guard must pass.
Report: the field added, the source file, the row count, and the caption's stated limit.
```

## What it costs

- **A committed artifact.** It can go stale in a branch; the build regenerates it, so the risk is a
  confusing diff rather than a wrong page — but only because the build runs the script.
- **A summary shape that becomes an API.** Once a page reads `charts.monthly[].kwh`, renaming the
  field is a change in two files and a rebuild. Keep the names boring.
- **No interactivity.** No crosshair, no zoom, no legend toggle. Those are good; they are also a
  chart library, and this isotope exists to show what you get without one.
- **One more thing to run before the build.** It is fast because it is small. A summary that takes a
  minute to derive is a service pretending to be a script.

## Take this, not that

**Take:** the derivation script, the committed summary, `generated_from`, the `currentColor` SVG,
the caption that states the limit.

**Leave:** a chart library, a data fetch at runtime, a second copy of the numbers in prose, and any
interaction you cannot justify in one sentence.

## What would break it

- **Integrating the sparse intervals.** SolarEdge returns only intervals with production. A daily
  total summed from the 15-minute file is wrong, and a chart drawn from it is confidently wrong.
- **Reading `public/data` at runtime.** On Pages that is a fetch, a loading state and a 404 whenever
  the path changes; at build time it is a file.
- **Letting the summary name its fields but not its sources.** `generated_from` is the only reason a
  reviewer can tell which export the picture came from.
- **Drawing the wrong column.** The chart is only as honest as the derivation; the caption and the
  docs page are where that honesty is checked.

## Build it

- The derivation: [`scripts/chart-data.mjs`](https://github.com/james-gibson/le.gume-energy/blob/main/scripts/chart-data.mjs)
- The renderer: [`src/pages/Charts.tsx`](https://github.com/james-gibson/le.gume-energy/blob/main/src/pages/Charts.tsx)
- The method and the limit: [/docs/charts](/docs/charts)
- The isotope format, and the pickle shelf: [/isotopes/what-is-an-isotope](/isotopes/what-is-an-isotope)
