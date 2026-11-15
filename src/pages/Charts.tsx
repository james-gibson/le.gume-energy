import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import charts from '../data/charts.json'
import { usePageMeta } from '../lib/usePageMeta'

const W = 860
const H = 300
const PAD = { l: 54, r: 18, t: 18, b: 34 }
const IW = W - PAD.l - PAD.r
const IH = H - PAD.t - PAD.b
const DATA = 'https://james-gibson.github.io/le.gume-energy/data'

/**
 * `charts.json` is generated, so with no interventions recorded the array is
 * inferred as `never[]`. The shape is stated here once, where it is read.
 */
type InterventionWindow = { days: number; clear: number; mean_kwh: number | null; residual: number | null }
type Intervention = {
  id: string
  at: string
  day: string
  circuit: string
  action: string
  load: string | null
  minutes: number | null
  source: string | null
  va: number | null
  watts: number | null
  wh: number | null
  before: InterventionWindow
  after: InterventionWindow
}
const interventions = charts.interventions as unknown as Intervention[]

const y = (value: number, min: number, max: number) =>
  PAD.t + (1 - (value - min) / (max - min)) * IH
const x = (index: number, count: number) =>
  count <= 1 ? PAD.l + IW / 2 : PAD.l + (index / (count - 1)) * IW
const path = (points: Array<[number, number]>) =>
  points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')

function Figure({
  title,
  note,
  children,
}: {
  title: string
  note: string
  children: ReactNode
}) {
  return (
    <figure className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <figcaption>
        <h2 className="text-lg font-semibold tracking-tight text-body">{title}</h2>
        <p className="mt-1 text-sm text-muted">{note}</p>
      </figcaption>
      <div className="mt-5 text-accent">{children}</div>
    </figure>
  )
}

function Grid({ min, max, ticks }: { min: number; max: number; ticks: number[] }) {
  return (
    <g>
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={y(tick, min, max)}
            y2={y(tick, min, max)}
            className="text-line/70"
            stroke="currentColor"
            strokeDasharray="3 5"
            strokeWidth={1}
          />
          <text
            x={PAD.l - 9}
            y={y(tick, min, max)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-current text-[10px] text-muted/70"
          >
            {tick.toFixed(tick % 1 === 0 ? 0 : 1)}
          </text>
        </g>
      ))}
    </g>
  )
}

function Monthly() {
  const rows = charts.monthly
  const max = Math.ceil(Math.max(...rows.map((row) => row.kwh)) / 200) * 200
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i)
  const band = IW / rows.length
  const bar = Math.max(3, band * 0.66)
  const years = rows.map((row, i) => ({ i, year: row.m.slice(0, 4) })).filter((row, i, all) => i === 0 || row.year !== all[i - 1].year)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly solar production">
      <title>Monthly solar production, August 2023 to November 2026</title>
      <Grid min={0} max={max} ticks={ticks} />
      {rows.map((row, i) => {
        const top = y(row.kwh, 0, max)
        return (
          <rect
            key={row.m}
            x={PAD.l + i * band + (band - bar) / 2}
            y={top}
            width={bar}
            height={PAD.t + IH - top}
            rx={1.5}
            fill="currentColor"
            opacity={0.85}
          >
            <title>{`${row.m}: ${row.kwh.toFixed(1)} kWh`}</title>
          </rect>
        )
      })}
      <g className="fill-current text-[10px] text-muted/70">
        {years.map((row) => (
          <text key={row.year} x={PAD.l + row.i * band + band / 2} y={H - 12} textAnchor="middle">
            {row.year}
          </text>
        ))}
      </g>
    </svg>
  )
}

function Residuals() {
  const rows = charts.residuals
  const raw = rows.map((row) => row.r)
  const min = Math.min(-0.2, Math.floor(Math.min(...raw) * 10) / 10)
  const max = Math.max(0.1, Math.ceil(Math.max(...raw) * 10) / 10)
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) / 4) * i)
  const years = rows.map((row, i) => ({ i, year: row.d.slice(0, 4) })).filter((row, i, all) => i === 0 || row.year !== all[i - 1].year)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Clear-day performance residual">
      <title>Clear-day residual against the seasonal baseline</title>
      <Grid min={min} max={max} ticks={ticks} />
      <line
        x1={PAD.l}
        x2={W - PAD.r}
        y1={y(0, min, max)}
        y2={y(0, min, max)}
        className="text-body/40"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <g>
        {rows.map((row, i) => (
          <circle
            key={row.d}
            cx={x(i, rows.length)}
            cy={y(row.r, min, max)}
            r={2.1}
            fill="currentColor"
            opacity={0.8}
            className={row.r < 0 ? 'text-secondary' : 'text-accent'}
          >
            <title>{`${row.d}: ${row.r.toFixed(3)}`}</title>
          </circle>
        ))}
      </g>
      <g className="fill-current text-[10px] text-muted/70">
        {years.map((row) => (
          <text key={row.year} x={x(row.i, rows.length)} y={H - 12} textAnchor="middle">
            {row.year}
          </text>
        ))}
      </g>
    </svg>
  )
}

function Curve() {
  const rows = charts.curve.points
  const max = Math.max(1, Math.ceil(Math.max(...rows.map((row) => row.kw))))
  const ticks = Array.from({ length: Math.floor(max / 2) + 1 }, (_, i) => i * 2)
  const px = (t: number) => PAD.l + (t / 24) * IW
  const line = rows.map<[number, number]>((row) => [px(row.t), y(row.kw, 0, max)])
  const area = `M${line[0][0]},${PAD.t + IH} ${path(line).slice(1)} L${line[line.length - 1][0]},${PAD.t + IH} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Production on ${charts.curve.date}`}>
      <title>{`Fifteen-minute production on ${charts.curve.date}`}</title>
      <Grid min={0} max={max} ticks={ticks} />
      <path d={area} fill="currentColor" opacity={0.18} />
      <path d={path(line)} fill="none" stroke="currentColor" strokeWidth={2} />
      <g className="fill-current text-[10px] text-muted/70">
        {[0, 6, 12, 18, 24].map((hour) => (
          <text key={hour} x={px(hour)} y={H - 12} textAnchor="middle">
            {String(hour).padStart(2, '0')}:00
          </text>
        ))}
      </g>
    </svg>
  )
}

