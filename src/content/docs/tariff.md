---
title: What the tariff costs
description: The two plans, the rates as supplied, and what the record can and cannot price.
order: 10
updated: 2026-11-15
tags: tariff, time-of-use, cost, storage
seeds: homeowner, agent-operations
---

# What the tariff costs

The record measures kWh. The bill needs a price, and a price is supplied, not derived. The rates
live in `src/data/rates.json` with the date they were supplied and the source; the charts multiply
recorded kWh by them and print the result in dollars.

## The rates as supplied

Read as dollars per kWh — the sheet says "cents per kilowatt hour" but writes `0.10380`, and the only
reading consistent with a flat rate of about ten and a half cents is dollars. Rendered here as cents.

| season | on-peak | off-peak | flat |
| --- | --- | --- | --- |
| summer, Jun 1 – Sep 30 | 2.13¢ | 7.88¢ | 10.38¢ |
| winter, Oct 1 – May 31 | 18.33¢ | 6.79¢ | 8.57¢ |

Excluded from every figure the site prints: the **$7.10/month Service & Facility charge**, and all
other riders, fees and taxes. The fixed charge is identical under both plans, so it never changes
which plan wins — but it does mean the totals here are lower than a real bill.

## The summer reading is suspect

As supplied, **summer on-peak (2.13¢) is below summer off-peak (7.88¢)**. That inverts the usual
incentive — it would pay to use power at peak — and is very likely a transcription swap. The site
does not silently choose: it prices the record both ways and draws both.

The plan comparison survives either reading, because summer off-peak is under the flat rate whether
it is the 7.88¢ or the 2.13¢ figure. The **storage** conclusion does not survive it: as written,
moving a kWh from off-peak to peak in summer *loses* 5.76¢; with the two figures exchanged it *pays*
5.76¢. That is the whole reason to show both rather than pick the tidier one.

## How a window is priced

1. **Billed days.** The 30 days that carry the utility's own on/off-peak split, priced directly.
   All of them are winter.
2. **Metered import.** The hourly utility file applies the tariff boundary (17:00–21:00, read from
   the utility's `On Peak` series) to metered import, then prices each day in the season its date
   falls in. May is winter; June to August is summer. That is how the summer dollars exist at all,
   since no billed summer day carries a split.
3. **Storage value.** The spread between on-peak and off-peak, per kWh, times the on-peak energy that
   could have been moved. It is a ceiling on arbitrage, not a battery's return: round-trip losses,
   power limits and the days a battery is already full are not in it.

Two windows, two questions: the summer shape comes from metered hourly import in 2025, the billed
split from thirty autumn days in 2026. They are never averaged together.

## What the record cannot price

- **Export credit.** The record knows kWh sent back (`grid_export_kwh`, and the utility's `Generated`
  series) but not the rate it earned. Every dollar here is about *import*.
- **Demand charges.** None are in these rates; if one appears, it needs a peak-kW series the site
  does not keep.
- **Riders and taxes.** They are percentages of a bill the site cannot construct.
