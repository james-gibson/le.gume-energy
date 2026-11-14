# le.gume energy

A public, non-identifying record of one home solar system: production, weather, utility usage and
the events that explain the gaps, in local time.

<p align="center">
  <a href="https://github.com/james-gibson/le.gume-energy/actions/workflows/deploy.yml"><img src="https://shieldcn.dev/github/ci/james-gibson/le.gume-energy.svg?workflow=deploy.yml&branch=main&variant=secondary" alt="deploy" /></a>
  <a href="https://github.com/james-gibson/le.gume-energy/blob/main/LICENSE"><img src="https://shieldcn.dev/github/license/james-gibson/le.gume-energy.svg?variant=secondary" alt="license" /></a>
  <a href="https://github.com/james-gibson/le.gume-energy/commits/main"><img src="https://shieldcn.dev/github/last-commit/james-gibson/le.gume-energy.svg?variant=secondary" alt="last commit" /></a>
</p>

**Live:** https://james-gibson.github.io/le.gume-energy/

## What this is

A child seed of [le.gume](https://github.com/james-gibson/le.gume): the same content model, derived
navigation, publish guard and GitHub Pages deploy, with the starter's copy replaced by one
dataset. The data is the content; the site is the receipt.

- **1,188 days** of daily production, 2023-08-14 → 2026-11-13, in `America/Denver`.
- **61,015 fifteen-minute intervals**, plus hourly, monthly and yearly aggregates.
- **Utility usage** joined on the local calendar day, including a backfilled May–August 2025 history and the collector’s rolling window.
- **A manifest** with coverage, row counts, SHA-256 per file and the privacy record.
- **Four charts** — monthly production, clear-day residuals, one clear day and self-consumption — rendered as static SVG from a build-time summary.
- **A local-time universe** — `src/universes/energy.ts`, generated from the same CSVs: yearly segments, event keyframes, and a downloadable JSON form.

## Why local time

Every instant is published twice: ISO 8601 local time with its offset, and UTC. Local time is what
a meter and a reader use; UTC is what survives the repeated hour when daylight saving ends. The
exporter recomputes local time from UTC and refuses to publish when the collector disagrees.

## The scrub

The exporter selects a fixed whitelist. Site name, account holder, address, postal code,
coordinates, site/account/meter ids and panel serials are never selected. The staged output is
scanned for those values before it replaces the previous export.

This makes the dataset **pseudonymous, not anonymous**: a 15-minute production trace is a
behavioural fingerprint, and the retained system facts narrow the population. The manifest says so
rather than hiding it.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Regenerate the universe and chart summaries, `tsc --noEmit`, Vite build, prerender, `llms.txt`, publish guard |
| `npm run smoke` | Renders every route to a string; fails on a render error |
| `npm run guard` | The guard alone, against an existing `dist/` |
| `npm run preview` | Serve the production build locally |

Node 22+. Nothing else is required to read the site.

## Regenerate the data

```bash
python3 scripts/energy-export/export_local.py \
  --solaredge-db /path/to/solaredge.sqlite3 \
  --xcel-db /path/to/xcel-usage.sqlite3 \
  --analysis-db /path/to/analysis.sqlite3 \
  --out public/data
```

The collector paths are machine-specific. The exporter stages, verifies and only then swaps
`public/data/`; a failed run leaves the previous good export in place. See
[the regenerate guide](https://james-gibson.github.io/le.gume-energy/guides/regenerate/).

## Layout

```text
src/content/<section>/<slug>.md   pages; the path is the URL
src/lib/content.ts                the content model: glob, ordering, headings, neighbours
src/lib/seeds.ts                  the audience registry and the readiness scale
scripts/verify-publish.mjs        the publish guard
scripts/postbuild.mjs             per-route shells, 404.html, .nojekyll, llms.txt
scripts/energy-export/            the CSV exporter
public/data/                      the exported files
.github/workflows/deploy.yml      GitHub Pages on push
```

## Licence

AGPL-3.0-only. The source is public; if you run a modified version as a network service, publish
your changes.
