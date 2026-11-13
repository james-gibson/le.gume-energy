import { PAGES, type Page } from './content'

/**
 * Seeds, on a scale.
 *
 * A seed is a body of knowledge with three things stated up front: who it is
 * for, what it assumes, and where it starts. The scale adds the fourth: **how
 * much of the machine the audience is willing to touch**.
 *
 * Membership is derived from `seeds:` in page frontmatter, so a seed's contents
 * cannot drift from the pages that declare them. A page may belong to several
 * seeds: that is what "shared" means here.
 */

export type Seed = {
  /** the slug of its page in /seeds, and the id used in frontmatter */
  id: string
  title: string
  /** who this is written for, in one line */
  audience: string
  /** what they must already know — "nothing" is a valid and useful answer */
  assumes: string
  /** three claims the seed makes good on */
  teaches: string[]
  /** the route a newcomer should open first */
  entry: string
  /** position on the readiness scale; absent for lateral seeds */
  rung?: number
  /** what this audience does with the machine */
  touches: string
  /** register, not readiness — sits alongside every rung */
  lateral?: boolean
  /** a site-scoped seed is a view of the whole shelf, not a subset of it */
  scope?: 'site' | 'entrance'
}

export const SCALE: Record<number, { label: string; touches: string }> = {
  [-3]: {
    label: 'No script',
    touches: 'reads a document; the application never loads',
  },
  [-2]: {
    label: 'No stylesheet',
    touches: 'reads a document; the design system never arrives',
  },
  [-1]: {
    label: 'Just a file',
    touches: 'wants the file itself; the page is optional',
  },
  0: {
    label: 'Just a website',
    touches: 'wants a website and a bill; will not open a terminal',
  },
  1: { label: 'Understand', touches: 'reads concepts; will not deploy anything' },
  2: { label: 'Learn', touches: 'runs it locally and breaks it on purpose' },
  3: { label: 'Operate', touches: 'delegates the running; wants it repeatable' },
  4: { label: 'Package', touches: 'designs systems other people will operate' },
}

export const SEEDS: Seed[] = [
  {
    id: 'homeowner',
    title: 'The homeowner',
    audience: 'Someone who owns the array and wants to know whether it is losing output.',
    assumes: 'Nothing. The monthly numbers are the entry point.',
    teaches: [
      'what a weather-normalized residual is, and why raw kWh lies across seasons',
      'which gaps are snow, outages, rain recovery or a soiling candidate',
      'what the utility data can and cannot tell you about self-consumption',
    ],
    entry: '/docs/overview',
    rung: 0,
    touches: 'reads cost and output; will not open a terminal',
  },
  {
    id: 'starter',
    title: 'The operator',
    audience: 'An engineer who wants to run the export and keep the time model honest.',
    assumes: 'Git, Python 3.9+, and SQLite files from the two collectors.',
    teaches: [
      'how UTC, the site zone and the DST repeat fit into one row',
      'why the exporter recomputes local time instead of trusting the collector',
      'how the publish guard refuses an export that leaks an identifier',
    ],
    entry: '/docs/quickstart',
    rung: 2,
    touches: 'runs it locally and breaks it on purpose',
  },
  {
    id: 'agent-operations',
    title: 'Agent operations',
    audience: 'An LLM agent, or the person who points one at this repository.',
    assumes: 'Node 22, a shell, and the willingness to read a guard script.',
    teaches: [
      'where the machine entry is, and what it promises',
      'the build, smoke and guard loop, and what "done" means',
      'which files are safe to quote and which columns carry an instant',
    ],
    entry: '/docs/for-agents',
    rung: 3,
    touches: 'delegates the running; wants it repeatable',
  },
  {
    id: 'isotopes',
    title: 'Isotopes',
    audience: 'Anyone who keeps re-explaining a setup they only do occasionally.',
    assumes: 'You have written a runbook, or hated one.',
    teaches: [
      'the four tests that make a system an isotope',
      'why names beat numbers, and what a permanent name costs',
      'slots, compounds, and a QR code that expands into instructions',
    ],
    entry: '/isotopes/what-is-an-isotope',
    rung: 4,
    touches: 'designs systems other people will operate',
  },
]

export function getSeed(id: string): Seed | undefined {
  return SEEDS.find((seed) => seed.id === id)
}

/** Pages that declare this seed, in section order. */
export function seedMembers(id: string): Page[] {
  const seed = getSeed(id)
  if (seed?.scope === 'site') return PAGES.filter((page) => page.section !== 'seeds')
  return PAGES.filter((page) => page.seeds.includes(id))
}

/** Seeds a page belongs to. */
export function seedsOf(page: Page): Seed[] {
  return page.seeds.map(getSeed).filter((seed): seed is Seed => !!seed)
}

/** Seeds that sit alongside every rung rather than on one. */
export function lateralSeeds(): Seed[] {
  return SEEDS.filter((seed) => seed.lateral)
}

/** The rungs, with the seeds that sit on each. */
export function scale(): { level: number; label: string; touches: string; seeds: Seed[] }[] {
  return Object.entries(SCALE)
    .map(([level, step]) => ({
      level: Number(level),
      ...step,
      seeds: SEEDS.filter((seed) => seed.rung === Number(level)),
    }))
    .sort((a, b) => a.level - b.level)
}
