import assert from "node:assert/strict";
import { asciiBytes } from "@native-sdk/core";
import { installTextMethods } from "../node_modules/@native-sdk/cli/packages/core/src/text_polyfill.ts";
import { update } from "../src/core.ts";
import { parseLocalDay } from "../src/core-dates.ts";
import { createInitialState, createTextEdit } from "../src/core-state.ts";
import type { Model, Slot } from "../src/core-types.ts";
import { csvByteLength, encodeCsv, exportSlots } from "../src/export-data.ts";
import { exportOptions, exportValidation } from "../src/export-state.ts";
import { reduceModel } from "../src/reducers/index.ts";

installTextMethods();
const text = (value: Uint8Array) => new TextDecoder().decode(value);
const day = parseLocalDay(asciiBytes("2026-09-07"))!;
const client = { id: 1, name: new TextEncoder().encode('Café, "Studio"'), contact: asciiBytes(""), notes: asciiBytes("") };
const project = { id: 1, clientId: 1, name: asciiBytes("Design"), targetMinutes: 0, isActive: false };
const slot: Slot = { id: 1, projectId: 1, dayIndex: day - 1, startMinutes: 540, durationMinutes: 90,
  title: asciiBytes('Review, "v2"'), notes: asciiBytes("First line\nSecond line") };
const base: Model = { ...createInitialState(), loading: false, storageReady: true, hasClock: true,
  currentDayIndex: day, currentMinuteOfDay: 720, reportAnchorDay: day,
  clients: [client, { ...client, id: 2 }],
  projects: [project, { ...project, id: 2, name: asciiBytes("Build") }, { ...project, id: 3, clientId: 2 }],
  slots: [
    { ...slot, id: 8, dayIndex: day + 1 }, // future
    { ...slot, id: 7, dayIndex: day, startMinutes: 720 }, // ongoing
    { ...slot, id: 6, dayIndex: day - 2 }, // before the interval
    { ...slot, id: 5, projectId: 3 }, // another client
    { ...slot, id: 4, projectId: 0 }, // unassigned
    { ...slot, id: 3, projectId: 2 }, // sibling project
    { ...slot, id: 2, dayIndex: day, startMinutes: 690, durationMinutes: 30, title: asciiBytes("=SUM(A1:A2)"), notes: new TextEncoder().encode("Résumé") },
    slot,
  ] };

// Main path: inclusive dates, finished slots, paused project, client aggregation,
// exact CSV escaping/Unicode and the save effect through the real update entry.
const opened = reduceModel(base, { kind: "open_export" });
const selected: Model = { ...opened, csvExport: { ...opened.csvExport, targetId: 1,
  startEdit: createTextEdit(asciiBytes("2026-09-06")), endEdit: createTextEdit(asciiBytes("2026-09-08")) } };
assert.equal(text(exportValidation(selected)), "");
assert.deepEqual(exportSlots(selected).map((s) => s.id), [1, 2]);
assert.equal(exportOptions(selected)[0].selected, true);
assert.equal(exportOptions(selected).some((o) => o.id === 0), true);
const csv = encodeCsv(selected);
assert.deepEqual([...csv.slice(0, 3)], [239, 187, 191]);
assert.equal(csv.length, csvByteLength(selected, exportSlots(selected)));
assert.equal(text(csv), 'Date,Start,End,Duration (minutes),Duration (hours),Client,Project,Title,Notes\r\n'
  + '2026-09-06,09:00,10:30,90,1.50,"Café, ""Studio""","Design","Review, ""v2""","First line\nSecond line"\r\n'
  + '2026-09-07,11:30,12:00,30,0.50,"Café, ""Studio""","Design","\'=SUM(A1:A2)","Résumé"\r\n');
const byClient: Model = { ...selected, csvExport: { ...selected.csvExport, scope: "client" } };
assert.deepEqual(exportSlots(byClient).map((s) => s.id), [1, 3, 2]);
const unassigned: Model = { ...selected, csvExport: { ...selected.csvExport, targetId: 0 } };
assert.deepEqual(exportSlots(unassigned).map((s) => s.id), [4]);
let result = update(selected, { kind: "save_export" });
assert.ok(Array.isArray(result));
const waiting: Model = result[0];
result = update(waiting, { kind: "export_clock_ready", code: 0, output: asciiBytes("2026-09-07T12:00\n") });
assert.ok(Array.isArray(result));
const choosing: Model = result[0];
result = update(choosing, { kind: "export_path_ready", code: 0, output: asciiBytes("/tmp/activities test.csv\n") });
assert.ok(Array.isArray(result));
const writing: Model = result[0];
assert.equal(writing.csvExport.phase, "writing");
assert.equal(text(writing.csvExport.path), "/tmp/activities test.csv");
assert.equal(reduceModel(writing, { kind: "export_saved" }).csvExport.phase, "saved");
assert.equal(writing.dataRevision, base.dataRevision);
assert.deepEqual(writing.slots, base.slots);

// Failure path: invalid/reversed periods, no results, cancellation and write
// failure must not write a CSV or report success.
const invalid: Model = { ...selected, csvExport: { ...selected.csvExport, startEdit: createTextEdit(asciiBytes("2026-02-30")) } };
assert.match(text(exportValidation(invalid)), /valid dates/);
assert.equal(Array.isArray(update(invalid, { kind: "save_export" })), false);
assert.match(text(exportValidation({ ...invalid, csvExport: { ...invalid.csvExport, startEdit: createTextEdit(asciiBytes("2026-09-09")) } })), /end date/);
assert.match(text(exportValidation({ ...selected, slots: [] })), /No finished slots/);
assert.equal(reduceModel(choosing, { kind: "export_path_ready", code: 0, output: asciiBytes("\n") }).csvExport.phase, "idle");
assert.equal(Array.isArray(update(choosing, { kind: "export_path_ready", code: 0, output: asciiBytes("/tmp/data.tt\n") })), false);
const failed = reduceModel(writing, { kind: "export_failed", reason: asciiBytes("io_failed") });
assert.equal(failed.csvExport.phase, "idle");
assert.match(text(failed.csvExport.error), /Export failed/);
console.log("CSV export behavior tests passed.");
