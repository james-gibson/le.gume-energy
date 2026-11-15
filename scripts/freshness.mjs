#!/usr/bin/env node
/**
 * Data freshness.
 *
 * The energy export is a manual run on the machine that holds the collector
 * databases — SolarEdge, Xcel and the analysis store. They are machine-local and
 * deliberately unpublished, so no CI runner can import. What CI can do is notice
 * that the committed export has stopped moving, and refuse to let a page describe
 * a week-old reading as current.
 *
 * Two separate checks, because they fail for different reasons:
 *
 *   --require-stamp dist   the built page says how old it is (a build gate)
 *   --max-age 2            the export is younger than N days (an alarm)
 *
 * The build runs the first: a page that cannot state its age must not publish.
 * The scheduled workflow runs the second: a stuck import is a red run, not a
 * quiet site.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = process.argv.slice(2)
const valueOf = (flag) => {
  const index = args.indexOf(flag)
  return index === -1 ? null : args[index + 1]
}

const manifestPath = join('public', 'data', 'manifest.json')
if (!existsSync(manifestPath)) {
  console.error(`freshness: ${manifestPath} is missing — there is no record to date`)
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const exportedAt = manifest.generated_at_utc
if (!exportedAt) {
  console.error('freshness: the manifest has no generated_at_utc — the age of the record is unknowable')
  process.exit(1)
}

const ageDays = Math.floor(((Date.now() - Date.parse(exportedAt)) / 86_400_000) * 10) / 10
const exportedLocal = manifest.generated_at_local ?? exportedAt
console.log(`freshness: exported ${exportedLocal} (${ageDays} day${ageDays === 1 ? '' : 's'} old)`)

let failures = 0

// --- 1. the page says how old it is ---------------------------------------
const dist = valueOf('--require-stamp')
if (dist) {
  const page = join(dist, 'charts', 'index.html')
  if (!existsSync(page)) {
    console.error(`freshness: ${page} is missing — build before checking the stamp`)
    failures += 1
  } else {
    const html = readFileSync(page, 'utf8')
    const states = html.includes('Data through') && /days? old when this page was built|age unknown/.test(html)
    if (!states) {
      console.error(
        'freshness: the charts page does not state the age of the record — a cached page that looks current is the defect this check exists for',
      )
      failures += 1
    }
  }
}

// --- 2. the import is still running ---------------------------------------
const maxAge = valueOf('--max-age')
if (maxAge !== null) {
  const limit = Number(maxAge)
  if (!Number.isFinite(limit)) {
    console.error(`freshness: --max-age needs a number of days, got "${maxAge}"`)
    process.exit(1)
  }
  if (ageDays > limit) {
    console.error(
      `freshness: the export is ${ageDays} days old, past the ${limit}-day limit — the import has stopped, and this site is now publishing history as if it were current`,
    )
    failures += 1
  }
}

if (failures) process.exit(1)
console.log('freshness: ok')
