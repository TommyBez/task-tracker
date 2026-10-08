# Task Tracker

Native desktop application for planning work across client projects.

## Features

- client directory with contact details and notes;
- projects with an optional client, recurring weekly targets or a fixed total of hours (including zero), editable name/client/budget, and a reversible paused state;
- calendar with daily, weekly, and monthly views, a collapsible sidebar, project or unassigned slots with optional titles and notes, and a live “Now” highlight for the scheduled slot;
- slot overlap detection;
- weekly and monthly reports of planned hours;
- CSV export by client or project for a custom, inclusive date range (Reports > Export CSV), with calendar date pickers, week/month shortcuts, paused projects and an unassigned option;
- local storage in `~/Library/Application Support/Task Tracker/data.tt`.

The app is for planning time: it does not include a timer, stopwatch, or automatic time tracking.

Fixed-total budgets count all project slots, including future plans, without resetting each week. Project and report views show the remaining total; report hours still refer to the selected period. Existing projects retain their weekly targets.

Exports include slots whose scheduled end time has passed, not independently confirmed actual work. They contain date, start/end, duration in minutes and decimal hours, client, project, title and full notes. Files use UTF-8 with a BOM, comma separators and quoted text; potentially executable spreadsheet formulas are escaped. The save dialog lets you choose a `.csv` file. Exports above 256 KiB are rejected with a request to narrow the selection.

## Tech stack

The logic is written in Native SDK's TypeScript subset and compiled ahead of time to native code. The UI is declared in `.native` markup; the distributed binary does not include a browser, WebView, or JavaScript runtime.

## Development with pnpm

```sh
pnpm install
pnpm dev
```

Available commands:

```sh
pnpm dev:core  # run the reducer without launching the UI
pnpm test      # compile and run the Native SDK tests
pnpm check     # validate the core, markup, and manifest
pnpm build     # create the ReleaseFast binary
```

The project requires Native SDK 0.6.2. On the first build, the CLI may install a compatible Zig toolchain locally.
