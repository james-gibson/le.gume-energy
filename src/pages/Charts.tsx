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

export function Charts() {
  usePageMeta('Charts', 'Four views of the published record: monthly production, clear-day residuals, one clear day, and self-consumption.')

  const summary = charts.summary

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-xs tracking-[0.18em] text-accent uppercase">Charts</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-body sm:text-5xl">
        The record, at four scales.
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

      <div className="mt-10 grid gap-6">
        <Figure
          title="Monthly production"
          note="Forty months of metered energy. The seasonal shape is the sun, not the panels; compare the residual below for condition."
        >
          <Monthly />
        </Figure>

        <Figure
          title="Clear-day residual"
          note="Each dot is a clear day's weather-normalized index minus its seasonal baseline. Negative runs with cold or wet context are snow; a decline across dry days is a soiling candidate."
        >
          <Residuals />
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
