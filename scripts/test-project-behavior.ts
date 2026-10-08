import assert from "node:assert/strict";
import { asciiBytes } from "@native-sdk/core";
import { installTextMethods } from "../node_modules/@native-sdk/cli/packages/core/src/text_polyfill.ts";
import { FORMAT_VERSION, LEGACY_FORMAT_VERSION, MAGIC, MINUTES_PER_DAY } from "../src/core-constants.ts";
import { parseLocalClock } from "../src/core-dates.ts";
import { createInitialState } from "../src/core-state.ts";
import { decodeData, encodeData, encodedSize } from "../src/core-storage.ts";
import type { Model, Project } from "../src/core-types.ts";
import { reduceModel } from "../src/reducers/index.ts";
import { deriveCalendarDaySlots, deriveCalendarSlots, deriveMonthCalendarDays } from "../src/views/calendar.ts";
import { deriveClientOptions, deriveClientRows } from "../src/views/clients.ts";
import { encodeCsv, exportSlots, isoDay } from "../src/export-data.ts";
import { deriveReportRows } from "../src/views/reports.ts";
import { deriveCanCreateSlot, deriveCanSaveSlot, deriveSlotDetailsProjectIsPaused, deriveSlotModalActionLabel, deriveSlotModalTitle, deriveSlotProjectLabel, deriveSlotProjectOptions } from "../src/views/slots.ts";
import { deriveCanCreateProject, deriveCanSaveProject, deriveProjectClientLabel, deriveCanDecreaseProjectTarget, deriveProjectRows } from "../src/views/projects.ts";

installTextMethods();
const text = (value: Uint8Array): string => new TextDecoder().decode(value);
const client = { id: 1, name: asciiBytes("Client"), contact: asciiBytes(""), notes: asciiBytes("") };
const activeZero: Project = { id: 1, clientId: 1, name: asciiBytes("Zero"), targetMinutes: 0, isActive: true, budgetKind: "weekly" };
const paused: Project = { id: 2, clientId: 1, name: asciiBytes("Paused"), targetMinutes: 600, isActive: false, budgetKind: "weekly" };
const pausedSlot = {
  id: 1,
  projectId: 2,
  dayIndex: 0,
  startMinutes: 540,
  durationMinutes: 60,
  title: asciiBytes("Existing plan"),
  notes: asciiBytes(""),
};

function readyModel(overrides: Partial<Model> = {}): Model {
  return {
    ...createInitialState(),
    loading: false,
    storageReady: true,
    dataPath: asciiBytes("/tmp/task-tracker-test.tt"),
    currentDayIndex: 0,
    calendarAnchorDay: 0,
    weekStartDay: 0,
    reportAnchorDay: 0,
    clients: [client],
    projects: [activeZero, paused],
    slots: [pausedSlot],
    nextClientId: 2,
    nextProjectId: 3,
    nextSlotId: 2,
    ...overrides,
  };
}

function pushU32(out: number[], value: number): void {
  out.push(value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255);
}

function pushBytes(out: number[], value: string): void {
  const bytes = new TextEncoder().encode(value);
  pushU32(out, bytes.length);
  out.push(...bytes);
}

function legacyFixture(): Uint8Array {
  const out: number[] = [];
  pushU32(out, MAGIC);
  pushU32(out, LEGACY_FORMAT_VERSION);
  pushU32(out, 2);
  pushU32(out, 2);
  pushU32(out, 2);
  pushU32(out, 1);
  pushU32(out, 1);
  pushBytes(out, "Legacy client");
  pushBytes(out, "");
  pushBytes(out, "");
  pushU32(out, 1);
  pushU32(out, 1);
  pushU32(out, 1);
  pushU32(out, 60);
  pushBytes(out, "Legacy project");
  pushU32(out, 1);
  pushU32(out, 1);
  pushU32(out, 1);
  pushU32(out, 0);
  pushU32(out, 540);
  pushU32(out, 60);
  pushBytes(out, "Legacy slot");
  pushBytes(out, "");
  return new Uint8Array(out);
}

function firstProjectActiveOffset(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 24;
  const read = (): number => {
    const value = view.getUint32(offset, true);
    offset += 4;
    return value;
  };
  read();
  for (let field = 0; field < 3; field += 1) {
    const length = read();
    offset += length;
  }
  read();
  offset += 12;
  return offset;
}

