#!/usr/bin/env node
/**
 * Local-time universes from the published CSVs.
 *
 * The seed ships a `Universe`-shaped module, not a runtime dependency: local-time
 * is not on npm, so `src/universes/types.ts` mirrors the fields this data uses.
 * The generator reads the same files the site publishes, so the timeline cannot
 * describe a different export than the CSVs.
 *
 * Outputs:
 *   src/universes/energy.ts             — typed module, BigInt nanoseconds
 *   public/data/universes/energy.json   — download form, timestamps as ISO + ns strings
 *   public/data/universes/index.json    — the set, for discovery
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv } from './csv.mjs'
import { derive, loadInterventions } from './interventions.mjs'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DATA = join(ROOT, 'public/data')
const TS_OUT = join(ROOT, 'src/universes/energy.ts')
const JSON_DIR = join(DATA, 'universes')
const DAY_NS = 86_400_000_000_000
const MINUTE_NS = 60_000_000_000
const BASE = 'https://james-gibson.github.io/le.gume-energy'

const q = (value) => JSON.stringify(value)
const round = (value, digits) => Number(Number(value).toFixed(digits))
const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const at = (iso) => BigInt(Date.parse(iso)) * 1_000_000n
const noon = (date) => `${date}T12:00:00Z`
const midnight = (date) => `${date}T00:00:00Z`
const addDays = (date, days) => {
  const d = new Date(midnight(date))
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const isoOf = (ns) => new Date(Number(ns / 1_000_000n)).toISOString()

const read = async (name) => parseCsv(await readFile(join(DATA, name), 'utf8'))
const manifest = JSON.parse(await readFile(join(DATA, 'manifest.json'), 'utf8'))
const daily = (await read('solar-production-daily.csv')).filter((row) => row.date_local)
const events = await read('analysis-events.csv')
const joined = await read('energy-daily-joined.csv')

const first = daily[0].date_local
const last = daily[daily.length - 1].date_local
let endExclusive = addDays(last, 1)

// --- segments: one per calendar year in the record -------------------------
const years = [...new Set(daily.map((row) => row.date_local.slice(0, 4)))]
const segments = years.map((year, index) => {
  const rows = daily.filter((row) => row.date_local.startsWith(year))
  const kwh = rows.reduce((sum, row) => sum + (Number(row.production_kwh) || 0), 0)
  const start = index === 0 ? first : `${year}-01-01`
  const end = index === years.length - 1 ? endExclusive : `${Number(year) + 1}-01-01`
  return {
    id: `year-${year}`,
    startIso: midnight(start),
    endIso: midnight(end),
    start: at(midnight(start)),
    end: at(midnight(end)),
    type: 'phase',
    status: 'active',
    description: `${rows.length} days, ${kwh.toFixed(1)} kWh`,
  }
})

// --- keyframes: analysis events plus record milestones ---------------------
const keyframes = []
const seen = new Set()
function addKeyframe(baseId, iso, significance, tags, description, precision = DAY_NS) {
  let id = baseId
  let attempt = 2
  while (seen.has(id)) {
    id = `${baseId}-${attempt}`
    attempt += 1
  }
  seen.add(id)
  keyframes.push({
    id,
    iso,
    ns: at(iso),
    significance: round(significance, 2),
    tags,
    type: 'milestone',
    precision,
    certainty: 1,
    description,
  })
}

for (const row of events) {
  const date = row.start_date_local
  if (!date) continue
  const magnitude = Number(row.magnitude) || 0
  addKeyframe(
    `event-${date}-${slug(row.kind)}`,
    noon(date),
    Math.min(0.95, Math.max(0.35, 0.5 + Math.abs(magnitude))),
    [row.kind, 'analysis-event'],
    row.detail || row.kind,
  )
}

const best = daily.reduce(
  (top, row) => {
    const kwh = Number(row.production_kwh) || 0
    return kwh > top.kwh ? { date: row.date_local, kwh } : top
  },
  { date: first, kwh: 0 },
)

addKeyframe('record-start', noon(first), 0.4, ['coverage', 'start'], `First day in the record: ${first}`)
addKeyframe('record-end', noon(last), 0.4, ['coverage', 'end'], `Last day in the record: ${last}`)
addKeyframe(
  'best-production-day',
  noon(best.date),
  0.7,
  ['production', 'peak'],
  `${best.kwh.toFixed(3)} kWh, the highest daily production in the record`,
)

const utility = joined.filter((row) => row.date_local && row.grid_series_count !== '0')
if (utility.length) {
  const from = utility[0].date_local
  const to = utility[utility.length - 1].date_local
  addKeyframe('utility-window-start', noon(from), 0.6, ['utility', 'window'], `Utility window opens: ${from}`)
  addKeyframe('utility-window-end', noon(to), 0.6, ['utility', 'window'], `Latest utility day: ${to}`)
}

// --- interventions: authored instants, not exported days -------------------
// A person can act today, before the next export runs. The record then has a
// declared instant past its last day: the keyframe is still real, so the epoch
// and the final segment are extended to contain it rather than refusing it.
const interventions = (await loadInterventions()).interventions
for (const entry of interventions) {
  const { wh } = derive(entry)
  addKeyframe(
    `intervention-${slug(entry.id)}`,
    entry.at,
    0.8,
    ['intervention', slug(entry.circuit), slug(entry.action)],
    `${entry.action.replace(/-/g, ' ')} · ${entry.circuit}${entry.load ? ` (${entry.load})` : ''}${
      wh === null ? '' : ` · ${wh} Wh`
    }`,
    MINUTE_NS,
  )
}

const latestNs = keyframes.reduce((top, keyframe) => (keyframe.ns > top ? keyframe.ns : top), 0n)
const latestDay = new Date(Number(latestNs / 1_000_000n)).toISOString().slice(0, 10)
if (addDays(latestDay, 1) > endExclusive) {
  endExclusive = addDays(latestDay, 1)
  const finalSegment = segments[segments.length - 1]
  finalSegment.endIso = midnight(endExclusive)
  finalSegment.end = at(midnight(endExclusive))
}

keyframes.sort((a, b) => (a.ns < b.ns ? -1 : a.ns > b.ns ? 1 : a.id.localeCompare(b.id)))

if (!keyframes.length || !segments.length) throw new Error('no segments or keyframes generated')
for (let i = 1; i < segments.length; i += 1) {
  if (segments[i].start < segments[i - 1].end) throw new Error('segments overlap')
}
for (const keyframe of keyframes) {
  if (keyframe.ns < segments[0].start || keyframe.ns > segments[segments.length - 1].end) {
    throw new Error(`keyframe ${keyframe.id} falls outside the record`)
  }
}

const universeId = 'home_energy_monitoring:public_record_2023_2026:2026'
const epochStart = midnight(first)
const epochEnd = midnight(endExclusive)
const metadata = {
  canonicalName: 'Home energy record, 2023–2026',
  creators: ['James Gibson'],
  cultural_significance: 0.2,
  timezone: manifest.timezone,
  granularity: '15 minutes, hourly, daily, monthly, yearly',
  coverage: manifest.coverage,
  system: manifest.system,
  units: { energy: 'kWh', power: 'kW', radiation: 'kWh/m2', temperature: 'degC' },
  files: manifest.files.map((file) => file.name),
}
const sources = [`${BASE}/data/manifest.json`, ...manifest.files.map((file) => `${BASE}/data/${file.name}`)]

const segLines = segments
  .map(
    (segment) =>
      `      { id: ${q(segment.id)}, start: at(${q(segment.startIso)}), end: at(${q(
        segment.endIso,
      )}), type: 'phase', status: 'active', description: ${q(segment.description)} },`,
  )
  .join('\n')
const kfLines = keyframes
  .map(
    (keyframe) =>
      `      { id: ${q(keyframe.id)}, timestamp: at(${q(keyframe.iso)}), significance: ${
        keyframe.significance
      }, tags: ${q(keyframe.tags)}, type: 'milestone', precision: ${
        keyframe.precision === MINUTE_NS ? 'MINUTE_NS' : 'DAY_NS'
      }, certainty: 1, description: ${q(
        keyframe.description,
      )} },`,
  )
  .join('\n')

const ts = `/**
 * GENERATED by scripts/universe-data.mjs — do not edit.
 *
 * A local-time \`Universe\` for the published record: yearly segments, every
 * analysis event as a keyframe, and the record milestones. Timestamps are
 * nanoseconds as BigInt, matching local-time's \`TemporalKeyframe\`.
 */
