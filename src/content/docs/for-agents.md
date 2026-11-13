---
title: For agents
description: The machine entry, the routes, the data files, and the commands that decide "done".
order: 6
updated: 2026-11-13
tags: agents, contract
seeds: agent-operations
---

# For agents

`/llms.txt` is generated from the content tree at build time. It lists every route, the build
commands, the invariants and the isotope shortcuts. Start there; this page is the short version.

## What is published

Eleven CSVs and a manifest under `/data/`. The manifest is authoritative for coverage, row counts
and SHA-256. Every interval row has `interval_start_local`, `interval_start_utc` and `date_local`.

## The loop

```bash
npm run build   # tsc, vite, route shells, llms.txt, publish guard
npm run smoke   # renders every route server-side, including the 404
```

A build failure means nothing is published. Do not weaken a guard check to get a green build; fix
the output.

## Rules that bite

- The path is the URL. Renaming a page is a breaking public change.
- Content is Markdown, never MDX. A live widget is a route under `src/pages/`.
- `llms.txt` is generated. Never hand-edit it.
- Do not add an identifier to a page or a chart. The privacy contract is the publication policy.

## What not to claim

The events are screening flags, not cleaning proof. The utility history is a rolling window, not a
full record. The dataset is pseudonymous, not anonymous. State the limit before the finding.