function SelfConsumption() {
  const rows = charts.self
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  const line = rows.map<[number, number]>((row, i) => [x(i, rows.length), y(row.ratio, 0, 1)])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Daily self-consumption ratio">
      <title>Daily self-consumption ratio over the utility window</title>
      <Grid min={0} max={1} ticks={ticks} />
      <line
        x1={PAD.l}
        x2={W - PAD.r}
        y1={y(0.5, 0, 1)}
        y2={y(0.5, 0, 1)}
        className="text-body/30"
        stroke="currentColor"
        strokeDasharray="5 5"
        strokeWidth={1}
      />
      <path d={path(line)} fill="none" stroke="currentColor" strokeWidth={2} />
      {rows.map((row, i) => (
        <circle
          key={row.d}
          cx={x(i, rows.length)}
          cy={y(row.ratio, 0, 1)}
          r={2.6}
          fill="currentColor"
        >
          <title>{`${row.d}: ${(row.ratio * 100).toFixed(1)}% self-consumed`}</title>
        </circle>
      ))}
      <g className="fill-current text-[10px] text-muted/70">
        <text x={PAD.l} y={H - 12}>
          {rows[0]?.d}
        </text>
        <text x={W - PAD.r} y={H - 12} textAnchor="end">
          {rows[rows.length - 1]?.d}
        </text>
      </g>
    </svg>
  )
}

function Yearly() {
  const rows = charts.yearly
  const max = Math.ceil(Math.max(...rows.map((row) => row.mwh)))
  const ticks = Array.from({ length: max + 1 }, (_, i) => i)
  const band = IW / rows.length
  const bar = Math.max(8, band * 0.55)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Production by calendar year">
      <title>Metered production by calendar year</title>
      <Grid min={0} max={max} ticks={ticks} />
      {rows.map((row, i) => {
        const top = y(row.mwh, 0, max)
        const left = PAD.l + i * band + (band - bar) / 2
        return (
          <g key={row.year}>
            <rect
              x={left}
              y={top}
              width={bar}
              height={PAD.t + IH - top}
              rx={2}
              fill="currentColor"
              opacity={0.85}
            >
              <title>{`${row.year}: ${row.mwh.toFixed(2)} MWh`}</title>
            </rect>
            <text
              x={left + bar / 2}
              y={top - 7}
              textAnchor="middle"
              className="fill-current text-[11px] text-muted"
            >
              {row.mwh.toFixed(1)}
            </text>
          </g>
        )
      })}
      <g className="fill-current text-[10px] text-muted/70">
        {rows.map((row, i) => (
          <text key={row.year} x={PAD.l + i * band + band / 2} y={H - 12} textAnchor="middle">
            {row.year}
          </text>
        ))}
      </g>
    </svg>
  )
}

function Diurnal() {
  const { hours, days } = charts.diurnal
  const max = Math.max(1, Math.ceil(Math.max(...hours.map((row) => Math.max(row.summer, row.winter)))))
  const ticks = Array.from({ length: max + 1 }, (_, i) => i)
  const px = (hour: number) => PAD.l + (hour / 23) * IW
  const summer = hours.map<[number, number]>((row) => [px(row.h), y(row.summer, 0, max)])
  const winter = hours.map<[number, number]>((row) => [px(row.h), y(row.winter, 0, max)])

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Mean production by hour, summer and winter">
      <title>Mean output by clock hour, summer versus winter</title>
      <Grid min={0} max={max} ticks={ticks} />
      <path d={path(summer)} className="text-accent" fill="none" stroke="currentColor" strokeWidth={2} />
      <path
        d={path(winter)}
        className="text-secondary"
        fill="none"
        stroke="currentColor"
        strokeDasharray="6 4"
        strokeWidth={2}
      />
      <g className="fill-current text-[10px]">
        <text x={PAD.l + IW - 96} y={PAD.t + 2} className="fill-current text-accent">
          summer ({days.summer} d)
        </text>
        <text x={PAD.l + IW - 96} y={PAD.t + 16} className="fill-current text-secondary">
          winter ({days.winter} d)
        </text>
      </g>
      <g className="fill-current text-[10px] text-muted/70">
        {[0, 6, 12, 18].map((hour) => (
          <text key={hour} x={px(hour)} y={H - 12} textAnchor="middle">
            {String(hour).padStart(2, '0')}:00
          </text>
        ))}
      </g>
    </svg>
  )
}

