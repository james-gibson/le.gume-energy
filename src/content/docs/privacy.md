---
title: The privacy contract
description: What was removed, how the export proves it, and what is still identifying by combination.
order: 4
updated: 2026-11-13
tags: privacy, anonymization
seeds: homeowner, agent-operations
---

# The privacy contract

The dataset is anonymised; the work is not. Personal information was removed from the data before
publication. The removal is a whitelist, not a redaction pass over copied rows.

## Removed

- Site name and account holder
- Account name
- Street address and postal code
- Precise latitude and longitude
- Site id, account id and meter key
- Panel and optimizer serials

The exporter never selects those columns. Joins between solar and utility data use the local
calendar date and time only.

## How the export proves it

1. Every source row's local time is recomputed from UTC and compared with the collector's
   rendering.
2. Every `*_local` timestamp in the output must denote the same instant as its `*_utc` pair.
3. Every CSV is scanned for the excluded values before publication. A hit reports the category,
   never the value.
4. Output is staged and verified, then swapped into place. A failed run leaves the previous good
   export untouched.

The scan is deliberately not a guarantee of anonymity. It catches the values the collectors
actually hold; it cannot catch a re-identification you construct from the published series.

## What still narrows the population

The interval trace is a behavioural fingerprint even without an address. The retained system facts
— 7.0 kWp, 21 panels, the install date, the panel model and the time zone — narrow the population
further. Treat the files as pseudonymous, not anonymous.

Weather columns are gridded reanalysis for the site's coordinates, not on-site sensor readings.

## Quoting the files

Quote the numbers and the dates. Do not add a location, an account label, a serial or a name back
into a chart, an issue or a downstream dataset. The absence is the publication policy.
