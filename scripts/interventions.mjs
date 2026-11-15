/**
 * Declared interventions: the record of things a person did, as opposed to
 * things the screen detected.
 *
 * The record can see a snow-melt or a residual step; it cannot see that you
 * unplugged the garage freezer at 14:32. This file is that second half: a dated
 * action against a circuit, with whatever was measured at the time, kept in the
 * same shape the CSVs use — a local instant with its offset, and the UTC instant
 * beside it.
 *
 * One shared module reads it so the charts, the local-time universe and the
 * guard cannot disagree about what an intervention is or what it is worth.
 *
 * Power arithmetic, stated rather than assumed:
 *   apparent power  VA = volts * amps                    (always computable)
 *   real power      W  = VA * pf                         (AC: pf required)
 *                   W  = VA                              (DC: pf is 1 by definition)
 *   energy          Wh = W * minutes / 60
 * A missing power factor leaves W and Wh null. Assuming 1.0 would invent a
 * number, which is exactly what a measurement record must not do.
 */
import { readFile } from 'node:fs/promises'

export const FILE = 'src/data/interventions.json'
export const SCHEMA = 'kb-energy-interventions/1'

/** The actions the site knows how to describe. Free text would not chart. */
export const ACTIONS = [
  'unplug',
  'remove-standby',
  'panels-off',
  'panels-on',
  'lights-off',
  'lights-on',
  'breaker-off',
  'breaker-on',
  'load-on',
  'measure',
]

export const slug = (value) =>
  String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const number = (value) => (value === null || value === undefined || value === '' ? null : Number(value))

export function readInterventions(text) {
  const payload = JSON.parse(text)
  if (payload.schema !== SCHEMA) throw new Error(`${FILE}: schema is "${payload.schema}", expected "${SCHEMA}"`)
  if (!Array.isArray(payload.interventions)) throw new Error(`${FILE}: "interventions" is not an array`)
  return payload
}

export const loadInterventions = async (path = FILE) => readInterventions(await readFile(path, 'utf8'))

/**
 * Everything worth computing about one intervention. Nulls are kept as null so
 * a chart can say "not measured" instead of drawing a zero.
 */
export function derive(entry) {
  const measured = entry.measured ?? {}
  const volts = number(measured.volts)
  const amps = number(measured.amps)
  const pf = number(measured.pf)
  const minutes = number(entry.minutes)
  const kind = entry.kind ?? 'ac'

  const va = volts !== null && amps !== null ? Number((volts * amps).toFixed(2)) : null
  const watts =
    va === null ? null : kind === 'dc' ? Number(va.toFixed(2)) : pf === null ? null : Number((va * pf).toFixed(2))
  const wh = watts === null || minutes === null ? null : Number(((watts * minutes) / 60).toFixed(2))

  return { va, watts, wh, complete: wh !== null }
}

/** Minutes-precision timestamps: an intervention names an instant, not a day. */
export const MINUTE_NS = 60_000_000_000n
