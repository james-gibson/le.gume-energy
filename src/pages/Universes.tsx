import { Link } from 'react-router-dom'
import { energyRecordUniverse } from '../universes/energy'
import { usePageMeta } from '../lib/usePageMeta'

const W = 860
const H = 190
const PAD = 24
const IW = W - PAD * 2
const DATA = 'https://james-gibson.github.io/le.gume-energy/data'

const ms = (ns: bigint) => Number(ns / 1_000_000n)
const day = (ns: bigint) => new Date(ms(ns)).toISOString().slice(0, 10)
const stamp = (ns: bigint) => new Date(ms(ns)).toISOString().replace('T', ' ').slice(0, 16) + 'Z'

const universe = energyRecordUniverse
const segments = universe.temporalStructure.segments
const keyframes = universe.temporalStructure.keyframes
const start = ms(segments[0].start)
const end = ms(segments[segments.length - 1].end)
const x = (ns: bigint) => PAD + ((ms(ns) - start) / (end - start)) * IW

const meta = universe.metadata as {
  timezone?: unknown
  granularity?: unknown
  files?: unknown
  coverage?: { solar_production?: { first_local?: unknown; last_local?: unknown } }
}

function Timeline() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Universe timeline">
      <title>Yearly segments and event keyframes</title>
      {segments.map((segment, index) => {
        const x0 = x(segment.start)
        const x1 = x(segment.end)
        return (
          <g key={segment.id}>
            <rect
              x={x0}
              y={70}
              width={Math.max(2, x1 - x0 - 3)}
              height={30}
              rx={4}
              fill="currentColor"
              opacity={index % 2 === 0 ? 0.85 : 0.55}
            >
              <title>{`${segment.id}: ${segment.description ?? ''}`}</title>
            </rect>
            <text
              x={(x0 + x1) / 2}
              y={118}
              textAnchor="middle"
              className="fill-current text-[11px] text-muted/70"
            >
              {segment.id.replace('year-', '')}
            </text>
          </g>
        )
      })}
      {keyframes.map((keyframe) => (
        <circle
          key={keyframe.id}
          cx={x(keyframe.timestamp)}
          cy={42}
          r={2.6}
          fill="currentColor"
          opacity={0.85}
          className={keyframe.tags.includes('analysis-event') ? 'text-secondary' : 'text-accent'}
        >
          <title>{`${day(keyframe.timestamp)} · ${keyframe.id}`}</title>
        </circle>
      ))}
      <line
        x1={PAD}
        x2={W - PAD}
        y1={42}
        y2={42}
        className="text-line/60"
        stroke="currentColor"
        strokeDasharray="3 6"
      />
      <text x={PAD} y={158} className="fill-current text-[10px] text-muted/70">
        {day(segments[0].start)}
      </text>
      <text x={W - PAD} y={158} textAnchor="end" className="fill-current text-[10px] text-muted/70">
        {day(segments[segments.length - 1].end)}
      </text>
    </svg>
  )
}

