import { NavLink } from 'react-router-dom'
import { SECTIONS } from '../lib/content'
import { useEra } from '../lib/era'
import { useFileView } from '../lib/fileview'
import { MotionToggle } from './MotionToggle'

const linkBase =
  'rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-body'
const linkActive = 'bg-surface-2 text-body'

export function SiteHeader() {
  const { era, setEra } = useEra()
  const { view, setView } = useFileView()

  return (
    <header className="sticky top-0 z-50 border-b border-line/80 bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-4 px-5 py-3 sm:px-8">
        <NavLink to="/" className="group flex items-center gap-2.5" aria-label="le.gume energy — home">
          <span className="relative grid h-7 w-7 place-items-center rounded-lg border border-line bg-surface">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="absolute -right-0.5 -bottom-0.5 h-1.5 w-1.5 rounded-full bg-secondary" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-body">
            le<span className="text-accent">.</span>gume
            <span className="ml-1 font-normal text-muted/70">energy</span>
          </span>
        </NavLink>

        <nav aria-label="Sections" className="ml-2 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto max-xl:order-3 max-xl:ml-0 max-xl:w-full max-xl:flex-none max-xl:border-t max-xl:border-line-soft max-xl:pt-2">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.id}
              to={`/${section.id}`}
              className={({ isActive }) => `${linkBase} shrink-0 ${isActive ? linkActive : ''}`}
            >
              {section.label}
            </NavLink>
          ))}
          <NavLink
            to="/charts"
            className={({ isActive }) => `${linkBase} shrink-0 ${isActive ? linkActive : ''}`}
          >
            Charts
          </NavLink>
          <NavLink
            to="/universes"
            className={({ isActive }) => `${linkBase} shrink-0 ${isActive ? linkActive : ''}`}
          >
            Universe
          </NavLink>
          <NavLink
            to="/design"
            className={({ isActive }) => `${linkBase} shrink-0 ${isActive ? linkActive : ''}`}
          >
            Design
          </NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden items-center gap-3 sm:flex">
            <MotionToggle />
            <a
              href="https://github.com/james-gibson/le.gume-energy"
              target="_blank"
              rel="noreferrer noopener"
              className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-body"
            >
              Source
            </a>
          </div>
          {/* The way back out of 1996, and out of the file, must exist at every width. */}
          <button
            type="button"
            onClick={() => setView(view === 'file' ? 'page' : 'file')}
            className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-body"
            title={view === 'file' ? 'Render the page' : 'Show the source file'}
          >
            {view === 'file' ? 'render' : 'file'}
          </button>
          <button
            type="button"
            onClick={() => setEra(era === 'retro' ? 'modern' : 'retro')}
            className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-accent/50 hover:text-body"
            title={era === 'retro' ? 'Restore modern rendering' : 'Render as HTML 2.0'}
          >
            {era === 'retro' ? '2026' : 'HTML 2.0'}
          </button>
        </div>
      </div>
    </header>
  )
}
