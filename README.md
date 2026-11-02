# Classplan

A small, browser-only lesson planner. Drag sections into order, resize them from the bottom edge, or click a section’s pencil button to edit its title, type, minutes and notes in a popup. Close it with Escape, the close button, or a click outside; edits save immediately. The time check always shows the planned finish and any overrun against the default two-hour budget.

## Run

```sh
npm ci
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

Use Node.js 22.12+. React + Vite, dnd-kit for pointer/keyboard sorting, re-resizable for resizing, and Lucide icons. No backend, database, accounts, or environment variables.

## Deploy to Vercel

Push this repository to GitHub and import it into Vercel. Choose **Vite**; build command: `npm run build`; output directory: `dist`. Alternatively run `npx vercel` in this folder.

## Planning

- The provided draft is preserved: 20-minute presentation, three exercises of 15/15/5 minutes, a 7-minute break, and 5 minutes of questions: **137 minutes**.
- Change start time and timeframe in Class settings. The default is 09:00 and 120 minutes.
- **Fit to timeframe** previews proposed durations and finish time in a modal. Apply changes to confirm, or cancel to keep the current schedule. It proportionally adjusts all sections to fill the budget using whole minutes, with a minimum of one minute per section. It also adjusts breaks; edit those afterward if necessary. An impossible fit (more sections than available minutes) is disabled.
- Use the grip to reorder. Keyboard: focus the grip, press Space to pick up, arrow keys to move, Space to drop, Escape to cancel.
- Pull a block’s bottom edge to resize in one-minute increments. Minutes and the section end time update live; schedule totals and autosave update on release. Use the Minutes field for exact or keyboard entry. Blocks include fixed padding so even a one-minute section stays readable; the top time bar reflects actual proportions.
- Add, duplicate, edit or remove sections. Adding a type to `TYPES` in `src/schedule.js` automatically adds it to the library and editor.
- Edits save in this browser’s local storage. Storage is device/browser-specific, with no cross-device collaboration. A warning appears if saving fails. Export before clearing browser storage.
- CSV exports include start/end times, duration, title, type and notes, with spreadsheet formula protection. HTML exports are standalone, escaped documents that can be shared or printed. Exports are snapshots, not editable backups.

## Import YAML or JSON

Click **Import**, paste text, then **Review import**. Existing sections are replaced only after **Replace schedule**; Cancel, Escape, or closing the modal keeps the current schedule.

```yaml
title: My class
start: "09:00"
budget: 120
blocks:
  - title: Introduction
    type: presentation
    minutes: 20
    notes: Welcome and overview
  - title: Exercise 1
    type: practice
    minutes: 30
```

Equivalent JSON:

```json
{
  "title": "My class",
  "start": "09:00",
  "budget": 120,
  "blocks": [
    {
      "title": "Introduction",
      "type": "presentation",
      "minutes": 20,
      "notes": "Welcome and overview"
    },
    { "title": "Exercise 1", "type": "practice", "minutes": 30 }
  ]
}
```

`blocks` is required; each block requires a text `title` and integer `minutes` between 1 and 1440. Optional defaults: schedule `title` = Imported schedule, `start` = 09:00, `budget` = 120, block `type` = custom, `notes` = empty text. Types: presentation, explanation, practice, discussion, break, custom. IDs are generated on import. Over-budget schedules are allowed and show the usual warning. Parsing uses the `yaml` package, which also supports JSON.

## Scope

Source is intentionally flat: one UI file, one stylesheet, and schedule/export logic with Node tests. Fonts use Google Fonts with system fallbacks. No runtime service is needed beyond static hosting.