export function Universes() {
  usePageMeta(
    'The universe',
    'The energy record as a local-time Universe: yearly segments, analysis events as keyframes, and a downloadable JSON form.',
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-xs tracking-[0.18em] text-accent uppercase">Local-time universe</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-body sm:text-5xl">
        The record on a timeline.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">
        The CSVs also ship as a <code className="font-mono text-body">Universe</code>: yearly
        segments and every analysis event as a keyframe, generated from the published files. The
        module is structural local-time — no runtime dependency, and the JSON is the same data.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs">
        <span className="max-w-full rounded-full border border-line px-2.5 py-1 font-mono break-all text-muted">
          {universe.universeId}
        </span>
        <span className="rounded-full border border-line px-2.5 py-1 text-muted">
          {segments.length} segments
        </span>
        <span className="rounded-full border border-line px-2.5 py-1 text-muted">
          {keyframes.length} keyframes
        </span>
        <span className="rounded-full border border-line px-2.5 py-1 text-muted">
          {String(meta.timezone ?? '')}
        </span>
      </div>

      <figure className="mt-8 rounded-2xl border border-line bg-surface p-5 text-accent sm:p-6">
        <figcaption>
          <h2 className="text-lg font-semibold tracking-tight text-body">Timeline</h2>
          <p className="mt-1 text-sm text-muted">
            Yearly segments are bars; the line above carries every keyframe. Violet dots are
            analysis events, pink dots are record milestones.
          </p>
        </figcaption>
        <div className="mt-4">
          <Timeline />
        </div>
      </figure>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight text-body">Segments</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
            <thead className="text-xs tracking-[0.12em] text-muted uppercase">
              <tr>
                <th className="border-b border-line py-2 font-medium">Year</th>
                <th className="border-b border-line py-2 font-medium">From</th>
                <th className="border-b border-line py-2 font-medium">To</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((segment) => (
                <tr key={segment.id}>
                  <td className="border-b border-line-soft py-2 font-mono text-xs text-muted">
                    {segment.id.replace('year-', '')}
                  </td>
                  <td className="border-b border-line-soft py-2 text-body">{day(segment.start)}</td>
                  <td className="border-b border-line-soft py-2 text-body">{day(segment.end)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Segment boundaries are calendar years in UTC; the daily rows they contain are local
            calendar days. End dates are exclusive: a year ends at the next year's first midnight.
          </p>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight text-body">Metadata</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs tracking-[0.12em] text-muted uppercase">Canonical name</dt>
              <dd className="mt-1 text-body">{universe.metadata.canonicalName}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.12em] text-muted uppercase">Granularity</dt>
              <dd className="mt-1 text-body">{String(meta.granularity ?? '')}</dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.12em] text-muted uppercase">Files</dt>
              <dd className="mt-1 text-body">
                {Array.isArray(meta.files) ? meta.files.length : 0} published files
              </dd>
            </div>
            <div>
              <dt className="text-xs tracking-[0.12em] text-muted uppercase">Usage</dt>
              <dd className="mt-1 text-body">
                {universe.attribution.usage_restrictions.join(', ')}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted">
            Download the JSON form:{' '}
            <a
              href={`${DATA}/universes/energy.json`}
              className="text-accent underline decoration-accent/30 underline-offset-4"
            >
              energy.json
            </a>{' '}
            ·{' '}
            <a
              href={`${DATA}/universes/index.json`}
              className="text-accent underline decoration-accent/30 underline-offset-4"
            >
              index.json
            </a>
          </p>
        </section>
      </div>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight text-body">Keyframes</h2>
        <p className="mt-1 text-sm text-muted">
          Every analysis event, plus the record start and end, the best production day and the
          utility window. Timestamps are the day at noon UTC with <code>DAY</code> precision.
        </p>
        <div className="mt-4 max-h-[30rem] overflow-auto rounded-xl border border-line-soft">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs tracking-[0.12em] text-muted uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Day</th>
                <th className="px-3 py-2 font-medium">Id</th>
                <th className="px-3 py-2 text-right font-medium">Sig.</th>
                <th className="px-3 py-2 font-medium">Tags</th>
                <th className="px-3 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {keyframes.map((keyframe) => (
                <tr key={keyframe.id}>
                  <td className="whitespace-nowrap border-t border-line-soft px-3 py-2 font-mono text-xs text-muted">
                    {day(keyframe.timestamp)}
                  </td>
                  <td className="border-t border-line-soft px-3 py-2 font-mono text-xs text-body">
                    {keyframe.id}
                  </td>
                  <td className="border-t border-line-soft px-3 py-2 text-right font-mono text-xs text-muted">
                    {keyframe.significance.toFixed(2)}
                  </td>
                  <td className="border-t border-line-soft px-3 py-2 text-xs text-muted">
                    {keyframe.tags.join(', ')}
                  </td>
                  <td className="border-t border-line-soft px-3 py-2 text-muted">
                    {keyframe.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold tracking-tight text-body">Use it</h2>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-line-soft bg-surface-2 p-4 font-mono text-[13px] leading-6 text-body/90">
          <code>{`import { energyRecordUniverse } from './src/universes/energy'

energyRecordUniverse.temporalStructure.keyframes
  .filter((k) => k.tags.includes('analysis-event'))
  .map((k) => [k.timestamp, k.description])`}</code>
        </pre>
        <p className="mt-3 text-sm text-muted">
          The shape and the regeneration rule are in{' '}
          <Link to="/docs/universes" className="text-accent underline decoration-accent/30 underline-offset-4">
            the universe guide
          </Link>
          . The timestamp of a keyframe is a <code>bigint</code> in nanoseconds, and the day at
          noon UTC because the event is a day, not an instant: {stamp(keyframes[0].timestamp)}.
        </p>
      </section>
    </div>
  )
}
