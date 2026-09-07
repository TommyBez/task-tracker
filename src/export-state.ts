import { asciiBytes } from "@native-sdk/core";
import { concat2, concat3 } from "./core-bytes.ts";
import { EMPTY } from "./core-constants.ts";
import { parseLocalClock, parseLocalDay } from "./core-dates.ts";
import { minutesLabel } from "./core-format.ts";
import { clientById, projectById, projectClientName, reportEnd, reportStart } from "./core-queries.ts";
import { applyEdit, createTextEdit } from "./core-state.ts";
import { csvByteLength, exportSlots, isoDay, MAX_CSV_BYTES } from "./export-data.ts";
import type { ExportState } from "./export-types.ts";
import type { Bytes, Model, Msg, PickerOption } from "./core-types.ts";

export function initialExportState(): ExportState {
  return { open: false, scope: "project", targetId: -1, pickerOpen: false, datePicker: "none", monthAnchor: 0,
    startEdit: createTextEdit(EMPTY), endEdit: createTextEdit(EMPTY),
    phase: "idle", path: EMPTY, error: EMPTY, cutoffDay: 0, cutoffMinute: 0 };
}

export function exportBusy(model: Model): boolean {
  return model.csvExport.phase === "clock" || model.csvExport.phase === "choosing" || model.csvExport.phase === "writing";
}

export function exportOptions(model: Model): readonly PickerOption[] {
  if (model.csvExport.scope === "client") return model.clients.map((client) => ({
    id: client.id, label: client.name, secondary: EMPTY, selected: client.id === model.csvExport.targetId,
  }));
  const options: PickerOption[] = model.projects.map((project) => ({
    id: project.id, label: concat3(projectClientName(model, project), asciiBytes(" / "), project.name),
    secondary: EMPTY, selected: project.id === model.csvExport.targetId,
  }));
  options.push({ id: 0, label: asciiBytes("No project (unassigned)"), secondary: EMPTY, selected: model.csvExport.targetId === 0 });
  return options;
}

export function exportTargetLabel(model: Model): Bytes {
  for (const option of exportOptions(model)) if (option.selected) return option.label;
  return EMPTY;
}

export function exportValidation(model: Model): Bytes {
  if (model.loading || !model.storageReady || model.storageBlocked) return asciiBytes("Wait until local data is available.");
  if (!model.hasClock) return asciiBytes("Waiting for the current date and time.");
  const state = model.csvExport;
  if (state.scope === "client" && clientById(model.clients, state.targetId) === null) return asciiBytes("Select a client.");
  if (state.scope === "project" && state.targetId !== 0 && projectById(model.projects, state.targetId) === null) return asciiBytes("Select a project.");
  const start = parseLocalDay(state.startEdit.text);
  const end = parseLocalDay(state.endEdit.text);
  if (start === null) return asciiBytes("Enter valid dates in YYYY-MM-DD format.");
  if (end === null) return asciiBytes("Enter valid dates in YYYY-MM-DD format.");
  if (start > end) return asciiBytes("The end date must be on or after the start date.");
  const slots = exportSlots(model);
  if (slots.length === 0) return asciiBytes("No finished slots match this selection.");
  if (csvByteLength(model, slots) > MAX_CSV_BYTES) return asciiBytes("This export is too large. Choose a shorter period or a single project.");
  return EMPTY;
}

export function exportSummary(model: Model): Bytes {
  const validation = exportValidation(model);
  if (validation.length > 0) return validation;
  const slots = exportSlots(model);
  let minutes = 0;
  for (const slot of slots) minutes += slot.durationMinutes;
  return concat2(asciiBytes(`${slots.length} slots / `), minutesLabel(minutes));
}

