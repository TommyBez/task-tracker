import { asciiBytes, Cmd, Sub } from "@native-sdk/core";
import { bytesEqual } from "./core-bytes.ts";
import { createInitialState } from "./core-state.ts";
import { encodeData, shouldWrite, stagedPath } from "./core-storage.ts";
import { CSV_SAVE_DIALOG, encodeCsv, exportFilename } from "./export-data.ts";
import * as csvView from "./export-state.ts";
import type {
  Bytes,
  CalendarDayView,
  CalendarSlotView,
  ClientRow,
  Model,
  MonthCalendarDayView,
  Msg,
  PickerOption,
  ProjectRow,
  ReportRow,
} from "./core-types.ts";
import { reduceModel } from "./reducers/index.ts";
import * as calendarView from "./views/calendar.ts";
import * as clientView from "./views/clients.ts";
import * as commonView from "./views/common.ts";
import * as projectView from "./views/projects.ts";
import * as reportView from "./views/reports.ts";
import * as slotView from "./views/slots.ts";

export const envMsgs = [{ env: "HOME", msg: "home_ready" }] as const;

export const viewUnbound = [
  "clients", "projects", "slots", "nextClientId", "nextProjectId", "nextSlotId",
  "currentDayIndex", "currentMinuteOfDay", "calendarAnchorDay", "weekStartDay", "reportAnchorDay", "hasClock",
  "storageReady", "storageBlocked", "dataPath", "dataRevision", "writeInFlight", "writeRevision",
  "recoveryWarning", "clientNameEdit", "clientContactEdit", "clientNotesEdit", "projectNameEdit",
  "slotTitleEdit", "slotNotesEdit", "slotEditingId", "projectClientId", "projectTargetHours", "slotProjectId",
  "slotDayOffset", "slotStartMinutes", "slotDurationMinutes", "deleteKind", "deleteTargetId",
  "deleteTargetName", "calendarNavigated", "reportNavigated", "calendarNowPending",
  "calendarLocalPending", "reportNowPending", "reportLocalPending", "hasSlotsThisWeek",
  "sidebarCollapsed", "weekLabel", "clock_ready", "local_date_ready", "local_date_failed",
  "calendar_today_ready", "calendar_local_date_ready", "calendar_local_date_failed",
  "report_today_ready", "report_local_date_ready", "report_local_date_failed", "home_ready",
  "recovery_loaded", "recovery_load_failed", "recovery_committed", "recovery_commit_failed",
  "data_loaded", "data_load_failed", "data_staged", "data_committed", "data_commit_failed",
  "data_save_failed",
  "export_clock_ready", "export_path_ready", "export_saved", "export_failed", "export_revealed",
] as const;

export function initialModel(): [Model, Cmd<Msg>] {
  return [createInitialState(), Cmd.now("clock_ready")];
}

export function subscriptions(_model: Model): Sub<Msg> {
  return Sub.timer("local-clock", 30000, "clock_ready");
}

