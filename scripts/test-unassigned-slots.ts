import assert from "node:assert/strict";
import { encodeV3 } from "./storage-fixtures.ts";
import { asciiBytes } from "@native-sdk/core";
import { installTextMethods } from "../node_modules/@native-sdk/cli/packages/core/src/text_polyfill.ts";
import { FORMAT_VERSION, PROJECT_STATUS_FORMAT_VERSION, UNASSIGNED_PROJECT_ID } from "../src/core-constants.ts";
import { createInitialState } from "../src/core-state.ts";
import { decodeData, encodeData, encodedSize } from "../src/core-storage.ts";
import type { Model, Project, Slot } from "../src/core-types.ts";
import { reduceModel } from "../src/reducers/index.ts";
import {
  deriveCalendarDaySlots,
  deriveCalendarPlannedProjectCountLabel,
  deriveCalendarSlots,
  deriveCalendarTotalLabel,
  deriveMonthCalendarDays,
} from "../src/views/calendar.ts";
import { deriveClientRows } from "../src/views/clients.ts";
import { deriveHasReportRows, deriveReportRows, deriveReportTotalLabel } from "../src/views/reports.ts";
import {
  deriveCanCreateSlot,
  deriveCanSaveSlot,
  deriveSlotDetailsClientLabel,
  deriveSlotDetailsProjectIsPaused,
  deriveSlotDetailsProjectLabel,
  deriveSlotProjectLabel,
  deriveSlotProjectOptions,
} from "../src/views/slots.ts";

installTextMethods();
const text = (value: Uint8Array): string => new TextDecoder().decode(value);
const client = { id: 1, name: asciiBytes("Client"), contact: asciiBytes(""), notes: asciiBytes("") };
const project: Project = { id: 1, clientId: 1, name: asciiBytes("Project"), targetMinutes: 300, isActive: true, budgetKind: "weekly" };
const paused: Project = { ...project, isActive: false };
const assignedSlot: Slot = {
  id: 1,
  projectId: 1,
  dayIndex: 0,
  startMinutes: 480,
  durationMinutes: 60,
  title: asciiBytes("Assigned"),
  notes: asciiBytes(""),
};
const unassignedSlot: Slot = {
  id: 2,
  projectId: UNASSIGNED_PROJECT_ID,
  dayIndex: 0,
  startMinutes: 540,
  durationMinutes: 60,
  title: asciiBytes("Admin"),
  notes: asciiBytes("General work"),
};

function readyModel(overrides: Partial<Model> = {}): Model {
  return {
    ...createInitialState(),
    loading: false,
    storageReady: true,
    dataPath: asciiBytes("/tmp/task-tracker-unassigned-test.tt"),
    currentDayIndex: 0,
    currentMinuteOfDay: 570,
    calendarAnchorDay: 0,
    weekStartDay: 0,
    reportAnchorDay: 0,
    clients: [client],
    projects: [project],
    slots: [assignedSlot, unassignedSlot],
    nextClientId: 2,
    nextProjectId: 2,
    nextSlotId: 3,
    ...overrides,
  };
}

const current = readyModel();
const encoded = encodeData(current);
assert.equal(encoded.length, encodedSize(current));
assert.equal(new DataView(encoded.buffer).getUint32(4, true), FORMAT_VERSION);
const decoded = decodeData(encoded);
assert.ok(decoded);
assert.deepEqual(decoded.slots.map((slot) => slot.projectId), [project.id, UNASSIGNED_PROJECT_ID]);

const assignedOnly = encodeV3(readyModel({ slots: [assignedSlot] }));
new DataView(assignedOnly.buffer).setUint32(4, PROJECT_STATUS_FORMAT_VERSION, true);
assert.equal(decodeData(assignedOnly)?.slots[0].projectId, project.id);
const incompatibleV2 = encodeV3(current);
new DataView(incompatibleV2.buffer).setUint32(4, PROJECT_STATUS_FORMAT_VERSION, true);
assert.equal(decodeData(incompatibleV2), null);
assert.equal(decodeData(encodeData(readyModel({ slots: [{ ...unassignedSlot, projectId: 99 }] }))), null);

const projectless = readyModel({ clients: [], projects: [], slots: [], nextClientId: 1, nextProjectId: 1, nextSlotId: 1 });
assert.equal(deriveCanCreateSlot(projectless), true);
const openedProjectless = reduceModel(projectless, { kind: "open_slot_modal" });
assert.equal(openedProjectless.slotModalOpen, true);
assert.equal(openedProjectless.slotProjectId, UNASSIGNED_PROJECT_ID);
assert.equal(deriveCanSaveSlot(openedProjectless), true);
assert.deepEqual(deriveSlotProjectOptions(openedProjectless).map((option) => option.id), [UNASSIGNED_PROJECT_ID]);

const pausedOnly = readyModel({ projects: [paused], slots: [] });
assert.equal(deriveCanCreateSlot(pausedOnly), true);
assert.equal(reduceModel(pausedOnly, { kind: "open_slot_for_day", dayOffset: 2 }).slotProjectId, UNASSIGNED_PROJECT_ID);
const openedAssigned = reduceModel(readyModel({ slots: [] }), { kind: "open_slot_modal" });
assert.equal(openedAssigned.slotProjectId, project.id);
const selectedNone = reduceModel({ ...openedAssigned, slotProjectPickerOpen: true }, { kind: "select_slot_project", projectId: UNASSIGNED_PROJECT_ID });
assert.equal(selectedNone.slotProjectPickerOpen, false);
assert.equal(text(deriveSlotProjectLabel(selectedNone)), "No project");
assert.deepEqual(deriveSlotProjectOptions(selectedNone).map((option) => option.id), [UNASSIGNED_PROJECT_ID, project.id]);
const savedNone = reduceModel(selectedNone, { kind: "save_slot" });
assert.equal(savedNone.slots[0].projectId, UNASSIGNED_PROJECT_ID);
assert.equal(savedNone.slots[0].title.length, 0);
const stalePaused = readyModel({ projects: [paused], slots: [], slotProjectId: paused.id });
assert.equal(deriveCanSaveSlot(stalePaused), false);
assert.equal(text(reduceModel(stalePaused, { kind: "save_slot" }).validationText), "Select an active project or choose No project.");

