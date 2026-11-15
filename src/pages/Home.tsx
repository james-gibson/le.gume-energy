import { Link } from 'react-router-dom'
import { AnimatedCounter } from '../components/silicon-ui/animated-counter/animated-counter'
import { Badge } from '../components/silicon-ui/badge/badge'
import { ButtonLink } from '../components/silicon-ui/button-link/button-link'
import { CopyButton } from '../components/silicon-ui/copy-button/copy-button'
import { PAGES, SECTIONS, pagesIn } from '../lib/content'
import { MotionReveal, useMotion } from '../lib/motion'
import { usePageMeta } from '../lib/usePageMeta'

const base = import.meta.env.BASE_URL
const DOWNLOAD =
  'curl -O https://james-gibson.github.io/le.gume-energy/data/solar-production-daily.csv'

export function Home() {
  usePageMeta(undefined, 'A non-identifying record of a home solar system: production, weather, utility usage and the events that explain the gaps, in local time.')
  const { mode } = useMotion()
  const still = mode === 'still'

  const facts = [
    { k: 'Days', v: 1188 },
    { k: 'Interval rows', v: 61015 },
    { k: 'Sections', v: SECTIONS.length },
  ]

  return (
    <>
      <section className="relative overflow-hidden border-b border-line/70">
        <div className="plot-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
          <div className="min-w-0">
            <MotionReveal>
              <Badge
                size="sm"
                icon={<span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              >
                2023-08-14 → 2026-11-13 · America/Denver
              </Badge>
            </MotionReveal>

            <MotionReveal delay={60}>
              <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-tight text-body sm:text-6xl">
                A home solar record,
                <br />
                in <span className="text-accent">local time</span>.
              </h1>
            </MotionReveal>

            <MotionReveal delay={120}>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
                Production, weather, utility usage and the events that explain the gaps.
                Published as eleven CSV files and a manifest, with the site, account,
                address, coordinates and serials removed.
              </p>
            </MotionReveal>

            <MotionReveal delay={180}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <ButtonLink href={`${base}docs/overview`} variant="primary">
                  Read the record
                </ButtonLink>
                <ButtonLink href={`${base}guides/download`} variant="secondary">
                  Download the files
                </ButtonLink>
              </div>
            </MotionReveal>

            <p className="mt-6 text-xs text-muted/70">
              Pseudonymous, not anonymous. The manifest says what was removed and what still
              narrows the population.
            </p>
          </div>

          <MotionReveal delay={140} className="min-w-0">
            <div className="relative overflow-hidden rounded-2xl border border-line bg-surface/90 p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs tracking-[0.16em] text-muted uppercase">One file</p>
                <CopyButton value={DOWNLOAD} label="Copy" />
              </div>
              <pre className="mt-4 overflow-x-auto rounded-xl border border-line-soft bg-surface-2 p-4 font-mono text-[13px] leading-6 text-body/90">
                <code>{DOWNLOAD}</code>
              </pre>
              <ul className="mt-5 space-y-3 text-sm text-muted">
                <li className="flex gap-3">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  Every instant carries both local time and UTC.
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  Weather-normalized residuals separate snow from soiling.
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-secondary" />
                  The utility join stops at the local calendar date.
                </li>
              </ul>
            </div>
          </MotionReveal>
        </div>
      </section>

      <section className="border-b border-line/70 bg-surface/30">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-3 gap-6 px-5 py-10 sm:px-8">
          {facts.map((fact) => (
            <div key={fact.k}>
              <p className="font-mono text-3xl font-semibold text-body sm:text-4xl">
                {still ? fact.v : <AnimatedCounter value={fact.v} animateOnView />}
              </p>
              <p className="mt-1 text-xs tracking-[0.14em] text-muted uppercase">{fact.k}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-body sm:text-3xl">
              Every section, one contract
            </h2>
            <p className="mt-2 max-w-xl text-muted">
              Each section is a folder. Each page is a file. The navigation builds itself from
              both, which is why the dataset description cannot drift from the dataset.
            </p>
          </div>
          <Link
            to="/docs/overview"
            className="text-sm text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
          >
            Start with the overview
          </Link>
        </div>

        <MotionReveal className="mt-8">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <Link
                  to={`/${section.id}`}
                  className="group flex h-full flex-col justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-colors hover:border-accent/50 hover:bg-surface-2 focus-visible:border-accent"
                >
                  <span>
                    <span className="font-mono text-xs text-accent">{section.id}</span>
                    <span className="mt-3 block text-lg font-semibold tracking-tight text-body group-hover:text-accent">
                      {section.label}
                    </span>
                    <span className="mt-1.5 block text-sm leading-6 text-muted">
                      {section.blurb}
                    </span>
                  </span>
                  <span className="font-mono text-xs text-muted/70">
                    {pagesIn(section.id).length} pages →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </MotionReveal>
      </section>

      <section className="overflow-hidden border-y border-line/70 bg-surface/40 py-6">
        <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2">
          {['local noon', 'clear day', 'dry spell', 'self-consumption'].map((phrase) => (
            <span key={phrase} className="text-xs tracking-[0.24em] text-muted/70 uppercase">
              {phrase}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="rounded-2xl border border-line bg-surface p-7">
            <p className="text-xs tracking-[0.16em] text-accent uppercase">Time, twice</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-body">
              Local time is ambiguous once a year
            </h2>
            <p className="mt-3 text-muted">
              Every row carries an ISO 8601 local timestamp with its offset and the same instant
              in UTC. The local column is what a reader wants; the UTC column is what survives
              the repeated hour when daylight saving ends.
            </p>
            <Link to="/docs/time-model" className="mt-4 inline-block text-sm text-accent underline decoration-accent/30 underline-offset-4">
              Read the time model
            </Link>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-7">
            <p className="text-xs tracking-[0.16em] text-secondary uppercase">The scrub is a file</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-body">
              What was removed is recorded, not reconstructed
            </h2>
            <p className="mt-3 text-muted">
              The exporter selects a fixed whitelist and re-scans its own output for the excluded
              values before publishing. The manifest names the categories and the residual risk;
              it never repeats the removed values.
            </p>
            <Link to="/docs/privacy" className="mt-4 inline-block text-sm text-accent underline decoration-accent/30 underline-offset-4">
              Read the privacy contract
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8">
        <p className="text-sm text-muted">
          {PAGES.length} pages, one build, one guard.{' '}
          <Link to="/docs/for-agents" className="text-accent underline decoration-accent/30 underline-offset-4">
            The agent contract
          </Link>{' '}
          starts at <span className="font-mono">/llms.txt</span>. Eight views of the data are on{' '}
          <Link to="/charts" className="text-accent underline decoration-accent/30 underline-offset-4">
            the charts page
          </Link>. The record also ships as a{' '}
          <Link to="/universes" className="text-accent underline decoration-accent/30 underline-offset-4">
            local-time universe
          </Link>.
        </p>
      </section>
    </>
  )
}
