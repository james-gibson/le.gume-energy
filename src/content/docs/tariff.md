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

| plan | period | summer, Jun 1 – Sep 30 | winter, Oct 1 – May 31 |
| --- | --- | --- | --- |
| Time of use (RE-TOU) | on-peak, 5–9 p.m. Mon–Fri | 21.28¢ | 18.33¢ |
| Time of use (RE-TOU) | off-peak, all other times | 7.88¢ | 6.79¢ |
| Flat rate (R-OO) | all day | 10.38¢ | 8.57¢ |

The on-peak window is **5 p.m. to 9 p.m., Monday to Friday**; 9 p.m. is off-peak again, and weekends
are off-peak all day. `21:00` is exclusive in the code so the hour is never counted twice.

Excluded from every figure the site prints: the **$7.10/month Service & Facility charge**, and all
other riders, fees and taxes. The fixed charge is identical under both plans, so it never changes
which plan wins — but it does mean the totals here are lower than a real bill.

## Where the boundary comes from

The sheet: `peak_window` in `src/data/rates.json`. The utility's own hourly `On Peak` series is
**checked against it, not used to infer it** — a boundary read from a day of rows is a coincidence, a
boundary in the sheet is a contract. The derivation records whether the two agree (`agrees: true` at
the time of writing), so a utility that moves its window shows up as a disagreement rather than a
silently wrong chart.

Peak hours are counted on the local calendar day: Saturday and Sunday evening are off-peak even
though the clock says 5 p.m.

## What the two plans cost here

Priced against the same recorded kWh:

| window | flat | time of use | TOU costs |
| --- | --- | --- | --- |
| billed winter, 30 days (2026-10-15 → 11-13) | $26.97 | $27.11 | **+$0.14** |
| metered winter, May 2025, 31 days | $24.25 | $25.21 | **+$0.96** |
| metered summer, Jun–Aug 2025, 92 days | $229.64 | $244.14 | **+$14.50** |

Time of use is dearer in all three windows. The peak price is more than double the flat rate, and
this house does use the evening: 520.6 kWh of the summer import lands in the 5–9 p.m. window, against
1,691.7 kWh off-peak.

## What shifting a peak kWh is worth

| season | spread | peak energy in the window | value |
| --- | --- | --- | --- |
| winter | 11.54¢/kWh | 49.7 kWh (billed 30 days) | $5.73 |
| summer | 13.39¢/kWh | 520.6 kWh (metered 92 days) | $69.72 |

That is a **ceiling** on arbitrage, not a battery's return. Round-trip losses, power limits, and the
days a battery is already full are not in it, and neither is the cost of the battery.

## How a window is priced

1. **Billed days.** The 30 days that carry the utility's own on/off-peak split, priced directly.
   All of them are winter.
2. **Metered import.** The hourly utility file is split by the sheet's weekday rule, then priced by
   the season its date falls in. May is winter; June to August is summer. That is how the summer
   dollars exist at all, since no billed summer day carries a split.
3. **Storage value.** The on-peak minus off-peak price, times the on-peak energy that could have been
   moved.

Two windows, two questions: the summer shape comes from metered hourly import in 2025, the billed
split from thirty autumn days in 2026. They are never averaged together.

## What the record cannot price

- **Export credit.** The record knows kWh sent back (`grid_export_kwh`, and the utility's `Generated`
  series) but not the rate it earned. Every dollar here is about *import*.
- **Demand charges.** None are in these rates; if one appears, it needs a peak-kW series the site
  does not keep.
- **Riders and taxes.** They are percentages of a bill the site cannot construct.
