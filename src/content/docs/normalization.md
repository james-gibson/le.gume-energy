---
title: Weather-normalized performance
description: Why raw kWh cannot answer "are the panels dirty?", and what replaces it.
order: 5
updated: 2026-11-13
tags: analysis, soiling
seeds: homeowner, starter
---

# Weather-normalized performance

A raw daily kWh number falls in December and rises in June. That is the sun's path, not the
panels' condition. Comparing seasons or years without normalizing answers a different question.

## The index

```text
yield_kwh_per_kwp   = production_kwh / peak_power_kwp
performance_index   = yield_kwh_per_kwp / radiation_kwh_m2
```

Solar radiation comes from Open-Meteo `shortwave_radiation_sum` (MJ/m² divided by 3.6). A simple
cell-temperature correction follows:

```text
mean_irradiance_w_m2 = radiation_kwh_m2 * 1000 / 24
cell_temp_c          = temp_mean_c + 0.03 * mean_irradiance_w_m2
temp_factor          = 1 - 0.004 * (cell_temp_c - 25)
corrected_index      = performance_index / temp_factor
```

## Removing the season

The corrected index still contains seasonal effects because the radiation grid is horizontal, not
plane-of-array. For each day the analysis takes the median corrected index of clear days within
±21 days of the same day-of-year across the available years.

```text
residual = corrected_index - seasonal_baseline
```

A clear day is cloud cover ≤ 30%, no precipitation, and radiation ≥ 2 kWh/m².

## Reading the residual

| Residual | Reading |
| --- | --- |
| near 0 | consistent with the seasonal baseline |
| below −0.20 with cold/snow/wet context | snow or coverage |
| below −0.35 on a warm, dry clear day | outage or obstruction |
| a steep decline across dry clear days | a soiling candidate, not proof |

Event labels add recovery context: snow melt, outage recovery, rain or wind recovery, and manual
cleaning when a cleaning log was supplied. A label is a screening flag. Confirm it with
maintenance dates, inverter alerts or photos.

## Known limits

- GHI is not plane-of-array radiation; a future version could fit tilt and azimuth.
- Open-Meteo is a grid, not an on-site sensor.
- The baseline is retrospective climatology, not a forecast.
- A one-day summer drop is more likely an outage than dirt.
