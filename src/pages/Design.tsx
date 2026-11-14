import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AgentHandoff, SITE_HANDOFF } from '../components/AgentHandoff'
import { MotionToggle } from '../components/MotionToggle'
import { AnimatedCounter } from '../components/silicon-ui/animated-counter/animated-counter'
import { Badge } from '../components/silicon-ui/badge/badge'
import { ButtonLink } from '../components/silicon-ui/button-link/button-link'
import { CopyButton } from '../components/silicon-ui/copy-button/copy-button'
import { ISOTOPES, isotopeShortcut, unboundSlots } from '../lib/isotopes'
import { MotionReveal, useMotion } from '../lib/motion'
import palette from '../lib/palette.json'
import { usePageMeta } from '../lib/usePageMeta'

const { tokens } = palette as { tokens: { name: string; hex: string; role: string }[] }

function Sample({
  title,
  source,
  props,
  note,
  children,
}: {
  title: string
  source: string
  props: string
  note: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-t border-line-soft py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-body">{title}</h2>
        <p className="font-mono text-xs text-muted/70">{source}</p>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{note}</p>
      <p className="mt-3 font-mono text-xs text-accent/80">{props}</p>
      <div className="mt-6 rounded-2xl border border-line bg-surface/60 p-6 sm:p-8">{children}</div>
    </section>
  )
}

