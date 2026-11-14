# Agent hints

## This repository

`le.gume energy` is a public, non-identifying record of a home solar system: 1,188 days of
production, weather-normalized residuals, utility usage and event screening. It is a child seed of
`james-gibson/le.gume`.

Live: https://james-gibson.github.io/le.gume-energy/ · Repo: `james-gibson/le.gume-energy`

## Commands

```bash
npm run dev      # vite
npm run build    # universes, charts, tsc, vite, prerender, postbuild, guard   <- CI
npm run smoke    # render every route (and the 404) to a string
npm run guard    # guard alone, against an existing dist/
npm run charts   # rebuild src/data/charts.json from public/data
```

`npm run build` is the gate. The guard fails on placeholders, leaked absolute paths or
credentials, a base path that disagrees with `package.json.homepage`, a missing
`404.html`/`.nojekyll`, source maps, or content that never reached the bundle. Do not weaken a
check to make a build pass; fix the output.

## Content

- One page = one file: `src/content/<section>/<slug>.md`, frontmatter `title` + `description`
  (plus optional `order`, `updated`, `tags`, `seeds`).
- The nav, section indexes, footer columns, TOC and counts are derived from the file tree. There
  is no nav array. Adding a file is adding a page.
- Markdown only. A live widget is a route under `src/pages/`.
- Router links are basename-relative; raw `href` strings need `import.meta.env.BASE_URL`.
- Voice: dry, technical, specific. State the limit before the finding.

## Data

- `public/data/` holds eleven CSVs and `manifest.json`. The manifest is authoritative for
  coverage, row counts and SHA-256.
- Every interval row carries `interval_start_local` (ISO 8601 with offset) and
  `interval_start_utc`; `date_local` is the join key.
- Interval files are sparse: SolarEdge returns only intervals with production. Do not integrate
  the 15-minute series and call it a daily total.
- `/charts` is a live route rendered from `src/data/charts.json`; `npm run charts` regenerates it from `public/data/`.
- `/universes` renders `src/universes/energy.ts`; `npm run universes` regenerates it and `public/data/universes/*.json` from the CSVs. The module mirrors local-time's `Universe`; do not add a dependency on the private repo.
- Change a field only with the privacy record in the same commit.

## Design

Components are Silicon UI, installed with the shadcn CLI and vendored as source under
`src/components/silicon-ui/`. Read the component's page (`https://ui.teamofsilicons.com/<slug>.md`)
before using a prop; re-running `npx shadcn@latest add @silicon-ui/<slug>` overwrites the local copy.
Colours, radii and spacing are foundation tokens (`src/components/silicon-ui/foundation.css`); the
utilities in `src/index.css` alias them, so there is no second palette. `/design` is the live
catalogue — keep it in step with what the site actually uses.

## Privacy

The absence of a site, account, address, coordinate, meter key, account id or serial is the
publication policy. Do not add one back in prose, a chart, a commit message or a downstream
dataset. The dataset is pseudonymous, not anonymous.

## Skills

`.opencode/skills/legume-content/SKILL.md` — the inherited content workflow.
`opencode.json` — the schema and an explicit pointer at this file.