const current = readyModel();
const encoded = encodeData(current);
assert.equal(new DataView(encoded.buffer).getUint32(4, true), FORMAT_VERSION);
assert.equal(encoded.length, encodedSize(current));
const decoded = decodeData(encoded);
assert.ok(decoded);
assert.equal(decoded.projects[0].targetMinutes, 0);
assert.equal(decoded.projects[0].isActive, true);
assert.equal(decoded.projects[1].isActive, false);

const legacy = decodeData(legacyFixture());
assert.ok(legacy);
assert.equal(legacy.projects[0].targetMinutes, 60);
assert.equal(legacy.projects[0].isActive, true);
assert.equal(legacy.slots[0].projectId, legacy.projects[0].id);
const recovered = reduceModel(readyModel({ loading: true, storageReady: false, clients: [], projects: [], slots: [] }), { kind: "recovery_loaded", bytes: legacyFixture() });
assert.equal(recovered.projects[0].isActive, true);
assert.equal(recovered.slots[0].title.length > 0, true);
assert.equal(decodeData(encoded.slice(0, encoded.length - 1)), null);
const unknownVersion = encoded.slice();
new DataView(unknownVersion.buffer).setUint32(4, 99, true);
assert.equal(decodeData(unknownVersion), null);
const invalidFlag = encoded.slice();
new DataView(invalidFlag.buffer).setUint32(firstProjectActiveOffset(invalidFlag), 2, true);
assert.equal(decodeData(invalidFlag), null);

assert.equal(deriveCanDecreaseProjectTarget(readyModel({ projectTargetHours: 0 })), false);
assert.equal(deriveCanDecreaseProjectTarget(readyModel({ projectTargetHours: 1 })), true);
assert.equal(reduceModel(readyModel({ projectTargetHours: 0 }), { kind: "project_target_less" }).projectTargetHours, 0);
const sixtyMinutes = { ...activeZero, targetMinutes: 60 };
const decremented = reduceModel(readyModel({ projects: [sixtyMinutes] }), { kind: "decrease_project_target", projectId: 1 });
assert.equal(decremented.projects[0].targetMinutes, 0);
const alreadyZero = readyModel({ projects: [activeZero] });
assert.equal(reduceModel(alreadyZero, { kind: "decrease_project_target", projectId: 1 }), alreadyZero);

const newProjectState = readyModel({
  projects: [],
  slots: [],
  nextProjectId: 1,
  projectClientId: 1,
  projectTargetHours: 0,
  projectNameEdit: { ...createInitialState().projectNameEdit, text: asciiBytes("New zero") },
});
const projectSaved = reduceModel(newProjectState, { kind: "save_project" });
assert.equal(projectSaved.projects[0].targetMinutes, 0);
assert.equal(projectSaved.projects[0].isActive, true);

const noClients = readyModel({ clients: [], projects: [], slots: [], nextProjectId: 1 });
assert.equal(deriveCanCreateProject(noClients), true);
const independentDraft = reduceModel(noClients, { kind: "open_project_modal" });
assert.equal(independentDraft.projectModalOpen, true);
assert.equal(text(deriveProjectClientLabel(independentDraft)), "No client");
assert.equal(deriveClientOptions(independentDraft)[0].selected, true);
const namedDraft = { ...independentDraft, projectNameEdit: newProjectState.projectNameEdit };
assert.equal(deriveCanSaveProject(namedDraft), true);
const independentSaved = reduceModel(namedDraft, { kind: "save_project" });
assert.equal(independentSaved.projects[0].clientId, 0);
const independent = { ...independentSaved, slots: [{ ...pausedSlot, projectId: 1 }], nextSlotId: 2 };
assert.equal(decodeData(encodeData(independent))?.projects[0].clientId, 0);
assert.equal(text(deriveProjectRows(independent)[0].clientName), "No client");
assert.equal(text(deriveCalendarSlots(independent)[0].clientName), "No client");
assert.equal(text(deriveReportRows(independent)[0].clientName), "No client");
const exporting = { ...independent, csvExport: { ...independent.csvExport,
  scope: "project" as const, targetId: 1, cutoffDay: 1, cutoffMinute: 0,
  startEdit: { ...independent.csvExport.startEdit, text: isoDay(0) },
  endEdit: { ...independent.csvExport.endEdit, text: isoDay(0) } } };
assert.match(text(encodeCsv(exporting)), /"No client","New zero"/);
assert.equal(exportSlots({ ...exporting, csvExport: { ...exporting.csvExport, scope: "client", targetId: 1 } }).length, 0);
const invalidClientDraft = { ...namedDraft, projectClientId: 999 };
assert.equal(deriveCanSaveProject(invalidClientDraft), false);
assert.equal(reduceModel(invalidClientDraft, { kind: "save_project" }).projects.length, 0);
assert.equal(decodeData(encodeData({ ...independent, projects: [{ ...independent.projects[0], clientId: 999 }] })), null);

