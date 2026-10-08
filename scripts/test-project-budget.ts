import assert from "node:assert/strict";
import { asciiBytes } from "@native-sdk/core";
import { installTextMethods } from "../node_modules/@native-sdk/cli/packages/core/src/text_polyfill.ts";
import { createInitialState, createTextEdit } from "../src/core-state.ts";
import { decodeData, encodeData } from "../src/core-storage.ts";
import { reduceModel } from "../src/reducers/index.ts";
import { deriveCanSaveProject, deriveProjectRows } from "../src/views/projects.ts";
import { deriveReportRows } from "../src/views/reports.ts";
import { deriveClientRows } from "../src/views/clients.ts";
import { encodeV3 } from "./storage-fixtures.ts";
import type { Model, Project } from "../src/core-types.ts";

installTextMethods();
const fixed: Project = { id: 1, clientId: 1, name: asciiBytes("Fixed"), targetMinutes: 1200, isActive: true, budgetKind: "total" };
const weekly: Project = { ...fixed, id: 2, name: asciiBytes("Weekly"), targetMinutes: 600, budgetKind: "weekly" };
const base: Model = { ...createInitialState(), loading: false, storageReady: true, dataPath: asciiBytes("/tmp/budget-test.tt"),
  clients: [{ id: 1, name: asciiBytes("Client"), contact: asciiBytes(""), notes: asciiBytes("") }],
  projects: [fixed, weekly], nextProjectId: 3, nextSlotId: 4,
  slots: [0, 7, 35].map((dayIndex, index) => ({ id: index + 1, projectId: 1, dayIndex,
    startMinutes: 540, durationMinutes: 120, title: asciiBytes("Work"), notes: asciiBytes("") })) };
assert.equal(deriveProjectRows(base)[0].weekMinutes, 360);
assert.equal(deriveProjectRows(base)[0].remainingMinutes, 840);
assert.equal(deriveProjectRows({ ...base, weekStartDay: 7 })[0].remainingMinutes, 840);
const paused = deriveProjectRows({ ...base, projects: [{ ...fixed, isActive: false, targetMinutes: 300 }] })[0];
assert.equal(paused.remainingMinutes, -60);
assert.equal(paused.isOver, true);
assert.notEqual(new TextDecoder().decode(paused.remainingLabel), "-");
assert.equal(deriveClientRows(base)[0].targetMinutes, weekly.targetMinutes);
const report = deriveReportRows(base)[0];
assert.equal(report.allocatedMinutes, 120);
assert.equal(report.targetMinutes, 1200);
assert.equal(report.deltaMinutes, 840);
const monthly = deriveReportRows({ ...base, reportPeriod: "monthly" })[0];
assert.equal(monthly.deltaMinutes, 840);
assert.equal(monthly.targetMinutes, 1200);
assert.equal(deriveReportRows({ ...base, projects: [{ ...fixed, targetMinutes: 300 }] })[0].isOver, true);
assert.deepEqual(decodeData(encodeData(base))?.projects, base.projects);
const v3 = encodeV3({ ...base, projects: [{ ...weekly, id: 1 }] });
assert.equal(decodeData(v3)?.projects[0].budgetKind, "weekly");
assert.equal(decodeData(v3)?.slots.length, base.slots.length);
const draft = reduceModel(base, { kind: "edit_project", projectId: 2 });
const totalDraft = reduceModel(draft, { kind: "project_budget_total" });
const saved = reduceModel({ ...totalDraft, projectTotalHoursEdit: createTextEdit(asciiBytes("250")) }, { kind: "save_project" });
assert.equal(saved.projects[1].budgetKind, "total");
assert.equal(saved.projects[1].targetMinutes, 15000);
assert.equal(saved.slots, base.slots);
const reopened = reduceModel({ ...saved, writeInFlight: false }, { kind: "edit_project", projectId: 2 });
const weeklyDraft = reduceModel(reopened, { kind: "project_budget_weekly" });
assert.equal(reduceModel(weeklyDraft, { kind: "save_project" }).projects[1].budgetKind, "weekly");
const invalid = { ...totalDraft, projectTotalHoursEdit: createTextEdit(asciiBytes("abc")) };
assert.equal(deriveCanSaveProject(invalid), false);
assert.equal(reduceModel(invalid, { kind: "save_project" }).projects, base.projects);
assert.equal(deriveCanSaveProject({ ...totalDraft, projectTotalHoursEdit: createTextEdit(asciiBytes("1000001")) }), false);
const zeroDraft = { ...totalDraft, projectEditingId: 0, projectTotalHoursEdit: createTextEdit(asciiBytes("0")) };
assert.equal(deriveCanSaveProject(zeroDraft), true);
const created = reduceModel(zeroDraft, { kind: "save_project" }).projects[2];
assert.equal(created.budgetKind, "total");
assert.equal(created.targetMinutes, 0);
console.log("Project budget behavior tests passed.");
