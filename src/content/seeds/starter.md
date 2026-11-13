---
title: The operator
description: Rung 2. Run the export, keep the time model honest, and keep the guard green.
order: 2
updated: 2026-11-13
tags: seed, audience
---

# The operator

You have the SQLite databases and you want the export, or a version of it, on your own machine.

## What you run

- [`scripts/energy-export/export_local.py`](https://github.com/james-gibson/le.gume-energy/blob/main/scripts/energy-export/export_local.py)
  converts the collectors' tables into the files under `public/data/`.
- `npm run build` then proves the site still passes its own publish guard.
- `npm run smoke` renders every route, including the one that does not exist.

## What you keep

The time model and the whitelist. Those are the two decisions that make the output quotable. If
you change a field, change the privacy record in the manifest in the same commit.

Start at [the quickstart](/docs/quickstart) and [the time model](/docs/time-model).
