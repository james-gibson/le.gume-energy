---
title: Silverskin — a documentation site that ships itself
description: This site, described as an isotope: what it proves, what it costs, and what to take.
order: 2
updated: 2026-11-13
slots: none
presumes: node-22, tailwind-v4, silicon-ui, git, github-pages, no-server
tags: isotope, static, github-pages
seeds: isotopes, starter
---

# Silverskin — a documentation site that ships itself

This page is called **silverskin** — a whole pickled onion, one piece, self-contained. It is the
quietest isotope in the collection, and it is self-referential on purpose: the system described
here is the system serving it. If the description drifts, the site is wrong — which is the cheapest
possible test of a claim.

## What it proves

A documentation site can be owned outright, deploy on push, refuse to publish bad output, and
document itself — with eight runtime dependencies, no server, and every route prerendered to static
HTML.

It also proves the limits: no search, no versions, no CMS. Those are listed at the bottom, because
an isotope that hides its costs is an advertisement.

## The parts

| Part | What it is | Why it is that size |
| --- | --- | --- |
| Content tree | `src/content/<section>/<slug>.md` | The file path is the URL; no route table |
| Content model | one module: glob, frontmatter, order, headings | Everything derived reads one array |
| Data routes | `/charts` and `/universes`, both derived by a script | A picture is a build artifact, not a fetch |
| Prerender | every route rendered to a string, then shelled | The answer is in the initial HTML |
| Publish guard | named checks, ~490 lines | The gate between a build and the public |
| Deploy | one workflow: `npm ci && npm run build` → Pages | No release branch, no artifact store |
| Components | Silicon UI, vendored as source under `src/components/silicon-ui` | The site owns the copy, not a version range |
| Agent entry | generated `llms.txt` and `ai-catalog.json` | An agent can take the site and go |

## What it costs

- **The writing.** Every page here is an argument; no framework supplies one. The parts above are
  the cheap half.
- **A build you must read once.** The guard is only worth something if you know what it refuses.
- **No search.** Correct at nineteen pages; wrong at two hundred. The day it becomes wrong, a
  client-side index will not save you.
- **No versions.** The site publishes one record at a time. A second edition is a second repository.
- **A subpath trap.** Project sites live under `/<repo>/`; the base path is configuration, and the
  guard is the only thing enforcing it.
- **A vendored component tree.** Copying source removes a version range and adds an upgrade you do
  yourself. Re-running the registry add overwrites local edits; commit before you do.

## Take this, not that

**Take:**
- The derived navigation. It removes an entire class of drift.
- The guard. Any public site without one is trusting the last build.
- The prerender. One render loop removes every 404-on-reload and every empty first paint.
- The generated `llms.txt`. It costs one function and makes the site legible to machines.

**Leave:**
- The palette and the motion ladder. They are taste, and taste should be local.
- The five-section shape, if your content is one long guide.
- The custom data routes. They are the reason this site is about one dataset rather than docs in
  general.

## What would break it

- **Adding MDX for one interactive page, then six.** Content stops being portable and the site loses
  the property that made it liftable.
- **Adding a CMS "to let writers publish".** The moment publishing needs a service account, the site
  has an operator, and the operator is a dependency.
- **Weakening the guard for one release.** Every claim on this site rests on that check refusing.
- **Letting a page fetch the data at runtime.** The static HTML would answer with a spinner, and the
  agent contract would be a promise rather than a fact.

## Read the source

- Live: [/](/)
- Repository: [james-gibson/le.gume-energy](https://github.com/james-gibson/le.gume-energy)
- The operating contract: [/docs/for-agents](/docs/for-agents)
- The record and its limits: [/docs/overview](/docs/overview)
