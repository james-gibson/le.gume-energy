#!/usr/bin/env node
/**
 * Chart data.
 *
 * The site ships the full CSVs under public/data; the charts need a small,
 * committed summary that Vite can bundle and prerender. This script derives
 * that summary from the published files, so the charts cannot describe a
 * different export than the one on disk.
 *
 * Output: src/data/charts.json
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv } from './csv.mjs'
import { derive, loadInterventions } from './interventions.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DATA = join(ROOT, 'public/data')
const OUT = join(ROOT, 'src/data/charts.json')

const read = async (name) => parseCsv(await readFile(join(DATA, name), 'utf8'))
const number = (value) => (value === '' || value === undefined ? null : Number(value))
const round = (value, digits) => Number(Number(value).toFixed(digits))

const daily = await read('solar-production-daily.csv')
const monthly = await read('solar-production-monthly.csv')
const intervals = await read('solar-production-15min.csv')
const hourly = await read('solar-production-hourly.csv')
const yearly = await read('solar-production-yearly.csv')
const gridHourly = await read('grid-usage-hourly.csv')
const joined = await read('energy-daily-joined.csv')
const events = await read('analysis-events.csv')

const clear = daily
  .filter((row) => row.clear_day === '1' && row.residual !== '')
  .map((row) => ({ d: row.date_local, r: round(row.residual, 4) }))

const best = daily
  .filter((row) => row.production_kwh !== '')
  .map((row) => ({ d: row.date_local, kwh: round(row.production_kwh, 3) }))
  .sort((a, b) => b.kwh - a.kwh)[0]

const curveDate = best.d
const curve = intervals
  .filter((row) => row.date_local === curveDate)
  .map((row) => {
    const [, clock] = row.interval_start_local.split('T')
    const [hours, minutes] = clock.split(':').map(Number)
    return { t: round(hours + minutes / 60, 3), kw: round(row.production_kw, 4) }
  })
  .sort((a, b) => a.t - b.t)

const self = joined
  .filter((row) => row.grid_series_count !== '0' && row.self_consumption_ratio !== '')
  .slice(-30)
  .map((row) => ({
    d: row.date_local,
    ratio: round(row.self_consumption_ratio, 4),
    production: round(row.solar_production_kwh, 2),
    export: round(row.grid_export_kwh, 2),
  }))

const ratios = self.map((row) => row.ratio)
const summary = {
  days: daily.length,
  clear_days: clear.length,
  total_mwh: round(
    daily.reduce((sum, row) => sum + (number(row.production_kwh) ?? 0), 0) / 1000,
    2,
  ),
  best_day: best,
  self_window_avg: ratios.length
    ? round(ratios.reduce((sum, value) => sum + value, 0) / ratios.length, 4)
    : null,
}

// --- the shape of a day, by season ----------------------------------------
// The intervals are sparse (SolarEdge returns production, not a day of zeros),
// so the denominator is the number of *days* in the season, not the number of
// rows: a summer hour is the mean kW at that clock hour over every summer day.
const SEASON = { winter: ['12', '01', '02'], summer: ['06', '07', '08'] }
const seasonOf = (row) => {
  const month = row.date_local.slice(5, 7)
  return Object.entries(SEASON).find(([, months]) => months.includes(month))?.[0] ?? null
}
const daysBySeason = { summer: new Set(), winter: new Set() }
for (const row of hourly) {
  const season = seasonOf(row)
  if (season) daysBySeason[season].add(row.date_local)
}
const diurnal = Array.from({ length: 24 }, (_, hour) => {
  const entry = { h: hour, summer: 0, winter: 0 }
  for (const season of ['summer', 'winter']) {
    const days = daysBySeason[season].size
    if (!days) continue
    let total = 0
    for (const row of hourly) {
      if (seasonOf(row) !== season) continue
      const clockHour = Number(row.interval_start_local.slice(11, 13))
      if (clockHour === hour) total += Number(row.production_kw) || 0
    }
    entry[season] = round(total / days, 3)
  }
  return entry
})

// --- where the production goes, by month -----------------------------------
// Self-consumed + exported = production on every row the utility window covers.
// Grid consumption is the house's draw from the utility, kept as its own series
// because it is not part of the solar split.
const sumBy = (rows, key) => rows.reduce((sum, row) => sum + (number(row[key]) ?? 0), 0)
const months = [...new Set(joined.map((row) => row.date_local.slice(0, 7)))].sort()
const balance = months.map((month) => {
  const rows = joined.filter(
    (row) => row.date_local.slice(0, 7) === month && row.grid_series_count !== '0',
  )
  return {
    m: month,
    production: rows.length ? round(sumBy(rows, 'solar_production_kwh'), 1) : null,
    self: rows.length ? round(sumBy(rows, 'self_consumed_kwh'), 1) : null,
    export: rows.length ? round(sumBy(rows, 'grid_export_kwh'), 1) : null,
    consumption: rows.length ? round(sumBy(rows, 'grid_consumption_kwh'), 1) : null,
  }
})

// --- recent days, and the windows a homeowner can compare -------------------
// "Recent" is relative to the last day in the record, not to today: the export
// is a snapshot, and a chart that claims to be current would be a lie by
// tomorrow.
const dayMs = 86400000
const toMs = (date) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
const toIso = (ms) => new Date(ms).toISOString().slice(0, 10)
const joinedByDate = new Map(joined.map((row) => [row.date_local, row]))
const lastDay = daily[daily.length - 1].date_local
const lastMs = toMs(lastDay)

const recentWindowDays = 60
const recent = daily
  .filter((row) => toMs(row.date_local) > lastMs - recentWindowDays * dayMs)
  .map((row) => {
    const grid = joinedByDate.get(row.date_local)
    return {
      d: row.date_local,
      kwh: round(row.production_kwh, 2),
      clear: row.clear_day === '1',
      residual: row.residual === '' ? null : round(row.residual, 4),
      draw: grid?.grid_consumption_kwh ? round(grid.grid_consumption_kwh, 2) : null,
      export: grid?.grid_export_kwh ? round(grid.grid_export_kwh, 2) : null,
    }
  })

const SHORT_KIND = {
  snow_melt: 'melt',
  snow_or_coverage: 'snow',
  system_offline: 'offline',
  possible_soiling: 'soiling',
  outage_recovery: 'outage',
  rain_or_recovery: 'rain',
}
const changes = events.slice(-8).map((row) => ({
  start: row.start_date_local,
  end: row.end_date_local,
  kind: SHORT_KIND[row.kind] ?? row.kind,
  magnitude: round(Number(row.magnitude), 4),
  before: row.residual_before === '' ? null : round(Number(row.residual_before), 4),
  after: row.residual_after === '' ? null : round(Number(row.residual_after), 4),
  detail: row.detail,
}))
const recentEvents = events
  .filter((row) => toMs(row.end_date_local) > lastMs - recentWindowDays * dayMs)
  .map((row) => ({
    start: row.start_date_local,
    end: row.end_date_local,
    kind: SHORT_KIND[row.kind] ?? row.kind,
    magnitude: round(Number(row.magnitude), 4),
    before: row.residual_before === '' ? null : round(Number(row.residual_before), 4),
    after: row.residual_after === '' ? null : round(Number(row.residual_after), 4),
    detail: row.detail,
  }))

// Three 30-day windows ending on the last day: this one, the one before it, and
// the same dates a year earlier. A/B here is observational — the residual is
// weather-normalized, nothing else is controlled.
const windowStats = (fromMs, toMsBound) => {
  const rows = daily.filter((row) => toMs(row.date_local) >= fromMs && toMs(row.date_local) <= toMsBound)
  const grids = rows
    .map((row) => joinedByDate.get(row.date_local))
    .filter((row) => row && row.grid_series_count !== '0')
  const clearRows = rows.filter((row) => row.clear_day === '1' && row.residual !== '')
  const sum = (list, key) => list.reduce((total, row) => total + (Number(row[key]) || 0), 0)
  const mean = (list, key) => (list.length ? sum(list, key) / list.length : null)
  const production = sum(rows, 'production_kwh')
  const exported = sum(grids, 'grid_export_kwh')
  return {
    from: toIso(fromMs),
    to: toIso(toMsBound),
    days: rows.length,
    clear: clearRows.length,
    mean_kwh: round(mean(rows, 'production_kwh') ?? 0, 2),
    residual: clearRows.length ? round(mean(clearRows, 'residual'), 4) : null,
    self_ratio: grids.length ? round(mean(grids, 'self_consumption_ratio'), 4) : null,
    export_share: grids.length && production ? round(exported / production, 4) : null,
    grid_days: grids.length,
  }
}
const yearMs = 365 * dayMs
const windows = {
  last: windowStats(lastMs - 29 * dayMs, lastMs),
  previous: windowStats(lastMs - 59 * dayMs, lastMs - 30 * dayMs),
  last_year: windowStats(lastMs - 29 * dayMs - yearMs, lastMs - yearMs),
}

// --- declared interventions: the half the record cannot detect ------------
// Each one is measured against the same seven days either side, in raw
// production and in the weather-normalized residual. The window is a fence, not
// a proof: a change inside it cannot be attributed to the action alone.
const shiftDate = (date, days) => {
  const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)))
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const interventionWindow = (rows) => {
  const clearRows = rows.filter((row) => row.clear_day === '1' && row.residual !== '')
  const production = rows.reduce((sum, row) => sum + (number(row.production_kwh) ?? 0), 0)
  return {
    days: rows.length,
    clear: clearRows.length,
    mean_kwh: rows.length ? round(production / rows.length, 2) : null,
    residual: clearRows.length
      ? round(clearRows.reduce((sum, row) => sum + Number(row.residual), 0) / clearRows.length, 4)
      : null,
  }
}
const interventions = (await loadInterventions()).interventions.map((entry) => {
  const day = entry.at.slice(0, 10)
  return {
    id: entry.id,
    at: entry.at,
    day,
    circuit: entry.circuit,
    action: entry.action,
    load: entry.load ?? null,
    minutes: entry.minutes ?? null,
    source: entry.measured?.source ?? null,
    ...derive(entry),
    before: interventionWindow(daily.filter((row) => row.date_local >= shiftDate(day, -7) && row.date_local < day)),
    after: interventionWindow(daily.filter((row) => row.date_local > day && row.date_local <= shiftDate(day, 7))),
  }
})

// --- generation against import, by hour of day, and the tariff window ------
// The utility's hourly file carries two series: `Generated` (its own record of
// what the meter sent back) and `Interval` (what it delivered). An absent
// `Interval` row is not a missing measurement — it is an hour the meter ran
// backwards, so the mean treats absence as zero and the caption says so.
// Only the days that carry the two series we compare. The TOU rows live in a
// later window and would otherwise stretch the average across two years.
const utilityDays = [
  ...new Set(gridHourly.filter((row) => row.series === 'Generated' || row.series === 'Interval').map((row) => row.date_local)),
].sort()
const utilityFrom = utilityDays[0]
const utilityTo = utilityDays[utilityDays.length - 1]
const dayCount = utilityDays.length
const hourOf = (row) => Number(row.interval_start_local.slice(11, 13))

const solarHourlyWindow = hourly.filter((row) => row.date_local >= utilityFrom && row.date_local <= utilityTo)
const generatedByHour = Array.from({ length: 24 }, () => 0)
for (const row of solarHourlyWindow) generatedByHour[hourOf(row)] += Number(row.production_kw) || 0
const importedByHour = Array.from({ length: 24 }, () => 0)
for (const row of gridHourly) {
  if (row.series !== 'Interval') continue
  importedByHour[hourOf(row)] += Number(row.value) || 0
}

// The tariff boundary the utility reports: the hours its `On Peak` series marks
// with a non-zero value. Taken from the rows themselves, not from a guess about
// how a utility prices an afternoon.
const onPeakHours = [
  ...new Set(
    gridHourly
      .filter((row) => row.series === 'On Peak' && Number(row.value) > 0)
      .map((row) => hourOf(row)),
  ),
].sort((a, b) => a - b)
const peak = onPeakHours.length
  ? { from: onPeakHours[0], to: onPeakHours[onPeakHours.length - 1], hours: onPeakHours }
  : null

const tou = {
  window: { from: utilityFrom, to: utilityTo, days: dayCount },
  hours: Array.from({ length: 24 }, (_, h) => ({
    h,
    generated: round(generatedByHour[h] / dayCount, 3),
    imported: round(importedByHour[h] / dayCount, 3),
  })),
  peak,
}

// The days that carry an on/off-peak split: a different, later window from the
// hourly file, and labelled as such rather than averaged into it.
const touRows = joined.filter(
  (row) => Number(row.grid_on_peak_kwh) + Number(row.grid_off_peak_kwh) > 0 && row.grid_on_peak_kwh !== '',
)
const touDays = {
  from: touRows[0]?.date_local ?? null,
  to: touRows[touRows.length - 1]?.date_local ?? null,
  days: touRows.map((row) => ({
    d: row.date_local,
    on: round(Number(row.grid_on_peak_kwh), 2),
    off: round(Number(row.grid_off_peak_kwh), 2),
  })),
  totals: {
    on: round(touRows.reduce((sum, row) => sum + Number(row.grid_on_peak_kwh), 0), 1),
    off: round(touRows.reduce((sum, row) => sum + Number(row.grid_off_peak_kwh), 0), 1),
  },
}

const payload = {
  generated_from: {
    manifest: 'public/data/manifest.json',
    daily: 'public/data/solar-production-daily.csv',
    monthly: 'public/data/solar-production-monthly.csv',
    intervals: 'public/data/solar-production-15min.csv',
    joined: 'public/data/energy-daily-joined.csv',
  },
  summary,
  monthly: monthly.map((row) => ({
    m: row.month_local,
    kwh: round(row.production_kwh, 2),
  })),
  residuals: clear,
  curve: { date: curveDate, points: curve },
  self,
  diurnal: { days: { summer: daysBySeason.summer.size, winter: daysBySeason.winter.size }, hours: diurnal },
  balance,
  yearly: yearly.map((row) => ({
    year: row.date_local.slice(0, 4),
    mwh: round((number(row.production_kwh) ?? 0) / 1000, 2),
  })),
  recent: { to: lastDay, days: recentWindowDays, series: recent, events: recentEvents },
  interventions,
  tou,
  touDays,
  changes,
  windows,
}

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(
  `charts: ${payload.monthly.length} months, ${payload.residuals.length} clear days, ` +
    `${payload.curve.points.length} intervals on ${curveDate}, ${payload.self.length} utility days, ` +
    `${payload.balance.length} balance months, ${payload.yearly.length} years, ` +
    `${payload.recent.series.length} recent days, ${payload.recent.events.length} recent event(s), ` +
    `${payload.interventions.length} intervention(s), ${payload.touDays.days.length} TOU day(s)`,
)
