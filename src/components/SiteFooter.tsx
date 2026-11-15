import { Link } from 'react-router-dom'
import { AgentCta } from './AgentCta'
import { PAGES, SECTIONS } from '../lib/content'

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line/80 bg-surface/40">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="text-sm font-semibold text-body">
            le<span className="text-accent">.</span>gume
          </p>
          <p className="mt-2 max-w-xs text-sm leading-6 text-muted">
            A public, non-identifying record of a home solar system: production,
            weather and utility usage in local time.
          </p>
          <p className="mt-4 font-mono text-xs text-muted">{PAGES.length} pages · {SECTIONS.length} sections · 1 build</p>
        </div>

        {SECTIONS.slice(0, 3).map((section) => (
          <div key={section.id}>
            <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{section.label}</p>
            <ul className="mt-3 space-y-2">
              {PAGES.filter((p) => p.section === section.id)
                .slice(0, 4)
                .map((page) => (
                  <li key={page.path}>
                    <Link
                      to={`/${page.section}/${page.slug}`}
                      className="text-sm text-muted transition-colors hover:text-body"
                    >
                      {page.title}
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      </div>

      <AgentCta />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 border-t border-line-soft px-5 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          Built with React, Vite and Tailwind. Motion by{' '}
          <a
            href="https://ui.teamofsilicons.com"
            target="_blank"
            rel="noreferrer noopener"
            className="text-muted underline decoration-line underline-offset-4 hover:text-body"
          >
            Silicon UI
          </a>
          .
        </p>
        <p className="font-mono">
          <a
            href="https://github.com/james-gibson/le.gume-energy"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-body"
          >
            james-gibson/le.gume-energy
          </a>{' '}
          · AGPL-3.0 ·{' '}
          <Link to="/design#handoff" className="hover:text-body">
            take it with you
          </Link>
        </p>
      </div>
    </footer>
  )
}
