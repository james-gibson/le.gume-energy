import { Link, useNavigate } from 'react-router-dom'
import { BentoGrid, BentoGridCard, Button, CopyButton, Marquee } from 'fancy-ui-react'
import { PAGES, SECTIONS, pagesIn } from '../lib/content'
import { MotionBeam, MotionReveal, MotionTicker, useMotion } from '../lib/motion'
import { usePageMeta } from '../lib/usePageMeta'

const base = import.meta.env.BASE_URL
const DOWNLOAD =
  'curl -O https://james-gibson.github.io/le.gume-energy/data/solar-production-daily.csv'

export function Home() {
  usePageMeta(undefined, 'A non-identifying record of a home solar system: production, weather, utility usage and the events that explain the gaps, in local time.')
  const navigate = useNavigate()
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
        <div className="relative mx-auto grid w-full max-w-6xl gap-14 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <MotionReveal preset="fade-up">
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs tracking-wide text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-pulse" />
                2023-08-14 → 2026-11-13 · America/Denver
              </p>
            </MotionReveal>

            <MotionReveal preset="fade-up" delay={60}>
              <h1 className="mt-6 text-4xl leading-[1.05] font-semibold tracking-tight text-cream sm:text-6xl">
                A home solar record,
                <br />
                in <span className="text-pulse">local time</span>.
              </h1>
            </MotionReveal>

            <MotionReveal preset="fade-up" delay={120}>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
                Production, weather, utility usage and the events that explain the gaps.
                Published as eleven CSV files and a manifest, with the site, account,
                address, coordinates and serials removed.
              </p>
            </MotionReveal>

            <MotionReveal preset="fade-up" delay={180}>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button href={`${base}docs/overview`} variant="primary">
                  Read the record
                </Button>
                <Button variant="secondary" onClick={() => navigate('/guides/download')}>
                  Download the files
                </Button>
              </div>
            </MotionReveal>

            <p className="mt-6 text-xs text-muted/70">
              Pseudonymous, not anonymous. The manifest says what was removed and what still
              narrows the population.
            </p>
          </div>

          <MotionReveal preset="fade-up" delay={140}>
            <div className="relative overflow-hidden rounded-2xl border border-line bg-surface/90 p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)]">
              <MotionBeam colorFrom="#ff2d95" colorTo="#ffc2dd" duration={11} size={220} glow={0.5} />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs tracking-[0.16em] text-muted uppercase">One file</p>
                <CopyButton value={DOWNLOAD} label="Copy" copiedLabel="Copied" size="sm" />
              </div>
              <pre className="mt-4 overflow-x-auto rounded-xl border border-line-soft bg-[#0c0a0c] p-4 font-mono text-[13px] leading-6 text-cream/90">
                <code>{DOWNLOAD}</code>
              </pre>
              <ul className="mt-5 space-y-3 text-sm text-muted">
                <li className="flex gap-3">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-pulse" />
                  Every instant carries both local time and UTC.
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-pulse" />
                  Weather-normalized residuals separate snow from soiling.
                </li>
                <li className="flex gap-3">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-violet" />
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
              <p className="font-mono text-3xl font-semibold text-cream sm:text-4xl">
                <MotionTicker value={fact.v} />
              </p>
              <p className="mt-1 text-xs tracking-[0.14em] text-muted uppercase">{fact.k}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-cream sm:text-3xl">
              Every section, one contract
            </h2>
            <p className="mt-2 max-w-xl text-muted">
              Each section is a folder. Each page is a file. The navigation builds itself from
              both, which is why the dataset description cannot drift from the dataset.
            </p>
          </div>
          <Link
            to="/docs/overview"
            className="text-sm text-pulse underline decoration-pulse/30 underline-offset-4 hover:decoration-pulse"
          >
            Start with the overview
          </Link>
        </div>

        <MotionReveal preset="fade-up" className="mt-8">
          <BentoGrid accent="#ff2d95" className="w-full" reveal={!still}>
            {SECTIONS.map((section) => (
              <BentoGridCard
                key={section.id}
                name={section.label}
                description={section.blurb}
                href={`${base}${section.id}`}
                cta={`${pagesIn(section.id).length} pages`}
                icon={<span className="font-mono text-xs text-pulse">{section.id}</span>}
              />
            ))}
          </BentoGrid>
        </MotionReveal>
      </section>

      <section className="overflow-hidden border-y border-line/70 bg-surface/40 py-6">
        {still ? (
          <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2">
            {['local noon', 'clear day', 'dry spell', 'self-consumption'].map((phrase) => (
              <span key={phrase} className="text-xs tracking-[0.24em] text-muted/70 uppercase">
                {phrase}
              </span>
            ))}
          </div>
        ) : (
          <Marquee repeat={3} speed={0.8} fade pauseOnHover>
            {['local noon', 'clear day', 'dry spell', 'self-consumption'].map((phrase) => (
              <span key={phrase} className="mx-7 text-xs tracking-[0.24em] text-muted/70 uppercase">
                {phrase}
              </span>
            ))}
          </Marquee>
        )}
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-2xl border border-line bg-surface p-7">
            <p className="text-xs tracking-[0.16em] text-pulse uppercase">Time, twice</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-cream">
              Local time is ambiguous once a year
            </h2>
            <p className="mt-3 text-muted">
              Every row carries an ISO 8601 local timestamp with its offset and the same instant
              in UTC. The local column is what a reader wants; the UTC column is what survives
              the repeated hour when daylight saving ends.
            </p>
            <Link to="/docs/time-model" className="mt-4 inline-block text-sm text-pulse underline decoration-pulse/30 underline-offset-4">
              Read the time model
            </Link>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-7">
            <p className="text-xs tracking-[0.16em] text-violet uppercase">The scrub is a file</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-cream">
              What was removed is recorded, not reconstructed
            </h2>
            <p className="mt-3 text-muted">
              The exporter selects a fixed whitelist and re-scans its own output for the excluded
              values before publishing. The manifest names the categories and the residual risk;
              it never repeats the removed values.
            </p>
            <Link to="/docs/privacy" className="mt-4 inline-block text-sm text-pulse underline decoration-pulse/30 underline-offset-4">
              Read the privacy contract
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8">
        <p className="text-sm text-muted">
          {PAGES.length} pages, one build, one guard.{' '}
          <Link to="/docs/for-agents" className="text-pulse underline decoration-pulse/30 underline-offset-4">
            The agent contract
          </Link>{' '}
          starts at <span className="font-mono">/llms.txt</span>. Four views of the data are on{' '}
          <Link to="/charts" className="text-pulse underline decoration-pulse/30 underline-offset-4">
            the charts page
          </Link>.
        </p>
      </section>
    </>
  )
}