function Balance() {
  // The utility join only covers part of the record, and not contiguously: six
  // months, four in 2025 and two in 2026. Bars are placed by date, so the hole
  // between them is visible instead of implied by an even band.
  const covered = charts.balance.filter((row) => row.production !== null)
  const months = charts.balance.map((row) => row.m)
  const firstAt = months.indexOf(covered[0]?.m ?? months[0])
  const lastAt = months.indexOf(covered[covered.length - 1]?.m ?? months[months.length - 1])
  const span = Math.max(1, lastAt - firstAt + 1)
  const band = IW / span
  const bar = Math.max(4, Math.min(28, band * 0.6))
  const max =
    Math.ceil(Math.max(...covered.map((row) => Math.max(row.production ?? 0, row.consumption ?? 0))) / 200) * 200
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i)
  const years = covered
    .map((row) => ({ row, at: months.indexOf(row.m) - firstAt }))
    .filter((entry, i, all) => i === 0 || entry.row.m.slice(0, 4) !== all[i - 1].row.m.slice(0, 4))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Where monthly production goes">
      <title>Monthly production split into self-consumed and exported, with grid draw</title>
      <Grid min={0} max={max} ticks={ticks} />
      {covered.map((row) => {
        const at = months.indexOf(row.m) - firstAt
        const left = PAD.l + at * band + (band - bar) / 2
        const top = y(row.production ?? 0, 0, max)
        const split = y(row.self ?? 0, 0, max)
        return (
          <g key={row.m}>
            <rect
              x={left}
              y={split}
              width={bar}
              height={PAD.t + IH - split}
              className="text-accent"
              fill="currentColor"
              opacity={0.9}
            >
              <title>{`${row.m}: ${(row.self ?? 0).toFixed(0)} kWh self-consumed`}</title>
            </rect>
            <rect
              x={left}
              y={top}
              width={bar}
              height={Math.max(0, split - top)}
              className="text-secondary"
              fill="currentColor"
              opacity={0.9}
            >
              <title>{`${row.m}: ${(row.export ?? 0).toFixed(0)} kWh exported`}</title>
            </rect>
            <circle cx={left + bar / 2} cy={y(row.consumption ?? 0, 0, max)} r={2.4} className="text-muted" fill="currentColor">
              <title>{`${row.m}: ${(row.consumption ?? 0).toFixed(0)} kWh drawn from the grid`}</title>
            </circle>
          </g>
        )
      })}
      <g className="fill-current text-[10px] text-muted/70">
        {years.map((entry) => (
          <text key={entry.row.m} x={PAD.l + entry.at * band + band / 2} y={H - 12} textAnchor="middle">
            {entry.row.m.slice(0, 4)}
          </text>
        ))}
      </g>
    </svg>
  )
}

function Histogram() {
  const values = charts.residuals.map((row) => row.r)
  const step = 0.02
  const lo = Math.floor(Math.min(...values) / step) * step
  const hi = Math.ceil(Math.max(...values) / step) * step
  const count = Math.max(1, Math.round((hi - lo) / step))
  const bins = Array.from({ length: count }, (_, i) => ({ from: lo + i * step, n: 0 }))
  for (const value of values) {
    const index = Math.min(count - 1, Math.max(0, Math.floor((value - lo) / step)))
    bins[index].n += 1
  }
  const peak = Math.max(...bins.map((bin) => bin.n))
  const band = IW / bins.length
  const within = values.filter((value) => Math.abs(value) <= 0.02).length
  const at = (value: number) => PAD.l + ((value - lo) / (hi - lo)) * IW

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Distribution of clear-day residuals">
      <title>Distribution of the clear-day residual</title>
      <Grid min={0} max={peak} ticks={[0, peak / 2, peak]} />
      <line
        x1={PAD.l}
        x2={W - PAD.r}
        y1={y(0, 0, peak)}
        y2={y(0, 0, peak)}
        className="text-body/40"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      {bins.map((bin, i) => {
        const top = y(bin.n, 0, peak)
        return (
          <rect
            key={bin.from.toFixed(3)}
            x={PAD.l + i * band + band * 0.12}
            y={top}
            width={band * 0.76}
            height={PAD.t + IH - top}
            rx={1}
            className={bin.from < 0 ? 'text-secondary' : 'text-accent'}
            fill="currentColor"
            opacity={0.85}
          >
            <title>{`${bin.from.toFixed(2)} to ${(bin.from + step).toFixed(2)}: ${bin.n} day(s)`}</title>
          </rect>
        )
      })}
      <g className="fill-current text-[10px] text-muted/70">
        <text x={PAD.l} y={H - 12}>
          {lo.toFixed(2)}
        </text>
        <text x={at(0)} y={H - 12} textAnchor="middle">
          0
        </text>
        <text x={W - PAD.r} y={H - 12} textAnchor="end">
          {hi.toFixed(2)}
        </text>
      </g>
      <text x={PAD.l + IW - 130} y={PAD.t + 2} className="fill-current text-[10px] text-muted">
        {`${((within / values.length) * 100).toFixed(0)}% within ±0.02`}
      </text>
    </svg>
  )
}