const onlyNone = readyModel({ clients: [], projects: [], slots: [unassignedSlot] });
const daySlot = deriveCalendarDaySlots(onlyNone)[0];
assert.equal(text(daySlot.projectName), "No project");
assert.equal(text(daySlot.clientName), "Unassigned");
assert.equal(daySlot.projectIsActive, true);
assert.equal(daySlot.isCurrent, true);
assert.equal(deriveCalendarSlots(onlyNone)[0].isCurrent, true);
assert.equal(text(deriveCalendarTotalLabel(onlyNone)), "1 h");
assert.equal(text(deriveCalendarPlannedProjectCountLabel(onlyNone)), "0 planned projects");
assert.equal(text(deriveCalendarPlannedProjectCountLabel(current)), "1 planned project");
const monthDay = deriveMonthCalendarDays(onlyNone).find((day) => day.dayIndex === 0);
assert.ok(monthDay);
assert.equal(monthDay.hasCurrentSlot, true);
assert.equal(text(monthDay.currentSlotDisplayName), "Admin");
const untitledMonthDay = deriveMonthCalendarDays({ ...onlyNone, currentMinuteOfDay: 700, slots: [{ ...unassignedSlot, title: asciiBytes("") }] }).find((day) => day.dayIndex === 0);
assert.ok(untitledMonthDay);
assert.equal(text(untitledMonthDay.primarySlotLabel), "No project");

assert.equal(deriveHasReportRows(onlyNone), true);
const report = deriveReportRows(onlyNone);
assert.equal(report.length, 1);
assert.equal(report[0].projectId, UNASSIGNED_PROJECT_ID);
assert.equal(text(report[0].projectName), "No project");
assert.equal(text(report[0].clientName), "Unassigned");
assert.equal(text(report[0].allocatedLabel), "1 h");
assert.equal(text(report[0].targetLabel), "-");
assert.equal(text(deriveReportTotalLabel(onlyNone)), "1 h");
assert.equal(deriveHasReportRows({ ...onlyNone, slots: [{ ...unassignedSlot, dayIndex: 8 }] }), false);
assert.equal(deriveClientRows(current)[0].allocatedMinutes, assignedSlot.durationMinutes);

assert.equal(text(deriveSlotDetailsProjectLabel({ ...onlyNone, slotDetailsId: unassignedSlot.id })), "No project");
assert.equal(text(deriveSlotDetailsClientLabel({ ...onlyNone, slotDetailsId: unassignedSlot.id })), "Unassigned");
assert.equal(deriveSlotDetailsProjectIsPaused({ ...onlyNone, slotDetailsId: unassignedSlot.id }), false);
const editingNone = reduceModel(onlyNone, { kind: "edit_slot", slotId: unassignedSlot.id });
assert.equal(editingNone.slotEditingId, unassignedSlot.id);
assert.equal(editingNone.slotProjectId, UNASSIGNED_PROJECT_ID);
assert.equal(deriveCanSaveSlot(editingNone), true);
const editedNone = reduceModel({ ...editingNone, slotNotesEdit: { ...editingNone.slotNotesEdit, text: asciiBytes("Updated admin") } }, { kind: "save_slot" });
assert.equal(editedNone.slots.length, onlyNone.slots.length);
assert.equal(text(editedNone.slots[0].notes), "Updated admin");

const deletingClient = readyModel({ deleteKind: "client", deleteTargetId: client.id, deleteTargetName: client.name });
const clientDeleted = reduceModel(deletingClient, { kind: "confirm_delete" });
assert.deepEqual(clientDeleted.slots.map((slot) => slot.projectId), [UNASSIGNED_PROJECT_ID]);
assert.ok(decodeData(encodeData(clientDeleted)));
const deletingProject = readyModel({ deleteKind: "project", deleteTargetId: project.id, deleteTargetName: project.name });
assert.deepEqual(reduceModel(deletingProject, { kind: "confirm_delete" }).slots.map((slot) => slot.projectId), [UNASSIGNED_PROJECT_ID]);

const earlySlots = [0, 60, 120, 180].map((startMinutes, index) => ({ ...assignedSlot, id: index + 10, startMinutes: startMinutes, durationMinutes: 30 }));
const fullDay = deriveCalendarSlots(readyModel({ clients: [], projects: [], slots: [...earlySlots.map((slot) => ({ ...slot, projectId: UNASSIGNED_PROJECT_ID })), unassignedSlot] }));
assert.equal(fullDay.length, 5);
assert.equal(fullDay[4].id, unassignedSlot.id);
assert.equal(fullDay[4].isCurrent, true);

const overlap = reduceModel(readyModel({ slots: [{ ...assignedSlot, startMinutes: 540 }], slotProjectId: UNASSIGNED_PROJECT_ID }), { kind: "save_slot" });
assert.equal(text(overlap.validationText), "This time overlaps an existing slot.");

console.log("Unassigned slot behavior tests passed.");
