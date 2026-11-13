---
title: Agent operations
description: Rung 3. An agent that can build, verify and explain the record without inventing it.
order: 3
updated: 2026-11-13
tags: seed, agents
---

# Agent operations

An agent pointed at this repository has four reliable surfaces:

- `/llms.txt` — every route, the commands, the invariants.
- `/data/manifest.json` — coverage, counts, hashes, the privacy record.
- `/docs/for-agents` — the written contract.
- `scripts/verify-publish.mjs` — the gate that decides whether a build ships.

The agent's job is to read the manifest before the numbers, and to repeat the limits with the
finding. "Residual −0.04 in June" is a measurement. "The panels need cleaning" is a claim the
record does not support.

Start at [the agent contract](/docs/for-agents).