import { DAY_NS, MINUTE_NS, type LocalTimeUniverse } from './types'

const at = (iso: string) => BigInt(Date.parse(iso)) * 1_000_000n

export const energyRecordUniverse: LocalTimeUniverse = {
  universeId: ${q(universeId)},
  type: 'technical_log',
  identifiers: {
    primary: ${q(universeId)},
    aliases: ['home energy record', 'solar record 2023-2026'],
  },
  realityRelation: {
    type: 'documentary',
    fictionalizationDegree: 0,
    realityAnchors: [
      {
        realEventId: ${q(universeId)},
        relationshipType: 'documents',
        confidence: 1,
        evidence: [
          'SolarEdge and Xcel collector exports',
          'Weather-normalized analysis',
          'public/data/manifest.json',
        ],
      },
    ],
  },
  attribution: {
    copyright: { holders: ['James Gibson'], year: 2026, status: 'active' },
    citations_required: false,
    usage_restrictions: ['anonymization_required'],
    sources: ${q(sources)},
  },
  layers: [
    {
      layerId: 'record',
      type: 'primary',
      epochs: {
        record: {
          epochId: 'record',
          start: at(${q(midnight(first))}),
          end: at(${q(midnight(endExclusive))}),
          precision: DAY_NS,
          description: 'The published record, first to last day.',
        },
      },
    },
  ],
  epochs: {
    record: {
      epochId: 'record',
      start: at(${q(midnight(first))}),
      end: at(${q(midnight(endExclusive))}),
      precision: DAY_NS,
      description: 'The published record, first to last day.',
    },
  },
  temporalStructure: {
    segments: [
${segLines}
    ],
    keyframes: [
${kfLines}
    ],
    windows: { strategy: 'time_based', avgWindowSize: 900n },
  },
  metadata: {
    canonicalName: ${q(metadata.canonicalName)},
    creators: ${q(metadata.creators)},
    released: new Date(${q(midnight(first))}),
    cultural_significance: ${metadata.cultural_significance},
    timezone: ${q(metadata.timezone)},
    granularity: ${q(metadata.granularity)},
    coverage: ${JSON.stringify(metadata.coverage, null, 2).replace(/\n/g, '\n    ')},
    system: ${JSON.stringify(metadata.system, null, 2).replace(/\n/g, '\n    ')},
    units: ${JSON.stringify(metadata.units, null, 2).replace(/\n/g, '\n    ')},
    files: ${JSON.stringify(metadata.files, null, 2).replace(/\n/g, '\n    ')},
  },
}

