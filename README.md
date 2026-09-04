# Task Tracker

Native desktop application for planning work across client projects.

## Features

- client directory with contact details and notes;
- projects linked to clients, with weekly targets from zero hours and a reversible paused state;
- calendar with daily, weekly, and monthly views, a collapsible sidebar, project slots with optional titles and notes, and a live “Now” highlight for the scheduled slot;
- slot overlap detection;
- weekly and monthly reports of planned hours;
- local storage in `~/Library/Application Support/Task Tracker/data.tt`.

The app is for planning time: it does not include a timer, stopwatch, or automatic time tracking.

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
