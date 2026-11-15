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
const joined = await read('energy-daily-joined.csv')

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
}

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(
  `charts: ${payload.monthly.length} months, ${payload.residuals.length} clear days, ` +
    `${payload.curve.points.length} intervals on ${curveDate}, ${payload.self.length} utility days, ` +
    `${payload.balance.length} balance months, ${payload.yearly.length} years`,
)