const beforeToggle = readyModel({ projects: [{ ...paused, id: 1, isActive: true }] });
const toggled = reduceModel(beforeToggle, { kind: "toggle_project_active", projectId: 1 });
assert.equal(toggled.projects[0].isActive, false);
assert.equal(toggled.projects[0].targetMinutes, paused.targetMinutes);
assert.equal(toggled.slots, beforeToggle.slots);
const resumed = reduceModel({ ...toggled, writeInFlight: false }, { kind: "toggle_project_active", projectId: 1 });
assert.equal(resumed.projects[0].isActive, true);

assert.equal(deriveCanCreateSlot(current), true);
assert.equal(deriveCanSaveSlot({ ...current, slotProjectId: activeZero.id }), true);
assert.deepEqual(deriveSlotProjectOptions(current).map((option) => option.id), [0, activeZero.id]);
assert.equal(text(deriveSlotProjectLabel({ ...current, slotProjectId: activeZero.id })), "Zero / Client");
const opened = reduceModel(current, { kind: "open_slot_modal" });
assert.equal(opened.slotModalOpen, true);
assert.equal(opened.slotProjectId, activeZero.id);
const allPaused = readyModel({ projects: [paused] });
assert.equal(deriveCanCreateSlot(allPaused), true);
const blockedOpen = reduceModel(allPaused, { kind: "open_slot_modal" });
assert.equal(blockedOpen.slotModalOpen, true);
assert.equal(blockedOpen.slotProjectId, 0);
const staleSelection = readyModel({ slotProjectId: paused.id });
assert.equal(deriveCanSaveSlot(staleSelection), false);
const blockedSave = reduceModel(staleSelection, { kind: "save_slot" });
assert.equal(blockedSave.slots.length, current.slots.length);
assert.equal(text(blockedSave.validationText), "Select an active project or choose No project.");
assert.equal(deriveCalendarDaySlots(current)[0].projectIsActive, false);
assert.equal(deriveSlotDetailsProjectIsPaused({ ...current, slotDetailsId: pausedSlot.id }), true);
const editingPaused = reduceModel(current, { kind: "edit_slot", slotId: pausedSlot.id });
assert.equal(editingPaused.slotModalOpen, true);
assert.equal(editingPaused.slotDetailsId, 0);
assert.equal(editingPaused.slotEditingId, pausedSlot.id);
assert.equal(editingPaused.slotProjectId, paused.id);
assert.equal(text(deriveSlotModalTitle(editingPaused)), "Edit slot");
assert.equal(text(deriveSlotModalActionLabel(editingPaused)), "Save changes");
assert.equal(deriveCanSaveSlot(editingPaused), true);
assert.deepEqual(deriveSlotProjectOptions(editingPaused).map((option) => option.id), [0, activeZero.id, paused.id]);
const savedEdit = reduceModel({ ...editingPaused, slotTitleEdit: { ...editingPaused.slotTitleEdit, text: asciiBytes("Updated plan") } }, { kind: "save_slot" });
assert.equal(savedEdit.slots.length, current.slots.length);
assert.equal(savedEdit.nextSlotId, current.nextSlotId);
assert.equal(text(savedEdit.slots[0].title), "Updated plan");
assert.equal(savedEdit.slotEditingId, 0);
const editOverlap = reduceModel({ ...editingPaused, slotStartMinutes: 480, slots: [...current.slots, { ...pausedSlot, id: 9, startMinutes: 480 }] }, { kind: "save_slot" });
assert.equal(text(editOverlap.validationText), "This time overlaps an existing slot.");

