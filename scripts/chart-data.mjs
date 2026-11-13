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

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DATA = join(ROOT, 'public/data')
const OUT = join(ROOT, 'src/data/charts.json')

/** Minimal CSV reader: quoted fields, commas, LF/CRLF. */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i += 1
      } else if (c === '"') {
        quoted = false
      } else {
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n') {
      row.push(field.replace(/\r$/, ''))
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''))
    rows.push(row)
  }
  const header = rows.shift() ?? []
  return rows
    .filter((values) => values.length === header.length)
    .map((values) => Object.fromEntries(header.map((key, index) => [key, values[index]])))
}

const read = async (name) => parseCsv(await readFile(join(DATA, name), 'utf8'))
const number = (value) => (value === '' || value === undefined ? null : Number(value))
const round = (value, digits) => Number(Number(value).toFixed(digits))

const daily = await read('solar-production-daily.csv')
const monthly = await read('solar-production-monthly.csv')
const intervals = await read('solar-production-15min.csv')
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
}

await mkdir(dirname(OUT), { recursive: true })
await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
console.log(
  `charts: ${payload.monthly.length} months, ${payload.residuals.length} clear days, ` +
    `${payload.curve.points.length} intervals on ${curveDate}, ${payload.self.length} utility days`,
)
