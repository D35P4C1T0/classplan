# Classplan

A small, browser-only lesson planner. Drag sections into order, resize them from the bottom edge, or click a section to edit its title, type, minutes and notes. The time check always shows the planned finish and any overrun against the default two-hour budget.

## Run

```sh
npm install
npm run dev
```

```sh
npm test
npm run build
npm run preview
```

Use Node.js 22.12+ (or 20.19+). React + Vite, dnd-kit for pointer/keyboard sorting, re-resizable for resizing, and Lucide icons. No backend, database, accounts, or environment variables.

## Deploy to Vercel

Push this repository to GitHub and import it into Vercel. Choose **Vite**; build command: `npm run build`; output directory: `dist`. Alternatively run `npx vercel` in this folder. No deployment has been created automatically.

## Planning

- The provided draft is preserved: 20-minute presentation, three exercises of 15/15/5 minutes, a 7-minute break, and 5 minutes of questions: **137 minutes**.
- Change start time and timeframe in Class settings. The default is 09:00 and 120 minutes.
- **Fit to timeframe** proportionally adjusts all sections to fill the budget using whole minutes, with a minimum of one minute per section. It also adjusts breaks; edit those afterward if necessary. An impossible fit (more sections than available minutes) is disabled.
- Use the grip to reorder. Keyboard: focus the grip, press Space to pick up, arrow keys to move, Space to drop, Escape to cancel.
- Pull a block’s bottom edge to resize in one-minute increments. Use the Minutes field for exact or keyboard entry. Blocks include fixed padding so even a one-minute section stays readable; the top time bar reflects actual proportions.
- Add, duplicate, edit or remove sections. Adding a type to `TYPES` in `src/schedule.js` automatically adds it to the library and editor.
- Edits save in this browser’s local storage. Storage is device/browser-specific, with no cross-device collaboration. A warning appears if saving fails. Export before clearing browser storage.
- CSV exports include start/end times, duration, title, type and notes, with spreadsheet formula protection. HTML exports are standalone, escaped documents that can be shared or printed. Exports are snapshots, not editable backups.

## Scope

Source is intentionally flat: one UI file, one stylesheet, and schedule/export logic with Node tests. Fonts use Google Fonts with system fallbacks. No runtime service is needed beyond static hosting.
