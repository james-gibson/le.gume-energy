---
title: The homeowner
description: Rung 0. Whether the array is losing output, and what the weather has to do with it.
order: 1
updated: 2026-11-13
tags: seed, audience
---

# The homeowner

You own the array. You are not going to run Python, and you should not have to: the monthly and
daily tables answer the questions a bill raises.

## The three questions

1. **Is this month normal?** Read the monthly production and the daily residual, not the raw kWh.
2. **Why did output drop?** A negative run with snow, rain or an outage has a different shape from
   a slow decline across dry clear days.
3. **How much solar do I actually use?** The joined daily table reports production, export,
   net grid and self-consumption.

## What this seed will not do

It will not tell you the panels are dirty from one bad week. A soiling claim needs a dry clear
window, a slope, and a recovery that is not rain. The analysis calls that a candidate on purpose.

Start at [the record](/docs/overview), then take the [daily table](/guides/download).