export function Design() {
  usePageMeta(
    'Design',
    'The live design system: every component this site ships, shown with the props it actually uses.',
  )

  const { mode, auto } = useMotion()
  const still = mode === 'still'

  const isotope = ISOTOPES.find((candidate) => candidate.name === 'cornichon')!
  const bound: Record<string, string> = { window: 'monthly' }
  const shortcut = isotopeShortcut(isotope, bound)
  const pending = unboundSlots(isotope, bound)

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-xs tracking-[0.18em] text-accent uppercase">Design</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-body sm:text-5xl">
        The design system is this page.
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
        Nothing below is a screenshot. Each sample is the same import the rest of the site uses,
        with the same props, rendered by the same bundle. If a sample stops working, the site is
        wrong — which is the point of keeping the documentation and the demo in one file tree.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-muted/80">
        Why the page is shaped this way, and what each choice gives up, is written down in{' '}
        <Link
          to="/docs/overview"
          className="text-accent underline decoration-accent/30 underline-offset-4"
        >
          The record
        </Link>
        .
      </p>

      <p className="mt-3 max-w-2xl text-sm text-muted/80">
        Components come from{' '}
        <a
          href="https://ui.teamofsilicons.com"
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent underline decoration-accent/30 underline-offset-4"
        >
          Silicon UI
        </a>
        , installed with the shadcn CLI and vendored as source under{' '}
        <code className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.85em] text-accent">
          src/components/silicon-ui
        </code>
        . The site owns the copy, not a version range. Colours come from the foundation tokens —
        a utility here is an alias for one of them, never a second palette.
      </p>

      <div className="mt-8 rounded-xl border border-line bg-surface p-4 text-sm text-muted">
        Motion budget: <span className="font-mono text-body">{mode}</span> (the ladder would choose{' '}
        <span className="font-mono text-body">{auto}</span> on this page). Silicon UI respects{' '}
        <code className="font-mono text-accent">prefers-reduced-motion</code> on its own; the ladder
        is a second, in-page switch, and the samples below obey both.
      </div>

      <div className="mt-12">
        <h2 className="text-xs tracking-[0.18em] text-muted uppercase">Palette</h2>
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tokens.map((token) => (
            <li key={token.name} className="rounded-xl border border-line bg-surface p-3">
              <span
                className="block h-10 w-full rounded-lg border border-line-soft"
                style={{ backgroundColor: token.hex }}
              />
              <span className="mt-2 block font-mono text-xs text-body">{token.name}</span>
              <span className="block font-mono text-[11px] text-muted/70">{token.hex}</span>
              <span className="mt-1 block text-[11px] leading-4 text-muted/70">{token.role}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-14">
        <Sample
          title="ButtonLink"
          source="silicon-ui · button-link"
          props="href · variant · size"
          note={
            <>
              Every call to action on the site. It takes an address, not a handler, so the link is
              in the prerendered HTML and survives a hard reload — and it reads as{' '}
              <code className="font-mono text-accent">primary</code>,{' '}
              <code className="font-mono text-accent">secondary</code> or{' '}
              <code className="font-mono text-accent">ghost</code> without a second component.
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-4">
            <ButtonLink href="#sample" variant="primary">
              Read the record
            </ButtonLink>
            <ButtonLink href="#sample" variant="secondary">
              Download the files
            </ButtonLink>
            <ButtonLink href="#sample" variant="ghost" size="sm">
              Ghost, small
            </ButtonLink>
          </div>
        </Sample>

        <Sample
          title="CopyButton"
          source="silicon-ui · copy-button"
          props="value · label · iconOnly · variant"
          note={
            <>
              Used for every command on the site. It writes to the clipboard and then says so —
              no toast, no state to wire up at the call site.
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-4">
            <CopyButton value="npm run build" label="Copy build" />
            <CopyButton value="npm run guard" label="Copy guard" variant="plain" />
            <CopyButton value="npm run charts" label="Copy charts" iconOnly />
          </div>
        </Sample>

        <Sample
          title="Badge"
          source="silicon-ui · badge"
          props="tone · size · icon"
          note={
            <>
              The date range on the homepage and the counts on a section index. A tone is semantic
              — success, info, warning, danger — not a colour name, so a badge cannot drift from
              the meaning it carries.
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge icon={<span className="h-1.5 w-1.5 rounded-full bg-accent" />}>
              2023-08-14 → 2026-11-13
            </Badge>
            <Badge tone="success" size="sm">
              guard passing
            </Badge>
            <Badge tone="info" size="sm">
              manifest verified
            </Badge>
            <Badge tone="warning" size="sm">
              sparse intervals
            </Badge>
            <Badge tone="danger" size="sm">
              identifier found
            </Badge>
          </div>
        </Sample>

        <Sample
          title="SegmentedControl"
          source="silicon-ui · segmented-control"
          props="options · value · onValueChange · label · size"
          note={
            <>
              The motion ladder in the header, mounted here unchanged. The selected segment carries
              a spring, the arrow keys move the selection, and the control scrolls itself when the
              labels outgrow the space.
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-4">
            <MotionToggle />
            <span className="text-sm text-muted">
              A control for the design system should be part of the design system.
            </span>
          </div>
        </Sample>

        <Sample
          title="AnimatedCounter"
          source="silicon-ui · animated-counter"
          props="value · label · animateOnView · suffix"
          note={
            <>
              The homepage statistics. It rolls up from zero the first time it is seen, and the
              site renders the plain number instead when the ladder says still.
            </>
          }
        >
          <div className="flex flex-wrap gap-10">
            <p className="font-mono text-3xl text-body">
              {still ? '1,188' : <AnimatedCounter value={1188} animateOnView />}
              <span className="ml-2 text-sm text-muted">days of production</span>
            </p>
            <p className="font-mono text-3xl text-body">
              {still ? '61,015' : <AnimatedCounter value={61015} animateOnView />}
              <span className="ml-2 text-sm text-muted">interval rows</span>
            </p>
          </div>
        </Sample>

        <Sample
          title="MotionReveal"
          source="lib/motion · site-native"
          props="delay · className"
          note={
            <>
              Not a library component: Silicon UI reveals type, and the site needs a wrapper for
              layout. Timing comes from Silicon's motion tokens, the ladder decides whether it
              renders at all, and it fades up once.
            </>
          }
        >
          <MotionReveal delay={80} className="rounded-xl border border-line bg-surface p-5">
            <p className="text-sm text-muted">
              This block faded up once, when it entered the viewport, and will not animate again.
            </p>
          </MotionReveal>
        </Sample>
      </div>

      <div className="mt-14 space-y-6">
        <AgentHandoff
          id="handoff"
          instructions={SITE_HANDOFF}
          title="Hand this site to an agent"
          note="The code carries the same instructions printed beside it: where the contract lives, and the three commands that prove the site still works."
        />

        <div>
          <p className="text-xs tracking-[0.16em] text-secondary uppercase">Compound shortcut</p>
          <h2 className="mt-2 text-xl font-semibold text-body">
            …or hand over an isotope, with its questions
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-6 text-muted">
            Isotope cornichon cannot be applied without three decisions. The shortcut binds the one
            that is already made and leaves the others empty, so the agent has to ask — a short code
            that expands into the page, the prompt and the questions.
          </p>

          <ul className="mt-4 grid gap-2 sm:grid-cols-3">
            {isotope.slots.map((slot) => (
              <li key={slot.name} className="rounded-lg border border-line-soft bg-surface p-3">
                <span className="font-mono text-xs text-accent">{slot.name}</span>
                <span className="mt-1 block text-xs leading-5 text-muted">{slot.question}</span>
                {bound[slot.name] ? (
                  <span className="mt-2 block font-mono text-[11px] text-body/70">
                    bound: {bound[slot.name]}
                  </span>
                ) : (
                  <span className="mt-2 block font-mono text-[11px] text-secondary">agent asks</span>
                )}
              </li>
            ))}
          </ul>

          <p className="mt-3 font-mono text-xs text-muted/80">
            presumes: {isotope.presumes.join(', ')}
          </p>
        </div>

        <AgentHandoff
          id="isotope-02"
          instructions={shortcut}
          title={isotope.title}
          note={`Compound payload: isotope ${isotope.name} with window=monthly bound, data and metric empty. An agent fetches the page, reads its Agent prompt, and asks for ${pending.map((s) => s.name).join(' and ')} before writing anything.`}
        />
      </div>
    </div>
  )
}