export const energyUniverses = [energyRecordUniverse]
`

const plainSegments = segments.map((segment) => ({
  id: segment.id,
  start: segment.startIso,
  end: segment.endIso,
  start_ns: String(segment.start),
  end_ns: String(segment.end),
  type: segment.type,
  status: segment.status,
  description: segment.description,
}))
const plainKeyframes = keyframes.map((keyframe) => ({
  id: keyframe.id,
  timestamp: keyframe.iso,
  timestamp_ns: String(keyframe.ns),
  significance: keyframe.significance,
  tags: keyframe.tags,
  type: keyframe.type,
  precision: keyframe.precision ?? DAY_NS,
  certainty: keyframe.certainty,
  description: keyframe.description,
}))
const plainEpoch = {
  epochId: 'record',
  start: midnight(first),
  end: midnight(endExclusive),
  start_ns: String(at(midnight(first))),
  end_ns: String(at(midnight(endExclusive))),
  precision: DAY_NS,
  description: 'The published record, first to last day.',
}
const plain = {
  universeId,
  type: 'technical_log',
  identifiers: { primary: universeId, aliases: ['home energy record', 'solar record 2023-2026'] },
  realityRelation: {
    type: 'documentary',
    fictionalizationDegree: 0,
    realityAnchors: [
      {
        realEventId: universeId,
        relationshipType: 'documents',
        confidence: 1,
        evidence: [
          'SolarEdge and Xcel collector exports',
          'Weather-normalized analysis',
          'public/data/manifest.json',
        ],
      },
    ],
  },
  attribution: {
    copyright: { holders: ['James Gibson'], year: 2026, status: 'active' },
    citations_required: false,
    usage_restrictions: ['anonymization_required'],
    sources,
  },
  layers: [{ layerId: 'record', type: 'primary', epochs: { record: plainEpoch } }],
  epochs: { record: plainEpoch },
  temporalStructure: {
    segments: plainSegments,
    keyframes: plainKeyframes,
    windows: { strategy: 'time_based', avgWindowSize: '900' },
  },
  metadata: { ...metadata, released: midnight(first) },
}

await mkdir(dirname(TS_OUT), { recursive: true })
await mkdir(JSON_DIR, { recursive: true })
await writeFile(TS_OUT, ts, 'utf8')
await writeFile(join(JSON_DIR, 'energy.json'), `${JSON.stringify(plain, null, 2)}\n`, 'utf8')
await writeFile(
  join(JSON_DIR, 'index.json'),
  `${JSON.stringify(
    [
      {
        universeId,
        file: 'energy.json',
        type: 'technical_log',
        segments: segments.length,
        keyframes: keyframes.length,
      },
    ],
    null,
    2,
  )}\n`,
  'utf8',
)
console.log(
  `universes: 1 universe, ${segments.length} segments, ${keyframes.length} keyframes (${first} → ${last})`,
)