function Recent() {
  const { series, to, events } = charts.recent
  const max = Math.ceil(Math.max(...series.map((row) => row.kwh)) / 5) * 5
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i)
  const band = IW / series.length
  const bar = Math.max(2, band * 0.7)
  const center = (index: number) => PAD.l + index * band + band / 2
  const at = (date: string, fromEnd = false) => {
    const index = fromEnd
      ? series.map((row) => row.d).lastIndexOf(date)
      : series.findIndex((row) => row.d >= date)
    return index === -1 ? null : index
  }
  const draw = series
    .map((row, i) => (row.draw === null ? null : ([center(i), y(row.draw, 0, max)] as [number, number])))
    .filter((point): point is [number, number] => point !== null)
  const months = series
    .map((row, i) => ({ i, month: row.d.slice(0, 7), label: row.d.slice(5, 7) }))
    .filter((entry, i, all) => i === 0 || entry.month !== all[i - 1].month)
  const boundary = series.length - 30

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Daily production, last ${series.length} days to ${to}`}>
      <title>{`Daily production for the ${series.length} days to ${to}`}</title>
      <Grid min={0} max={max} ticks={ticks} />
      {events.map((event) => {
        const from = at(event.start)
        const toIndex = at(event.end, true)
        if (from === null || toIndex === null) return null
        return (
          <rect
            key={`${event.start}-${event.kind}`}
            x={PAD.l + from * band}
            y={PAD.t}
            width={Math.max(band, (toIndex - from + 1) * band)}
            height={IH}
            className="text-secondary"
            fill="currentColor"
            opacity={0.12}
          >
            <title>{`${event.start} to ${event.end}: ${event.kind}`}</title>
          </rect>
        )
      })}
      {series.map((row, i) => {
        const top = y(row.kwh, 0, max)
        return (
          <rect
            key={row.d}
            x={PAD.l + i * band + (band - bar) / 2}
            y={top}
            width={bar}
            height={PAD.t + IH - top}
            rx={1}
            className={row.clear ? 'text-accent' : 'text-accent/40'}
            fill="currentColor"
            opacity={row.clear ? 0.9 : 0.55}
          >
            <title>{`${row.d}: ${row.kwh.toFixed(1)} kWh${row.clear ? ', clear' : ''}${row.residual !== null ? `, residual ${row.residual.toFixed(3)}` : ''}`}</title>
          </rect>
        )
      })}
      {interventions
        .filter((entry) => entry.day >= series[0].d)
        .map((entry) => {
          const index = series.findIndex((row) => row.d === entry.day)
          if (index === -1) return null
          const cx = center(index)
          return (
            <g key={entry.id}>
              <line
                x1={cx}
                x2={cx}
                y1={PAD.t}
                y2={PAD.t + IH}
                className="text-accent-deep"
                stroke="currentColor"
                strokeWidth={1.5}
              />
              <circle cx={cx} cy={PAD.t + 4} r={2.6} className="text-accent-deep" fill="currentColor" />
              <title>{`${entry.at}: ${entry.action} ${entry.circuit}`}</title>
            </g>
          )
        })}
      {draw.length > 1 && (
        <path d={path(draw)} className="text-muted" fill="none" stroke="currentColor" strokeDasharray="4 3" strokeWidth={1.5} />
      )}
      <line
        x1={PAD.l + boundary * band}
        x2={PAD.l + boundary * band}
        y1={PAD.t}
        y2={PAD.t + IH}
        className="text-body/40"
        stroke="currentColor"
        strokeWidth={1}
      />
      <g className="fill-current text-[10px] text-muted/70">
        <text x={PAD.l + 4} y={PAD.t + 10}>
          previous 30
        </text>
        <text x={PAD.l + boundary * band + 4} y={PAD.t + 10}>
          last 30
        </text>
        {months.map((entry) => (
          <text key={entry.month} x={center(entry.i)} y={H - 12} textAnchor="middle">
            {entry.label}
          </text>
        ))}
      </g>
    </svg>
  )
}

function Changes() {
  const pairs = charts.changes.filter((change) => change.before !== null && change.after !== null)
  const left = 104
  const width = W - left - 20
  const mid = left + width / 2
  const scale = width / 2 / 0.8
  const rowHeight = 30
  const height = 34 + pairs.length * rowHeight

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" role="img" aria-label="Clear-day residual before and after each recorded change">
      <title>Clear-day residual before and after each recorded change</title>
      <line x1={mid} x2={mid} y1={22} y2={height - 14} className="text-body/40" stroke="currentColor" strokeWidth={1} />
      <g className="fill-current text-[10px] text-muted/70">
        {[-0.6, -0.3, 0.3, 0.6].map((value) => (
          <g key={value}>
            <line
              x1={mid + value * scale}
              x2={mid + value * scale}
              y1={22}
              y2={height - 14}
              className="text-line/60"
              stroke="currentColor"
              strokeDasharray="3 5"
            />
            <text x={mid + value * scale} y={height - 2} textAnchor="middle">
              {value.toFixed(1)}
            </text>
          </g>
        ))}
      </g>
      {pairs.map((change, i) => {
        const top = 24 + i * rowHeight
        const before = change.before as number
        const after = change.after as number
        const barFrom = (value: number, yTop: number) => ({
          x: value >= 0 ? mid : mid + value * scale,
          width: Math.max(1.5, Math.abs(value) * scale),
          y: yTop,
        })
        const a = barFrom(before, top)
        const b = barFrom(after, top + 11)
        return (
          <g key={`${change.start}-${change.kind}`}>
            <text x={left - 8} y={top + 8} textAnchor="end" className="fill-current text-[10px] text-muted">
              {`${change.start.slice(5)} ${change.kind}`}
            </text>
            <rect {...a} height={8} rx={1} className="text-secondary" fill="currentColor" opacity={0.9}>
              <title>{`before ${change.start}: ${before.toFixed(3)}`}</title>
            </rect>
            <rect {...b} height={8} rx={1} className="text-accent" fill="currentColor" opacity={0.9}>
              <title>{`after ${change.end}: ${after.toFixed(3)}`}</title>
            </rect>
          </g>
        )
      })}
    </svg>
  )
}

function Windows() {
  const { last, previous, last_year } = charts.windows
  const percent = (value: number | null) => (value === null ? '—' : `${(value * 100).toFixed(0)}%`)
  const decimal = (value: number | null) => (value === null ? '—' : value.toFixed(3))
  const delta = (value: number | null, against: number | null) =>
    value === null || against === null ? '' : `${value - against >= 0 ? '+' : ''}${(value - against).toFixed(2)}`

  const rows = [
    { k: 'days in the window', cells: [String(last.days), String(previous.days), String(last_year.days)], note: '' },
    { k: 'clear days', cells: [String(last.clear), String(previous.clear), String(last_year.clear)], note: '' },
    {
      k: 'mean production, kWh/day',
      cells: [last.mean_kwh.toFixed(1), previous.mean_kwh.toFixed(1), last_year.mean_kwh.toFixed(1)],
      note: delta(last.mean_kwh, previous.mean_kwh),
    },
    {
      k: 'clear-day residual',
      cells: [decimal(last.residual), decimal(previous.residual), decimal(last_year.residual)],
      note: delta(last.residual, previous.residual),
    },
    {
      k: 'self-consumed',
      cells: [percent(last.self_ratio), percent(previous.self_ratio), percent(last_year.self_ratio)],
      note: 'utility window only',
    },
    {
      k: 'exported share',
      cells: [percent(last.export_share), percent(previous.export_share), percent(last_year.export_share)],
      note: 'utility window only',
    },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="pb-2 font-medium">metric</th>
            <th className="pb-2 text-right font-medium">{`last 30 · ${last.from} → ${last.to}`}</th>
            <th className="pb-2 text-right font-medium">{`previous 30 · ${previous.from} → ${previous.to}`}</th>
            <th className="pb-2 text-right font-medium">{`same 30 last year · ${last_year.from} → ${last_year.to}`}</th>
            <th className="pb-2 text-right font-medium">Δ vs previous</th>
          </tr>
        </thead>
        <tbody className="font-mono text-body">
          {rows.map((row) => (
            <tr key={row.k} className="border-t border-line">
              <td className="py-2 font-sans text-muted">{row.k}</td>
              {row.cells.map((cell, i) => (
                <td key={i} className="py-2 text-right">
                  {cell}
                </td>
              ))}
              <td className="py-2 text-right text-muted">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Interventions() {
  const rows = interventions
  if (!rows.length) {
    return (
      <div className="grid gap-3">
        <p className="max-w-2xl text-sm leading-7 text-muted">
          None recorded yet. An intervention is a thing a person did — unplugged a freezer, removed a
          standby draw, turned the array off, switched a circuit at the breaker — with whatever was
          measured at the time. The record cannot see one on its own; it has to be declared, and then it
          becomes a keyframe and a marker here.
        </p>
        <pre className="overflow-x-auto rounded-xl border border-line-soft bg-surface-2 p-4 font-mono text-[13px] leading-6 text-body/90">
          <code>{`npm run intervention -- add --circuit garage --action unplug \\
  --load "chest freezer" --minutes 90 --volts 120.1 --amps 1.35 --pf 0.92 \\
  --source "clamp meter, panel A"`}</code>
        </pre>
        <p className="text-sm text-muted">
          Real power needs a power factor on AC; without one the record keeps apparent power (VA) and
          leaves watts and watt-hours empty rather than assuming 1.0.
        </p>
      </div>
    )
  }

  const num = (value: number | null, digits = 1) => (value === null ? '—' : value.toFixed(digits))

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-muted">
            <th className="pb-2 font-medium">when (local)</th>
            <th className="pb-2 font-medium">circuit</th>
            <th className="pb-2 font-medium">action</th>
            <th className="pb-2 text-right font-medium">VA</th>
            <th className="pb-2 text-right font-medium">W</th>
            <th className="pb-2 text-right font-medium">Wh</th>
            <th className="pb-2 text-right font-medium">kWh/day before → after</th>
            <th className="pb-2 text-right font-medium">residual before → after</th>
          </tr>
        </thead>
        <tbody className="font-mono text-body">
          {rows.map((entry) => (
            <tr key={entry.id} className="border-t border-line">
              <td className="py-2">{entry.at.slice(0, 16).replace('T', ' ')}</td>
              <td className="py-2 font-sans text-muted">{entry.circuit}</td>
              <td className="py-2 font-sans text-muted">
                {entry.action.replace(/-/g, ' ')}
                {entry.load ? ` · ${entry.load}` : ''}
              </td>
              <td className="py-2 text-right">{num(entry.va)}</td>
              <td className="py-2 text-right">{num(entry.watts)}</td>
              <td className="py-2 text-right">{num(entry.wh)}</td>
              <td className="py-2 text-right">
                {`${num(entry.before.mean_kwh)} → ${num(entry.after.mean_kwh)}`}
              </td>
              <td className="py-2 text-right">
                {`${num(entry.before.residual, 3)} → ${num(entry.after.residual, 3)}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-sm text-muted/80">
        {`${rows.length} intervention(s). Each row compares the seven days either side of the action; the residual column is the weather-normalized one, which is the only one that can be compared across seasons.`}
      </p>
    </div>
  )
}

