#!/usr/bin/env node
/**
 * Record an intervention — a thing a person did, against a named circuit.
 *
 * The record can see a snow-melt; it cannot see that the garage freezer was
 * unplugged at 14:32. This is the other half of the log, and it is appended by a
 * command so the shape stays valid and the ids stay unique.
 *
 *   node scripts/intervention.mjs list
 *   node scripts/intervention.mjs add --circuit garage --action unplug \
 *     --load "chest freezer" --minutes 90 --volts 120.1 --amps 1.35 --pf 0.92 \
 *     --source "clamp meter, panel A"
 *
 * `--at` defaults to now with this machine's offset. A local timestamp without
 * an offset is refused: the record stores a local instant with its offset and
 * the UTC instant beside it, and a bare "14:32" is an hour that happens twice
 * every autumn.
 */
import { readFile, writeFile } from 'node:fs/promises'

import { ACTIONS, FILE, derive, loadInterventions, slug } from './interventions.mjs'

const args = process.argv.slice(2)
const verb = args[0] ?? 'list'
const flag = (name) => {
  const index = args.indexOf(`--${name}`)
  return index > -1 ? args[index + 1] : null
}

const pad = (value) => String(Math.abs(value)).padStart(2, '0')
const nowLocal = () => {
  const date = new Date()
  const offset = -date.getTimezoneOffset()
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 19)
  return `${local}${offset >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`
}

const LOCAL_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?[+-]\d{2}:\d{2}$/

const refuse = (message) => {
  console.error(`intervention: ${message}`)
  process.exit(1)
}

const payload = await loadInterventions()

if (verb === 'list') {
  const rows = payload.interventions
  if (!rows.length) {
    console.log('intervention: none recorded — add one with `npm run intervention -- add --circuit … --action …`')
    process.exit(0)
  }
  for (const entry of rows) {
    const { va, watts, wh } = derive(entry)
    const power = wh === null ? `${va === null ? 'unmeasured' : `${va} VA`}` : `${wh} Wh`
    console.log(`${entry.at}  ${entry.circuit.padEnd(12)} ${entry.action.padEnd(15)} ${power}`)
  }
  process.exit(0)
}

if (verb !== 'add') {
  console.error(`intervention: unknown verb "${verb}" — try list or add`)
  process.exit(2)
}

const circuit = slug(flag('circuit') ?? '')
if (!circuit) refuse('add needs --circuit <name> (kitchen, garage, panels, lighting, hvac, standby)')
const action = slug(flag('action') ?? '')
if (!action) refuse(`add needs --action <verb> (${ACTIONS.join(', ')})`)
if (!ACTIONS.includes(action)) refuse(`"${action}" is not a known action; use one of ${ACTIONS.join(', ')}`)

const at = flag('at') ?? nowLocal()
if (!LOCAL_ISO.test(at)) {
  refuse(`--at "${at}" is not a local ISO instant with an offset (e.g. 2026-11-15T14:32:00-07:00)`)
}
const date = new Date(at)
if (Number.isNaN(date.getTime())) refuse(`--at "${at}" does not parse`)

const numeric = (name, min, max) => {
  const raw = flag(name)
  if (raw === null) return null
  const value = Number(raw)
  if (!Number.isFinite(value) || value < min || value > max) refuse(`--${name} must be ${min}..${max}`)
  return value
}
const volts = numeric('volts', 0, 600)
const amps = numeric('amps', 0, 400)
const pf = numeric('pf', 0, 1)
const minutes = numeric('minutes', 0, 10_080)
const kind = flag('kind') ?? 'ac'
if (!['ac', 'dc'].includes(kind)) refuse('--kind must be ac or dc')

const entry = {
  id: `${at.slice(0, 10)}-${circuit}-${action}`,
  at,
  at_utc: date.toISOString().replace(/\.\d{3}Z$/, 'Z'),
  circuit,
  action,
  kind,
  ...(flag('load') ? { load: flag('load') } : {}),
  ...(minutes !== null ? { minutes } : {}),
  measured: {
    ...(volts !== null ? { volts } : {}),
    ...(amps !== null ? { amps } : {}),
    ...(pf !== null ? { pf } : {}),
    ...(flag('source') ? { source: flag('source') } : {}),
  },
  ...(flag('note') ? { note: flag('note') } : {}),
  ...(flag('verify') ? { verify: flag('verify') } : {}),
}

if (
  payload.interventions.some((existing) => existing.id === entry.id || (existing.at === entry.at && existing.circuit === entry.circuit))
) {
  const taken = new Set(payload.interventions.map((existing) => existing.id))
  let attempt = 2
  while (taken.has(`${entry.id}-${attempt}`)) attempt += 1
  entry.id = `${entry.id}-${attempt}`
}

payload.interventions.push(entry)
payload.interventions.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
await writeFile(FILE, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

const { va, watts, wh } = derive(entry)
console.log(`intervention: recorded ${entry.id} at ${entry.at} (${entry.at_utc})`)
console.log(
  `intervention: ${va === null ? 'no electrical measurement' : `${va} VA`}` +
    `${watts === null ? '' : ` · ${watts} W`}${wh === null ? '' : ` · ${wh} Wh over ${minutes} min`}` +
    `${watts === null && pf === null && kind === 'ac' ? ' (no power factor, so real power is left unmeasured)' : ''}`,
)
console.log('intervention: `npm run charts && npm run universes` re-derives the charts and the keyframes; `npm run build` does both')
