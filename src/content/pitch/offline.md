---
title: The record, offline
description: A ten-slide deck you can open from a file with no network.
order: 1
updated: 2026-11-13
tags: deck, offline
---

# The record, offline

One household's solar and utility history, published without an address.

---

## The problem

A solar owner is told two things: production is down, and the panels must be dirty.

Neither claim survives a seasonal comparison. December is not a dirty month; it is a short one.

---

## What is published

Eleven CSV files and a manifest.

Production at 15 minutes, hourly, daily, monthly and yearly. Utility usage at four granularities.
One joined table for self-consumption. One event list.

---

## The unit of truth

The local calendar day.

The meter, the bill and the reader agree on it. UTC is kept beside it because local time is
ambiguous once a year.

---

## The time model

Every instant appears twice: local ISO 8601 with an offset, and UTC.

The exporter recomputes local time from UTC and refuses to publish when the collector disagrees.

---

## The normalization

Production becomes yield per kWp, divided by incoming radiation, corrected for cell temperature.

The seasonal baseline is the median of clear days near the same day-of-year.

The residual is what is left.

---

## The events

Snow and coverage. Outages and obstruction. Snow melt, outage recovery, rain or wind recovery,
manual cleaning when a log exists.

A negative residual is a candidate. The weather context decides which kind.

---

## The privacy

A whitelist, not a redaction pass.

Site, account, address, postal code, coordinates, meter key, account id and serials are never
selected. The manifest records the categories, not the values.

---

## The limits

The utility window is rolling, not complete. Panel-level data is empty. The weather is a grid, not
a sensor. The dataset is pseudonymous, not anonymous.

State the limit before the finding.

---

## The receipt

The site builds itself, guards itself and documents the guard.

The files are static. The method is readable. The numbers are checkable.
