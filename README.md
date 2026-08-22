# HKUST SIS Course Planner

A single-page React course planner for HKUST(GZ): search courses, drag sections onto a
timetable, auto-generate conflict-free schedules, inspect prerequisite graphs, and push
your timetable to the SISN / KLMS course cart.

This repository contains a **modular TypeScript source tree** (`src/`) that is compiled
and obfuscated into a **single-file app** (`dist/index.html`) by `npm run build`.
The old monolithic `index.html` at the repo root is kept as a frozen legacy fallback —
do not edit it; `src/` is the source of truth.

---

## Features

- **Search** by course code / name / description, with filters (UG / PG / TPG / RPG,
  subject, credits, day, time slot, instructor, availability, conflicts, sections,
  tutorial/lab, has-prerequisite).
- **Course detail** with sections grouped by component (Lecture / Tutorial / Lab), class
  times, rooms, instructors (hover for profile popup) and prerequisite / corequisite chips.
- **Timetable grid** (Mon–Fri, 08:00–21:00) with drag-and-drop of sections, live conflict
  detection (time / room / instructor), hover tooltips, right-click section switching,
  left-drag to block periods, right-drag to filter generated plans, and PNG export with
  full course details.
- **Cross-section dragging**: when enabled, drag a course from search or from the grid and
  drop it on any official section time; overlays show each section in a different colour.
- **Auto Scheduler**: Time-first (pick clock times) and Course-first (pick a class time or
  *All sections*) modes, evenness / walking-distance ranking, day-window filters, blocked
  periods, "Load current", and unlimited candidate plans (shown with a filter panel).
- **Dependency graph**: a real tokenizer + AST parser for prerequisite text (no naive
  `includes()` matching), rendered with React Flow (draggable nodes, zoom, click-to-jump),
  with an SVG fallback when React Flow is unavailable.
- **Local persistence**: schedule, planner settings, blocked/filter periods, and cross-drag
  toggle are saved to `localStorage`; export/import a JSON backup.
- **API loading**: loads catalog (`data`), SISN and KLMS courses through a Cloudflare
  Workers proxy; configurable URL, TOKEN and TERM_ID (e.g. `2610` = 2026-27 Fall).
- **Add to system cart**: posts the timetable's section IDs to the SISN / KLMS course cart
  through a second Workers endpoint. Courses present in both systems count as SIS but keep
  their KLMS section data and are added via the KLMS cart.

---

## Project layout

```
src/
  main.tsx                 Entry point: ReactDOM.createRoot(...).render(<App />)
  globals.d.ts             window.React / ReactDOM / ReactFlow type declarations
  types.ts                 Core model types (Course, Section, Meeting, Entry, AstNode, ...)
  constants.ts             Grid constants, day names, storage keys, code regex
  utils.ts                 normCode / time formatting / colours / uid / summaryOf
  state.ts                 Planner + API config persistence (localStorage), hydrateSchedule
  styles.css               All app CSS (inlined into the build)
  data/
    catalog.ts             buildCatalog(raw data.json records)
    normalizer.ts          courses.json / courses_klms.json -> app model, mergeCourses
    api.ts                 Workers API query (fetchApiPayload) and add-to-cart (addToSystemCart)
  schedule/
    sections.ts            Section grouping, companion pairing, courseBundles, credit summary
    conflict.ts            Time / room / instructor overlap detection
    drag.ts                Calendar pointer maths + drag-target overlays
    scheduler.ts           Backtracking schedule generator + evenness/distance scoring
  deps/
    parser.ts              Prerequisite tokenizer + recursive-descent AST parser
    graph.ts               Dependency AST -> React Flow node/edge layout
  ui/
    app.tsx                App shell, header, data loading, drag state, save/export
    load.tsx               Loading / manual file-load screens
    search.tsx             Search, filters, course cards, course detail, section cards
    timetable.tsx          Timetable grid, drag preview, export image
    scheduler-tab.tsx      Auto Scheduler UI
    deps-tab.tsx           Dependency graph tab
    deps-graph.tsx         React Flow components (+ SVG fallback)
    cart.tsx               Floating cart, toasts
    api-modal.tsx          API configuration modal

build/
  template.html            HTML shell used by the build (CDN scripts + placeholders)

scripts/
  build.mjs                The build pipeline (see below)
```

---

## Data sources

