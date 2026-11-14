/**
 * Isotopes as compounds, named after pickles.
 *
 * An isotope is a named procedure with slots — the parameters an agent cannot
 * guess. Its identity is the name, never a position: "cornichon" survives
 * reordering, insertion and deletion; "02" does not. The names come from the
 * pickle shelf (pickled onions and gherkins), and once a name is published it is
 * permanent, because it is in URLs and in QR codes.
 *
 * A shortcut is the isotope's address plus whatever slots are already bound:
 *
 *   https://james-gibson.github.io/le.gume-energy/isotopes/cornichon/?window=monthly
 *
 * The empty values are the questions the agent asks. No resolver service: the
 * URL is the address, the page is the expansion.
 */

export type IsotopeSlot = {
  /** query-string key used in a shortcut */
  name: string
  /** the question the agent should ask when this slot is unbound */
  question: string
  example?: string
}

export type Isotope = {
  /** the pickle. Permanent once published — it is the slug and the URL segment. */
  name: string
  title: string
  summary: string
  slots: IsotopeSlot[]
  /** what the isotope assumes about its runtime and permissions — announced, not inferred */
  presumes: string[]
}

export const SITE_ORIGIN = 'https://james-gibson.github.io/le.gume-energy'

export const ISOTOPES: Isotope[] = [
  {
    name: 'silverskin',
    title: 'Silverskin — a documentation site that ships itself',
    summary: 'Content as files, a derived navigation, a publish guard, and a deploy on push.',
    slots: [],
    presumes: ['node-22', 'tailwind-v4', 'git', 'github-pages', 'no-server'],
  },
  {
    name: 'cornichon',
    title: 'Cornichon — a chart that is a file, not a library',
    summary: 'A build-time summary derived from the published CSV, rendered as SVG with no chart runtime.',
    slots: [
      { name: 'data', question: 'Which published file should the summary read?', example: 'solar-production-daily.csv' },
      { name: 'metric', question: 'Which column should become the picture?', example: 'residual' },
      { name: 'window', question: 'Which range should it cover?', example: 'monthly' },
    ],
    presumes: ['node-22', 'csv', 'svg', 'no-chart-library'],
  },
]

export function isotopeShortcut(
  isotope: Isotope,
  bound: Partial<Record<string, string>> = {},
): string {
  const params = new URLSearchParams()
  for (const slot of isotope.slots) params.set(slot.name, bound[slot.name] ?? '')
  const query = params.toString()
  return `${SITE_ORIGIN}/isotopes/${isotope.name}/${query ? `?${query}` : ''}`
}

/** Slots the shortcut leaves for the agent to ask about. */
export function unboundSlots(
  isotope: Isotope,
  bound: Partial<Record<string, string>> = {},
): IsotopeSlot[] {
  return isotope.slots.filter((slot) => !bound[slot.name])
}
