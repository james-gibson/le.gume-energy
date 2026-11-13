---
title: The local-time universe
description: The record as segments and keyframes, generated from the CSVs, with no runtime dependency.
order: 8
updated: 2026-11-13
tags: local-time, universe, timeline
seeds: starter, agent-operations
---

# The local-time universe

The seed ships one `Universe` for the record. It is generated from the same CSVs the site
publishes, so a chart, a table and a keyframe cannot describe different data.

## What ships

| File | Form |
| --- | --- |
| `src/universes/energy.ts` | Typed module, `bigint` nanoseconds |
| `public/data/universes/energy.json` | Download form, ISO timestamps and ns strings |
| `public/data/universes/index.json` | The set, for discovery |

The id is `home_energy_monitoring:public_record_2023_2026:2026`. The existing September 2025
universe in local-time is a sibling, not a replacement.

## The shape

- **Segments**: one per calendar year in the record. Four segments, 2023 → 2026.
- **Keyframes**: every analysis event, plus the record start and end, the best production day and
  the utility window.
- **Epoch**: `record`, from the first day to the day after the last, at `DAY` precision.
- **Reality relation**: `documentary`, fictionalization 0, anchored to the collector exports and
  the manifest.
- **Attribution**: the holder is named; the data is anonymised. Usage is
  `anonymization_required`.
- **Metadata**: time zone, granularity, coverage, system facts and the file list.

A keyframe is a day, not an instant, so its timestamp is **noon UTC** with `DAY` precision. That
keeps it inside the local day it names without pretending to a time the record does not have.

## Generate

```bash
npm run universes   # reads public/data, writes src/universes/energy.ts and the JSON
```

`npm run build` runs it first. The generated module is committed so a build from a clean checkout
does not need the CSV pass, but the build regenerates it anyway.

## Local-time compatibility

`local-time` is not published as a package, so the seed does not import it. Instead,
`src/universes/types.ts` mirrors the fields this data uses — including `TimePrecision.DAY`'s
numeric value — and the generated object is a structural `Universe`.

To register it in local-time, copy the module into that repo's `src/config/universes/` and add it
to the registry, or adapt it into the generated `imported/` barrel. Do not add a dependency from
this public seed to a private repository.

## What is not here

- One universe per CSV would be eleven near-identical objects. The record is the temporal object;
  the files are its `metadata` and `attribution.sources`.
- Panel-level universes are absent because `panel_usage` is empty.
- The universe is not fetched at runtime. It is a module and a static JSON file.