| File / API type | Contents |
| --- | --- |
| `courses.json` | SISN course sections (decrypted payload of `pageCourseSupermarketCourse`) |
| `data.json` | Catalog: descriptions, prerequisites, corequisites, equivalents |
| `courses_klms.json` | KLMS sections (PE / general-education courses), optional |
| API `data` | Catalog from `pcc.hkust-gz.edu.cn` via the Workers proxy |
| API `sisn` | SISN sections via the Workers proxy |
| API `klms` | KLMS sections via the Workers proxy |

Opening the app over HTTP auto-loads `courses.json` / `data.json` / `courses_klms.json`
from the same folder. Opening it via `file://` shows the manual file picker instead.
The header has three extra load buttons for replacing any of the two custom JSON datasets.

---

## Running

### Pre-built single file

```bash
npm run build        # -> dist/index.html (minified + obfuscated)
```

Open `dist/index.html` in a browser. It still needs the internet for the React /
React-DOM / React-Flow CDN scripts (the same CDNs the legacy `index.html` uses).
Over HTTP it auto-loads the three JSON files; over `file://` use the manual loader.

### Development

```bash
npm install          # typescript, esbuild, javascript-obfuscator, @types/react
npm run typecheck    # tsc --noEmit only
npm run build:dev    # dist/index.html with an unminified, unobfuscated bundle
```

`dist/index.html` is the single-file output of both build modes; the difference is only
the embedded JavaScript.

### GitHub Pages

The repository includes a GitHub Actions workflow (`.github/workflows/pages.yml`) that
on every push to `main` (or via manual `workflow_dispatch`) runs
`npm ci` → `npm run typecheck` → `npm run build` and publishes `dist/` to GitHub Pages.

The build copies `courses.json`, `data.json` and `courses_klms.json` into `dist/`, so the
published site auto-loads the datasets the same way as a local HTTP server.

To enable it, in the GitHub repo settings select
**Settings → Pages → Build and deployment → Source: GitHub Actions** once. The workflow
needs `package-lock.json` (committed) so `npm ci` installs reproducibly.

---

## Build pipeline

`node scripts/build.mjs` (also invoked via `npm run build`):

1. **TypeScript check** — `tsc --noEmit` type-checks `src/` against `tsconfig.json`
   (`jsx: react-jsx`, `strict: false`, no emit).
2. **Bundle** — `esbuild` bundles `src/main.tsx` into one IIFE.
   - JSX is compiled with the classic factory (`window.React.createElement`,
     `window.React.Fragment`), so the bundle keeps using the CDN UMD globals — no
     bundling of React itself, matching the original app's runtime architecture.
   - Prod build is minified; dev build (`--dev`) is not.
3. **Obfuscate** (prod only) — `javascript-obfuscator` with compact output, hex
   identifier names and string-array encoding (`--self-defending false` so the page
   stays fast and avoids anti-debug traps).
4. **Assemble** — injects `src/styles.css` and the bundle into `build/template.html`
   and writes the single-file `dist/index.html`. CDN script tags (React, React-DOM,
   `@xyflow/react`) are kept; Babel-in-browser is no longer needed at runtime.

The build requires `node_modules`; run `npm install` first.

---

## Manual verification checklist

The project is verified by hand (no automated test suite by design). After a rebuild,
check at least:

1. Load data: HTTP auto-load and `file://` manual load; the three header load buttons;
   the API modal (URL / TOKEN / TERM) and the auto-load-on-startup with a token.
2. Search + filters (UG/PG chips, subject, credits, day, time, instructor).
3. Timetable: drag a section, watch the preview + conflict overlay, drop it; hover tooltip;
   right-click a block to switch sections; left-drag block / right-drag filter periods.
4. Cross-section dragging toggle: drag a course from search onto a section time; each
   section overlay gets a different tint; overlapping overlays split vertically.
5. Auto Scheduler: Time-first and Course-first modes, All sections, ranking toggles,
   Load current, day-window filters, apply a plan (should add/replace only the requested
   courses), Generate with KLMS courses present.
6. Dependency graph: parse `(COMP1021 OR COMP1022) AND MATH1013`, jump via node clicks.
7. Export image; Save / Export / Import; Add to system cart (SIS vs KLMS split).

---

## Notes

- The TOKEN is stored in `localStorage` (same as the old proxy settings key, migrated
  automatically) and sent as a URL query parameter to the Workers endpoints.
- The Workers API returns only the first page (`pageSize: 1000`); very large datasets
  may be incomplete.
- The obfuscated prod bundle is harder to debug — use `npm run build:dev` when
  investigating issues, then reproduce against `dist/index.html`.
- `index.html` at the repo root is the legacy monolithic app and is intentionally left
  unchanged so the project always has a working fallback.