function Tou() {
  const { hours, peak, window } = charts.tou
  const max = Math.ceil(Math.max(...hours.map((row) => Math.max(row.generated, row.imported))))
  const ticks = Array.from({ length: max + 1 }, (_, i) => i)
  const px = (hour: number) => PAD.l + (hour / 23) * IW
  const generated = hours.map<[number, number]>((row) => [px(row.h), y(row.generated, 0, max)])
  const imported = hours.map<[number, number]>((row) => [px(row.h), y(row.imported, 0, max)])
  const area = `M${generated[0][0]},${PAD.t + IH} ${path(generated).slice(1)} L${generated[generated.length - 1][0]},${PAD.t + IH} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Generation and grid import by hour of day">
      <title>Mean generation and mean grid import at each clock hour</title>
      <Grid min={0} max={max} ticks={ticks} />
      {peak && (
        <>
          <rect
            x={Math.max(PAD.l, px(peak.from) - (px(1) - px(0)) / 2)}
            y={PAD.t}
            width={Math.min(W - PAD.r, px(peak.to) + (px(1) - px(0)) / 2) - Math.max(PAD.l, px(peak.from) - (px(1) - px(0)) / 2)}
            height={IH}
            className="text-muted"
            fill="currentColor"
            opacity={0.1}
          />
          <text
            x={px(peak.from) - (px(1) - px(0)) / 2 + 4}
            y={PAD.t + 10}
            className="fill-current text-[10px] text-muted"
          >{`on-peak ${String(peak.from).padStart(2, '0')}:00–${String(peak.to + 1).padStart(2, '0')}:00 Mon–Fri`}</text>
        </>
      )}
      <path d={area} fill="currentColor" opacity={0.18} />
      <path d={path(generated)} fill="none" stroke="currentColor" strokeWidth={2} />
      <path
        d={path(imported)}
        className="text-secondary"
        fill="none"
        stroke="currentColor"
        strokeDasharray="6 4"
        strokeWidth={2}
      />
      <g className="fill-current text-[10px]">
        <text x={PAD.l + 4} y={PAD.t + 10} className="fill-current text-accent">
          generation
        </text>
        <text x={PAD.l + 4} y={PAD.t + 24} className="fill-current text-secondary">
          grid import
        </text>
      </g>
      <g className="fill-current text-[10px] text-muted/70">
        {[0, 6, 12, 18].map((hour) => (
          <text key={hour} x={px(hour)} y={H - 12} textAnchor="middle">
            {String(hour).padStart(2, '0')}:00
          </text>
        ))}
        <text x={W - PAD.r} y={H - 12} textAnchor="end">
          {`${window.days} days, ${window.from} → ${window.to}`}
        </text>
      </g>
    </svg>
  )
}

function TouDays() {
  const rows = charts.touDays.days
  const max = Math.ceil(Math.max(...rows.map((row) => row.on + row.off)) / 2) * 2
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i)
  const band = IW / rows.length
  const bar = Math.max(3, Math.min(18, band * 0.62))
  const months = rows
    .map((row, i) => ({ i, month: row.d.slice(0, 7) }))
    .filter((entry, i, all) => i === 0 || entry.month !== all[i - 1].month)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Peak and off-peak import by day">
      <title>Grid import per day, split into on-peak and off-peak</title>
      <Grid min={0} max={max} ticks={ticks} />
      {rows.map((row, i) => {
        const left = PAD.l + i * band + (band - bar) / 2
        const offTop = y(row.off, 0, max)
        const totalTop = y(row.off + row.on, 0, max)
        return (
          <g key={row.d}>
            <rect x={left} y={offTop} width={bar} height={PAD.t + IH - offTop} rx={1} className="text-secondary" fill="currentColor" opacity={0.85}>
              <title>{`${row.d}: ${row.off.toFixed(2)} kWh off-peak`}</title>
            </rect>
            <rect x={left} y={totalTop} width={bar} height={Math.max(0, offTop - totalTop)} rx={1} className="text-accent" fill="currentColor" opacity={0.95}>
              <title>{`${row.d}: ${row.on.toFixed(2)} kWh on-peak`}</title>
            </rect>
          </g>
        )
      })}
      <g className="fill-current text-[10px] text-muted/70">
        {months.map((entry) => (
          <text key={entry.month} x={PAD.l + entry.i * band + band / 2} y={H - 12} textAnchor="middle">
            {entry.month.slice(5)}
          </text>
        ))}
      </g>
      <g className="fill-current text-[10px]">
        <text x={PAD.l + IW - 92} y={PAD.t + 10} className="fill-current text-accent">
          on-peak
        </text>
        <text x={PAD.l + IW - 92} y={PAD.t + 24} className="fill-current text-secondary">
          off-peak
        </text>
      </g>
    </svg>
  )
}

function Pricing() {
  const { observed, seasonal } = charts.pricing
  const groups = [
    { label: 'billed winter, 30 d', flat: observed.flat, tou: observed.tou, days: observed.days },
    ...seasonal.map((row) => ({
      label: `${row.season}, metered ${row.days} d`,
      flat: row.flat,
      tou: row.tou,
      days: row.days,
    })),
  ]
  const max = Math.ceil(Math.max(...groups.map((group) => Math.max(group.flat, group.tou))) / 50) * 50
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i)
  const band = IW / groups.length
  const bar = Math.min(46, band * 0.28)
  const cents = (value: number) => `${(value * 100).toFixed(1)}¢`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cost under the time-of-use plan against the flat rate">
      <title>Cost under the time-of-use plan against the flat rate, by window</title>
      <Grid min={0} max={max} ticks={ticks} />
      {groups.map((group, i) => {
        const left = PAD.l + i * band + band / 2
        const flatTop = y(group.flat, 0, max)
        const touTop = y(group.tou, 0, max)
        const delta = group.tou - group.flat
        return (
          <g key={group.label}>
            <rect
              x={left - bar - 2}
              y={flatTop}
              width={bar}
              height={PAD.t + IH - flatTop}
              rx={2}
              className="text-secondary"
              fill="currentColor"
              opacity={0.85}
            >
              <title>{`${group.label}: flat $${group.flat.toFixed(2)}`}</title>
            </rect>
            <rect
              x={left + 2}
              y={touTop}
              width={bar}
              height={PAD.t + IH - touTop}
              rx={2}
              className="text-accent"
              fill="currentColor"
              opacity={0.9}
            >
              <title>{`${group.label}: time of use $${group.tou.toFixed(2)}`}</title>
            </rect>
            <text
              x={left}
              y={Math.min(flatTop, touTop) - 8}
              textAnchor="middle"
              className="fill-current text-[10px] text-muted"
            >{`${delta > 0 ? '+' : ''}${delta.toFixed(2)}`}</text>
            <text x={left} y={H - 12} textAnchor="middle" className="fill-current text-[10px] text-muted/70">
              {group.label}
            </text>
          </g>
        )
      })}
      <g className="fill-current text-[10px] text-muted/70">
        <text x={PAD.l - 9} y={PAD.t + 10} textAnchor="end">{`$${max}`}</text>
        <text x={PAD.l + 4} y={PAD.t + 10} className="fill-current text-secondary">
          flat
        </text>
        <text x={PAD.l + 4} y={PAD.t + 24} className="fill-current text-accent">
          time of use
        </text>
      </g>
      <text x={W - PAD.r} y={PAD.t + 10} textAnchor="end" className="fill-current text-[10px] text-muted/70">
        {`usage only · no $${charts.pricing.excluded.service_facility_month_usd.toFixed(2)} service charge, no riders`}
      </text>
      <text x={W - PAD.r} y={PAD.t + 24} textAnchor="end" className="fill-current text-[10px] text-muted/70">
        {`summer on-peak ${cents(charts.pricing.rates.tou.summer.on_peak)} · weekends off-peak`}
      </text>
    </svg>
  )
}

function Spread() {
  const { spread, storage } = charts.pricing
  const rows = [
    { label: 'winter', value: spread.winter, kwh: storage.winter_on_peak_kwh, note: `$${storage.winter_saved_usd.toFixed(2)} on ${storage.winter_on_peak_kwh.toFixed(1)} kWh` },
    { label: 'summer', value: spread.summer, kwh: storage.summer_on_peak_kwh, note: `$${storage.summer_saved_usd.toFixed(2)} on ${storage.summer_on_peak_kwh.toFixed(1)} kWh` },
  ]
  const limit = Math.ceil(Math.max(...rows.map((row) => Math.abs(row.value))) * 100)
  const mid = PAD.t + IH / 2
  const scale = IW / 2 / limit
  const band = IW / rows.length

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Value of shifting a peak kilowatt hour to off-peak">
      <title>Value of moving one kilowatt hour from off-peak to on-peak, by reading</title>
      <line x1={PAD.l} x2={W - PAD.r} y1={mid} y2={mid} className="text-body/40" stroke="currentColor" strokeWidth={1} />
      {[-limit, -limit / 2, limit / 2, limit].map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.l + IW / 2 + tick * scale}
            x2={PAD.l + IW / 2 + tick * scale}
            y1={PAD.t}
            y2={PAD.t + IH}
            className="text-line/60"
            stroke="currentColor"
            strokeDasharray="3 5"
          />
          <text
            x={PAD.l + IW / 2 + tick * scale}
            y={PAD.t + IH + 14}
            textAnchor="middle"
            className="fill-current text-[10px] text-muted/70"
          >
            {`${tick > 0 ? '+' : ''}${tick}¢`}
          </text>
        </g>
      ))}
      {rows.map((row, i) => {
        const value = row.value * 100
        const left = PAD.l + i * band + band / 2
        const width = Math.max(2, Math.abs(value) * scale)
        const x = left - width / 2
        const top = value >= 0 ? mid - 16 : mid + 2
        return (
          <g key={row.label}>
            <rect
              x={x}
              y={top}
              width={width}
              height={14}
              rx={2}
              className={value >= 0 ? 'text-accent' : 'text-secondary'}
              fill="currentColor"
              opacity={0.9}
            >
              <title>{`${row.label}: ${value.toFixed(2)}¢ per kWh moved (${row.kwh.toFixed(1)} kWh observed)`}</title>
            </rect>
            <text x={left} y={PAD.t + 10} textAnchor="middle" className="fill-current text-[10px] text-muted">
              {row.label}
            </text>
            <text
              x={left}
              y={value >= 0 ? top - 5 : top + 22}
              textAnchor="middle"
              className="fill-current text-[10px] text-body"
            >
              {`${value > 0 ? '+' : ''}${value.toFixed(2)}¢ · ${row.note}`}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export function Charts() {
  usePageMeta(
    'Charts',
    'Eleven views: the last sixty days, the clear-day residual before and after each recorded change, three comparable thirty-day windows, then the whole record by year, month, hour and distribution.',
  )

  const summary = charts.summary

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-xs tracking-[0.18em] text-accent uppercase">Charts</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-body sm:text-5xl">
        The record, recently, and what changed.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
        Every chart is drawn from the published CSVs at build time and rendered as static SVG. No
        chart library, no runtime fetch, and the numbers stay in the page when the script does not
        run.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { k: 'Days', v: summary.days.toLocaleString() },
          { k: 'Clear days', v: summary.clear_days.toLocaleString() },
          { k: 'Total MWh', v: summary.total_mwh.toFixed(1) },
          { k: 'Self-consumed', v: `${(summary.self_window_avg * 100).toFixed(1)}%` },
        ].map((fact) => (
          <div key={fact.k} className="rounded-xl border border-line bg-surface px-4 py-3">
            <p className="font-mono text-xl font-semibold text-body">{fact.v}</p>
            <p className="mt-1 text-[11px] tracking-[0.14em] text-muted uppercase">{fact.k}</p>
          </div>
        ))}
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight text-body">Recently — and what changed</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">
          A/B here is observational, not controlled: the windows do not see the same weather, and the residual
          normalizes for the sun, not for a change you made. What it can show is whether a level held or stepped
          when nothing else did. The window ends on the last published day, not on today.
        </p>
        <div className="mt-6 grid gap-6">
          <Figure
            title={`The last ${charts.recent.days} days, to ${charts.recent.to}`}
            note="Bars are daily production, solid for clear days and faded for the rest; the dashed line is the house's draw from the grid where the utility join reaches. The shaded band is a recorded event, and the rule at thirty days separates the two windows compared below."
          >
            <Recent />
          </Figure>

          <Figure
            title="Declared interventions"
            note="What a person did, when, against which circuit, and what it measured. Each row's before-and-after uses the seven days either side; a declared action is a fence, not a proof, because the weather inside the fence is not the same."
          >
            <Interventions />
          </Figure>

          <Figure
            title="Before and after each recorded change"
            note={`Clear-day residual either side of the last eight recorded events, of which ${charts.changes.filter((change) => change.before !== null && change.after !== null).length} have a clear day on both sides and are drawn. Secondary is before, accent is after; a pair that crosses zero recovered its expected output. The rest are left out rather than faked.`}
          >
            <Changes />
          </Figure>

          <Figure
            title="Thirty days, three ways"
            note="The last thirty days, the thirty before them, and the same thirty days a year earlier. Production is the raw mean; the residual is the weather-normalized one and is the only column that compares across seasons. Self-consumption and export need the utility join, which does not reach every window."
          >
            <Windows />
          </Figure>
        </div>
      </section>

      <h2 className="mt-14 text-xl font-semibold tracking-tight text-body">The whole record</h2>
      <div className="mt-6 grid gap-6">
        <Figure
          title="Monthly production"
          note="Forty months of metered energy. The seasonal shape is the sun, not the panels; compare the residual below for condition."
        >
          <Monthly />
        </Figure>

        <Figure
          title="Calendar years"
          note="Metered energy per calendar year. 2023 starts in August and 2026 runs to the latest published day, so the first and last bars are partial — the shape, not the total, is the comparison."
        >
          <Yearly />
        </Figure>

        <Figure
          title="The shape of a day"
          note={`Mean output at each clock hour, summer against winter, over ${charts.diurnal.days.summer} summer and ${charts.diurnal.days.winter} winter days. The winter peak is lower and later; the shoulder hours are where a battery would have to work.`}
        >
          <Diurnal />
        </Figure>

        <Figure
          title="Generation against grid import, by hour"
          note={`Mean output and mean import at each clock hour over ${charts.tou.window.days} days (${charts.tou.window.from} → ${charts.tou.window.to}). Import is zero through the middle of the day because there is no import to record — the meter is running backwards, not missing. The shaded window is the tariff's: 5 to 9 p.m., Monday to Friday, read from the rate sheet and checked against the utility's own on/off-peak series. The hourly means mix weekdays and weekends, which the tariff does not — the summer and winter splits below do respect it.`}
        >
          <Tou />
        </Figure>

        <Figure
          title="Clear-day residual"
          note="Each dot is a clear day's weather-normalized index minus its seasonal baseline. Negative runs with cold or wet context are snow; a decline across dry days is a soiling candidate."
        >
          <Residuals />
        </Figure>

        <Figure
          title="How the residual is distributed"
          note="The same clear days, counted instead of ordered in time. A tight central mass is a baseline that predicts; a long negative tail is weather the normalization did not explain, and the split either side of zero says whether the model is biased."
        >
          <Histogram />
        </Figure>

        <Figure
          title={`One clear day — ${charts.curve.date}`}
          note={`Fifteen-minute production on the highest-energy day in the record (${summary.best_day.kwh.toFixed(1)} kWh). The intervals are sparse: SolarEdge returns production, not a full day of zeros.`}
        >
          <Curve />
        </Figure>

        <Figure
          title="Self-consumption"
          note="Share of daily production used on site over the utility window. The dashed line is 50%; the ratio falls when a sunny day exports more than the house can absorb."
        >
          <SelfConsumption />
        </Figure>

        <Figure
          title="Where the production goes"
          note={`Monthly production split into self-consumed and exported, with the house's grid draw as a dot, over the ${charts.balance.filter((row) => row.production !== null).length} months the utility join covers. They are not contiguous — four in 2025, two in 2026 — so the bars are placed by date and the gap is left empty rather than drawn as an even band.`}
        >
          <Balance />
        </Figure>

        <Figure
          title="Peak and off-peak, day by day"
          note={`The ${charts.touDays.days.length} days that carry an on/off-peak split, ${charts.touDays.from} → ${charts.touDays.to}: ${charts.touDays.totals.off.toFixed(0)} kWh off-peak against ${charts.touDays.totals.on.toFixed(0)} kWh on-peak. Those days are recent and autumn, so they are drawn on their own rather than mixed into the summer shape above — two windows, two questions.`}
        >
          <TouDays />
        </Figure>

        <Figure
          title="Time of use or flat rate, in dollars"
          note={`The two plans priced against the same recorded kWh, by window. Time of use is dearer in all three, because the peak price (${(charts.pricing.rates.tou.summer.on_peak * 100).toFixed(2)}¢ summer, ${(charts.pricing.rates.tou.winter.on_peak * 100).toFixed(2)}¢ winter) is well above the flat rate and this house does use the evening. Usage only — the $${charts.pricing.excluded.service_facility_month_usd.toFixed(2)} service charge and the bill riders are excluded, and a fixed charge is identical under both plans anyway.`}
        >
          <Pricing />
        </Figure>

        <Figure
          title="What a peak kilowatt hour is worth from storage"
          note={`What one kWh is worth when it moves from off-peak to on-peak: ${(charts.pricing.spread.winter * 100).toFixed(2)}¢ in winter, ${(charts.pricing.spread.summer * 100).toFixed(2)}¢ in summer. Against this household's own peak energy that is $${charts.pricing.storage.winter_saved_usd.toFixed(2)} over the billed 30 days and $${charts.pricing.storage.summer_saved_usd.toFixed(2)} across the metered summer — a ceiling on arbitrage, not a battery's return: no round-trip loss, no power limit, no days already full.`}
        >
          <Spread />
        </Figure>
      </div>

      <p className="mt-8 text-sm text-muted">
        The source columns and the arithmetic are in{' '}
        <Link to="/guides/query" className="text-accent underline decoration-accent/30 underline-offset-4">
          the query guide
        </Link>{' '}
        and the method is in{' '}
        <Link to="/docs/charts" className="text-accent underline decoration-accent/30 underline-offset-4">
          how the charts are built
        </Link>
        . Raw files: <a href={`${DATA}/manifest.json`} className="text-accent underline decoration-accent/30 underline-offset-4">manifest</a>,{' '}
        <a href={`${DATA}/solar-production-monthly.csv`} className="text-accent underline decoration-accent/30 underline-offset-4">monthly</a>,{' '}
        <a href={`${DATA}/solar-production-daily.csv`} className="text-accent underline decoration-accent/30 underline-offset-4">daily</a>.
      </p>
    </div>
  )
}