export function update(model: Model, msg: Msg): Model | [Model, Cmd<Msg>] {
  const next = reduceModel(model, msg);
  switch (msg.kind) {
    case "save_export":
      if (model.csvExport.phase === "clock" || next.csvExport.phase !== "clock") return next;
      return [next, Cmd.spawn([asciiBytes("/bin/date"), asciiBytes("+%Y-%m-%dT%H:%M")],
        { key: "export-clock", collect: true, exit: "export_clock_ready", err: "export_failed" })];
    case "export_clock_ready":
      if (model.csvExport.phase !== "clock" || next.csvExport.phase !== "choosing") return next;
      return [next, Cmd.spawn([asciiBytes("/usr/bin/osascript"), asciiBytes("-e"), CSV_SAVE_DIALOG, exportFilename(next)],
        { key: "export-dialog", collect: true, exit: "export_path_ready", err: "export_failed" })];
    case "export_path_ready":
      if (model.csvExport.phase !== "choosing" || next.csvExport.phase !== "writing") return next;
      return [next, Cmd.writeFile(next.csvExport.path, encodeCsv(next), { key: "csv-write", ok: "export_saved", err: "export_failed" })];
    case "reveal_export":
      if (next.csvExport.phase !== "saved") return next;
      return [next, Cmd.spawn([asciiBytes("/usr/bin/open"), asciiBytes("-R"), next.csvExport.path],
        { key: "csv-reveal", exit: "export_revealed", err: "export_failed" })];
    case "go_today":
      return [next, Cmd.now("calendar_today_ready")];
    case "report_today":
      return [next, Cmd.now("report_today_ready")];
    case "clock_ready":
      return [
        next,
        Cmd.spawn(
          [asciiBytes("/bin/date"), asciiBytes("+%Y-%m-%dT%H:%M")],
          { key: "boot-local-date", collect: true, exit: "local_date_ready", err: "local_date_failed" },
        ),
      ];
    case "calendar_today_ready":
      if (!model.calendarNowPending) return next;
      return [
        next,
        Cmd.spawn(
          [asciiBytes("/bin/date"), asciiBytes("+%Y-%m-%d")],
          { key: "calendar-local-date", collect: true, exit: "calendar_local_date_ready", err: "calendar_local_date_failed" },
        ),
      ];
    case "report_today_ready":
      if (!model.reportNowPending) return next;
      return [
        next,
        Cmd.spawn(
          [asciiBytes("/bin/date"), asciiBytes("+%Y-%m-%d")],
          { key: "report-local-date", collect: true, exit: "report_local_date_ready", err: "report_local_date_failed" },
        ),
      ];
    case "home_ready":
      if (msg.value.length === 0) return next;
      return [next, Cmd.readFile(stagedPath(next), { key: "recovery-read", ok: "recovery_loaded", err: "recovery_load_failed" })];
    case "recovery_loaded":
      if (next.recoveryWarning) {
        return [next, Cmd.readFile(next.dataPath, { key: "store-read", ok: "data_loaded", err: "data_load_failed" })];
      }
      return [
        next,
        Cmd.spawn(
          [asciiBytes("/bin/mv"), stagedPath(next), next.dataPath],
          { key: "recovery-commit", collect: true, exit: "recovery_committed", err: "recovery_commit_failed" },
        ),
      ];
    case "recovery_load_failed":
      if (bytesEqual(msg.reason, asciiBytes("not_found"))) {
        return [next, Cmd.readFile(next.dataPath, { key: "store-read", ok: "data_loaded", err: "data_load_failed" })];
      }
      break;
    case "data_staged":
      if (!model.writeInFlight) return next;
      return [
        next,
        Cmd.spawn(
          [asciiBytes("/bin/mv"), stagedPath(next), next.dataPath],
          { key: "store-commit", collect: true, exit: "data_committed", err: "data_commit_failed" },
        ),
      ];
    default:
      break;
  }
  if (shouldWrite(model, next)) {
    return [next, Cmd.writeFile(stagedPath(next), encodeData(next), { key: "store-stage", ok: "data_staged", err: "data_save_failed" })];
  }
  return next;
}