const localClock = parseLocalClock(asciiBytes("2026-09-04T09:30\n"));
assert.ok(localClock);
assert.equal(localClock.minuteOfDay, 570);
assert.equal(parseLocalClock(asciiBytes("2026-09-04T24:00\n")), null);
assert.equal(parseLocalClock(asciiBytes("2026-09-04T12:60\n")), null);
const syncedClock = reduceModel(readyModel(), { kind: "local_date_ready", code: 0, output: asciiBytes("2026-09-04T09:30\n") });
assert.equal(syncedClock.currentDayIndex, localClock.dayIndex);
assert.equal(syncedClock.currentMinuteOfDay, localClock.minuteOfDay);
const pendingToday = readyModel({ calendarLocalPending: true });
assert.equal(reduceModel(pendingToday, { kind: "local_date_ready", code: 0, output: asciiBytes("2026-09-04T09:30\n") }).calendarLocalPending, true);
assert.equal(reduceModel(pendingToday, { kind: "local_date_failed", reason: asciiBytes("failed") }).calendarLocalPending, true);
const currentPausedSlot = readyModel({ currentMinuteOfDay: 570 });
assert.equal(deriveCalendarDaySlots(currentPausedSlot)[0].isCurrent, true);
assert.equal(deriveCalendarSlots(currentPausedSlot)[0].isCurrent, true);
assert.equal(deriveCalendarDaySlots(readyModel({ currentMinuteOfDay: 540 }))[0].isCurrent, true);
assert.equal(deriveCalendarDaySlots(readyModel({ currentMinuteOfDay: 599 }))[0].isCurrent, true);
assert.equal(deriveCalendarDaySlots(readyModel({ currentMinuteOfDay: 600 }))[0].isCurrent, false);
assert.equal(deriveCalendarDaySlots(readyModel({ currentMinuteOfDay: MINUTES_PER_DAY }))[0].isCurrent, false);
assert.equal(deriveCalendarDaySlots(readyModel({ currentDayIndex: 1, currentMinuteOfDay: 570 }))[0].isCurrent, false);
const currentMonthDay = deriveMonthCalendarDays(currentPausedSlot).find((day) => day.dayIndex === 0);
assert.ok(currentMonthDay);
assert.equal(currentMonthDay.hasCurrentSlot, true);
assert.equal(text(currentMonthDay.currentSlotDisplayName), "Existing plan");

const fiveSlots = [0, 60, 120, 180].map((startMinutes, index) => ({
  ...pausedSlot,
  id: index + 2,
  startMinutes: startMinutes,
  durationMinutes: 30,
})).concat([pausedSlot]);
const fullDay = deriveCalendarSlots(readyModel({ currentMinuteOfDay: 570, slots: fiveSlots }));
assert.deepEqual(fullDay.map((slot) => slot.id), [2, 3, 4, 5, 1]);
assert.equal(fullDay[4].isCurrent, true);
assert.equal(deriveCalendarSlots(readyModel({ currentMinuteOfDay: 600, slots: fiveSlots })).length, 5);

const clients = deriveClientRows(current);
assert.equal(clients[0].targetMinutes, 0);
assert.equal(clients[0].allocatedMinutes, pausedSlot.durationMinutes);
const reports = deriveReportRows(current);
assert.equal(reports[1].allocatedMinutes, pausedSlot.durationMinutes);
assert.equal(reports[1].targetMinutes, paused.targetMinutes);
assert.equal(reports[1].isActive, false);
assert.equal(text(deriveProjectRows(current)[1].remainingLabel), "-");

const editProject = reduceModel(current, { kind: "edit_project", projectId: paused.id });
assert.equal(text(editProject.projectNameEdit.text), "Paused");
assert.equal(editProject.projectClientId, client.id);
const renamed = { ...editProject, projectNameEdit: { ...editProject.projectNameEdit, text: asciiBytes("Renamed") } };
const detached = reduceModel(renamed, { kind: "select_project_client", clientId: 0 });
const edited = reduceModel(detached, { kind: "save_project" });
assert.equal(edited.projects.length, current.projects.length);
assert.equal(edited.nextProjectId, current.nextProjectId);
assert.equal(edited.slots, current.slots);
assert.deepEqual(edited.projects[1], { ...paused, name: asciiBytes("Renamed"), clientId: 0 });
assert.deepEqual(decodeData(encodeData(edited))?.projects[1], edited.projects[1]);
const editingAgain = reduceModel({ ...edited, writeInFlight: false }, { kind: "edit_project", projectId: paused.id });
const reassigned = reduceModel(editingAgain, { kind: "select_project_client", clientId: client.id });
assert.equal(reduceModel(reassigned, { kind: "save_project" }).projects[1].clientId, client.id);
assert.equal(reduceModel(editProject, { kind: "close_project_modal" }).projects, current.projects);
const emptyName = { ...editProject, projectNameEdit: createInitialState().projectNameEdit };
assert.equal(deriveCanSaveProject(emptyName), false);
assert.equal(reduceModel(emptyName, { kind: "save_project" }).projects, current.projects);
console.log("Project and calendar behavior tests passed.");