export function reduceExportMessage(model: Model, msg: Msg): Model {
  const state = model.csvExport;
  switch (msg.kind) {
    case "open_export":
      return { ...model, csvExport: { ...initialExportState(), open: true,
        startEdit: createTextEdit(isoDay(reportStart(model))), endEdit: createTextEdit(isoDay(reportEnd(model) - 1)),
        cutoffDay: model.currentDayIndex, cutoffMinute: model.currentMinuteOfDay } };
    case "close_export":
      return exportBusy(model) ? model : { ...model, csvExport: { ...state, open: false, pickerOpen: false, datePicker: "none" } };
    case "export_by_project":
    case "export_by_client":
      if (exportBusy(model)) return model;
      return { ...model, csvExport: { ...state, scope: msg.kind === "export_by_client" ? "client" : "project",
        targetId: -1, pickerOpen: false, datePicker: "none", phase: "idle", error: EMPTY } };
    case "toggle_export_picker":
      return exportBusy(model) ? model : { ...model, csvExport: { ...state, pickerOpen: !state.pickerOpen, datePicker: "none" } };
    case "select_export_target":
      if (exportBusy(model)) return model;
      return { ...model, csvExport: { ...state, targetId: msg.id, pickerOpen: false, phase: "idle", error: EMPTY } };
    case "export_start_edit":
      if (exportBusy(model)) return model;
      return { ...model, csvExport: { ...state, startEdit: applyEdit(state.startEdit, msg.edit, 10), datePicker: "none", phase: "idle", error: EMPTY } };
    case "export_end_edit":
      if (exportBusy(model)) return model;
      return { ...model, csvExport: { ...state, endEdit: applyEdit(state.endEdit, msg.edit, 10), datePicker: "none", phase: "idle", error: EMPTY } };
    case "save_export": {
      if (!state.open || exportBusy(model)) return model;
      const error = exportValidation(model);
      return { ...model, csvExport: { ...state, error: error, datePicker: "none", phase: error.length > 0 ? "idle" : "clock", path: EMPTY } };
    }
    case "export_clock_ready": {
      if (state.phase !== "clock") return model;
      if (msg.code !== 0) return { ...model, csvExport: { ...state, phase: "idle", error: asciiBytes("Could not read the current time. Try again.") } };
      const clock = parseLocalClock(msg.output);
      if (clock === null) return { ...model, csvExport: { ...state, phase: "idle", error: asciiBytes("Could not read the current time. Try again.") } };
      const next: Model = { ...model, csvExport: { ...state, cutoffDay: clock.dayIndex, cutoffMinute: clock.minuteOfDay } };
      const error = exportValidation(next);
      return { ...next, csvExport: { ...next.csvExport, phase: error.length > 0 ? "idle" : "choosing", error: error } };
    }
    case "export_path_ready": {
      if (state.phase !== "choosing") return model;
      // osascript appends one newline; preserve whitespace belonging to the path.
      const path = msg.output.endsWith(asciiBytes("\n")) ? msg.output.slice(0, -1) : msg.output;
      if (msg.code !== 0) return { ...model, csvExport: { ...state, phase: "idle", error: asciiBytes("Could not open the save dialog. Try again.") } };
      if (path.length === 0) return { ...model, csvExport: { ...state, phase: "idle" } };
      if (!path.startsWith(asciiBytes("/")) || !path.toLowerCase().endsWith(asciiBytes(".csv")) || path.length > 1024) {
        return { ...model, csvExport: { ...state, phase: "idle", error: asciiBytes("Choose a file with a .csv extension and a shorter path.") } };
      }
      const error = exportValidation(model);
      return { ...model, csvExport: { ...state, path: path, error: error, phase: error.length > 0 ? "idle" : "writing" } };
    }
    case "export_saved":
      if (state.phase !== "writing") return model;
      return { ...model, csvExport: { ...state, phase: "saved", error: EMPTY }, statusText: concat2(asciiBytes("CSV exported to "), state.path) };
    case "export_failed":
      return { ...model, csvExport: { ...state, phase: "idle", error: asciiBytes("Export failed. Check the destination and try again.") } };
    case "reveal_export": return model;
    case "export_revealed":
      return msg.code === 0 ? model : { ...model, csvExport: { ...state, error: asciiBytes("Could not reveal the file in Finder.") } };
    default: return model;
  }
}