export function clientNameText(model: Model): Bytes { return clientView.deriveClientNameText(model); }
export function csvBusy(model: Model): boolean { return csvView.exportBusy(model); }
export function csvOptions(model: Model): readonly PickerOption[] { return csvView.exportOptions(model); }
export function csvTargetLabel(model: Model): Bytes { return csvView.exportTargetLabel(model); }
export function csvSummary(model: Model): Bytes { return csvView.exportSummary(model); }
export function canExportCsv(model: Model): boolean { return !csvView.exportBusy(model) && csvView.exportValidation(model).length === 0; }
export function clientContactText(model: Model): Bytes { return clientView.deriveClientContactText(model); }
export function clientNotesText(model: Model): Bytes { return clientView.deriveClientNotesText(model); }
export function projectNameText(model: Model): Bytes { return projectView.deriveProjectNameText(model); }
export function slotTitleText(model: Model): Bytes { return slotView.deriveSlotTitleText(model); }
export function slotNotesText(model: Model): Bytes { return slotView.deriveSlotNotesText(model); }
export function slotModalTitle(model: Model): Bytes { return slotView.deriveSlotModalTitle(model); }
export function slotModalActionLabel(model: Model): Bytes { return slotView.deriveSlotModalActionLabel(model); }
export function hasClientDetails(model: Model): boolean { return clientView.deriveHasClientDetails(model); }
export function clientDetailsName(model: Model): Bytes { return clientView.deriveClientDetailsName(model); }
export function clientDetailsContact(model: Model): Bytes { return clientView.deriveClientDetailsContact(model); }
export function clientDetailsNotes(model: Model): Bytes { return clientView.deriveClientDetailsNotes(model); }
export function clientDetailsHasContact(model: Model): boolean { return clientView.deriveClientDetailsHasContact(model); }
export function clientDetailsHasNotes(model: Model): boolean { return clientView.deriveClientDetailsHasNotes(model); }
export function clientDetailsProjectCountLabel(model: Model): Bytes { return clientView.deriveClientDetailsProjectCountLabel(model); }
export function clientDetailsTargetLabel(model: Model): Bytes { return clientView.deriveClientDetailsTargetLabel(model); }
export function clientDetailsAllocatedLabel(model: Model): Bytes { return clientView.deriveClientDetailsAllocatedLabel(model); }
export function hasSlotDetails(model: Model): boolean { return slotView.deriveHasSlotDetails(model); }
export function slotDetailsDateLabel(model: Model): Bytes { return slotView.deriveSlotDetailsDateLabel(model); }
export function slotDetailsTimeLabel(model: Model): Bytes { return slotView.deriveSlotDetailsTimeLabel(model); }
export function slotDetailsDurationLabel(model: Model): Bytes { return slotView.deriveSlotDetailsDurationLabel(model); }
export function slotDetailsProjectLabel(model: Model): Bytes { return slotView.deriveSlotDetailsProjectLabel(model); }
export function slotDetailsProjectIsPaused(model: Model): boolean { return slotView.deriveSlotDetailsProjectIsPaused(model); }
export function slotDetailsClientLabel(model: Model): Bytes { return slotView.deriveSlotDetailsClientLabel(model); }
export function slotDetailsTitle(model: Model): Bytes { return slotView.deriveSlotDetailsTitle(model); }
export function slotDetailsNotes(model: Model): Bytes { return slotView.deriveSlotDetailsNotes(model); }
export function slotDetailsHasTitle(model: Model): boolean { return slotView.deriveSlotDetailsHasTitle(model); }
export function slotDetailsHasNotes(model: Model): boolean { return slotView.deriveSlotDetailsHasNotes(model); }
export function hasClients(model: Model): boolean { return clientView.deriveHasClients(model); }
export function hasProjects(model: Model): boolean { return projectView.deriveHasProjects(model); }
export function hasActiveProjects(model: Model): boolean { return projectView.deriveHasActiveProjects(model); }
export function hasSlotsThisWeek(model: Model): boolean { return calendarView.deriveHasSlotsThisWeek(model); }
export function hasCalendarDaySlots(model: Model): boolean { return calendarView.deriveHasCalendarDaySlots(model); }
export function hasReportRows(model: Model): boolean { return reportView.deriveHasReportRows(model); }
export function hasValidation(model: Model): boolean { return commonView.deriveHasValidation(model); }
export function canMutate(model: Model): boolean { return commonView.deriveCanMutate(model); }
export function sidebarExpanded(model: Model): boolean { return commonView.deriveSidebarExpanded(model); }
export function sidebarCollapsed(model: Model): boolean { return commonView.deriveSidebarCollapsed(model); }
export function canCreateClient(model: Model): boolean { return clientView.deriveCanCreateClient(model); }
export function canCreateProject(model: Model): boolean { return projectView.deriveCanCreateProject(model); }
export function canCreateSlot(model: Model): boolean { return slotView.deriveCanCreateSlot(model); }
export function canSaveClient(model: Model): boolean { return clientView.deriveCanSaveClient(model); }
export function canSaveProject(model: Model): boolean { return projectView.deriveCanSaveProject(model); }
export function canSaveSlot(model: Model): boolean { return slotView.deriveCanSaveSlot(model); }
export function canDecreaseProjectTarget(model: Model): boolean { return projectView.deriveCanDecreaseProjectTarget(model); }
export function canIncreaseProjectTarget(model: Model): boolean { return projectView.deriveCanIncreaseProjectTarget(model); }
export function canMoveSlotDayPrevious(model: Model): boolean { return slotView.deriveCanMoveSlotDayPrevious(model); }
export function canMoveSlotDayNext(model: Model): boolean { return slotView.deriveCanMoveSlotDayNext(model); }
export function canMoveSlotStartEarlier(model: Model): boolean { return slotView.deriveCanMoveSlotStartEarlier(model); }
export function canMoveSlotStartLater(model: Model): boolean { return slotView.deriveCanMoveSlotStartLater(model); }
export function canDecreaseSlotDuration(model: Model): boolean { return slotView.deriveCanDecreaseSlotDuration(model); }
export function canIncreaseSlotDuration(model: Model): boolean { return slotView.deriveCanIncreaseSlotDuration(model); }
export function hasDeleteConfirmation(model: Model): boolean { return commonView.deriveHasDeleteConfirmation(model); }
export function deleteConfirmationTitle(model: Model): Bytes { return commonView.deriveDeleteConfirmationTitle(model); }
export function deleteConfirmationBody(model: Model): Bytes { return commonView.deriveDeleteConfirmationBody(model); }
export function clientCountLabel(model: Model): Bytes { return clientView.deriveClientCountLabel(model); }
export function projectCountLabel(model: Model): Bytes { return projectView.deriveProjectCountLabel(model); }
export function slotCountLabel(model: Model): Bytes { return calendarView.deriveSlotCountLabel(model); }
export function calendarTotalLabel(model: Model): Bytes { return calendarView.deriveCalendarTotalLabel(model); }
export function calendarPlannedProjectCountLabel(model: Model): Bytes { return calendarView.deriveCalendarPlannedProjectCountLabel(model); }
export function calendarModeLabel(model: Model): Bytes { return calendarView.deriveCalendarModeLabel(model); }
export function previousCalendarLabel(model: Model): Bytes { return calendarView.derivePreviousCalendarLabel(model); }
export function nextCalendarLabel(model: Model): Bytes { return calendarView.deriveNextCalendarLabel(model); }
export function calendarRangeLabel(model: Model): Bytes { return calendarView.deriveCalendarRangeLabel(model); }
export function weekLabel(model: Model): Bytes { return calendarView.deriveWeekLabel(model); }
export function calendarDays(model: Model): readonly CalendarDayView[] { return calendarView.deriveCalendarDays(model); }
export function calendarSlots(model: Model): readonly CalendarSlotView[] { return calendarView.deriveCalendarSlots(model); }
export function calendarDaySlots(model: Model): readonly CalendarSlotView[] { return calendarView.deriveCalendarDaySlots(model); }
export function monthCalendarDays(model: Model): readonly MonthCalendarDayView[] { return calendarView.deriveMonthCalendarDays(model); }
export function clientRows(model: Model): readonly ClientRow[] { return clientView.deriveClientRows(model); }
export function projectRows(model: Model): readonly ProjectRow[] { return projectView.deriveProjectRows(model); }
export function clientOptions(model: Model): readonly PickerOption[] { return clientView.deriveClientOptions(model); }
export function slotProjectOptions(model: Model): readonly PickerOption[] { return slotView.deriveSlotProjectOptions(model); }
export function projectClientLabel(model: Model): Bytes { return projectView.deriveProjectClientLabel(model); }
export function projectTargetLabel(model: Model): Bytes { return projectView.deriveProjectTargetLabel(model); }
export function slotProjectLabel(model: Model): Bytes { return slotView.deriveSlotProjectLabel(model); }
export function slotDayLabel(model: Model): Bytes { return slotView.deriveSlotDayLabel(model); }
export function slotStartLabel(model: Model): Bytes { return slotView.deriveSlotStartLabel(model); }
export function slotEndLabel(model: Model): Bytes { return slotView.deriveSlotEndLabel(model); }
export function slotDurationLabel(model: Model): Bytes { return slotView.deriveSlotDurationLabel(model); }
export function reportPeriodLabel(model: Model): Bytes { return reportView.deriveReportPeriodLabel(model); }
export function reportRangeLabel(model: Model): Bytes { return reportView.deriveReportRangeLabel(model); }
export function reportRows(model: Model): readonly ReportRow[] { return reportView.deriveReportRows(model); }
export function reportTotalLabel(model: Model): Bytes { return reportView.deriveReportTotalLabel(model); }
