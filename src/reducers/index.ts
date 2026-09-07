import type { Model, Msg } from "../core-types.ts";
import { reduceExportMessage } from "../export-state.ts";
import { reduceExportCalendar } from "../export-calendar.ts";
import { reduceDateSyncMessage } from "./date-sync.ts";
import { reduceReportDeleteMessage } from "./reports-delete.ts";
import { reduceSlotMessage } from "./slots.ts";
import { reduceStorageMessage } from "./storage.ts";
import { reduceUiMessage } from "./ui.ts";

export function reduceModel(model: Model, msg: Msg): Model {
  switch (msg.kind) {
    case "csv_open_start":
    case "csv_open_end":
    case "csv_close_dates":
    case "csv_previous_month":
    case "csv_next_month":
    case "csv_pick_date":
    case "csv_this_week":
    case "csv_last_week":
    case "csv_this_month":
    case "csv_last_month":
      return reduceExportCalendar(model, msg);
    case "open_export":
    case "close_export":
    case "export_by_project":
    case "export_by_client":
    case "toggle_export_picker":
    case "select_export_target":
    case "export_start_edit":
    case "export_end_edit":
    case "save_export":
    case "export_clock_ready":
    case "export_path_ready":
    case "export_saved":
    case "export_failed":
    case "reveal_export":
    case "export_revealed":
      return reduceExportMessage(model, msg);
    case "show_calendar":
    case "show_clients":
    case "show_projects":
    case "show_reports":
    case "toggle_sidebar":
    case "sidebar_resized":
    case "set_calendar_day":
    case "set_calendar_week":
    case "set_calendar_month":
    case "calendar_previous":
    case "calendar_next":
    case "open_calendar_day":
    case "open_client_modal":
    case "close_client_modal":
    case "client_name_edit":
    case "client_contact_edit":
    case "client_notes_edit":
    case "save_client":
    case "open_client_details":
    case "close_client_details":
    case "delete_client":
    case "open_project_modal":
    case "close_project_modal":
    case "project_name_edit":
    case "toggle_client_picker":
    case "select_project_client":
    case "project_target_less":
    case "project_target_more":
    case "decrease_project_target":
    case "increase_project_target":
    case "toggle_project_active":
    case "save_project":
    case "delete_project":
      return reduceUiMessage(model, msg);
    case "open_slot_modal":
    case "open_slot_for_day":
    case "edit_slot":
    case "close_slot_modal":
    case "slot_title_edit":
    case "slot_notes_edit":
    case "toggle_slot_project_picker":
    case "select_slot_project":
    case "slot_day_previous":
    case "slot_day_next":
    case "slot_start_earlier":
    case "slot_start_later":
    case "slot_duration_less":
    case "slot_duration_more":
    case "save_slot":
    case "open_slot_details":
    case "close_slot_details":
    case "delete_slot":
      return reduceSlotMessage(model, msg);
    case "set_report_weekly":
    case "set_report_monthly":
    case "report_previous":
    case "report_next":
    case "confirm_delete":
    case "cancel_delete":
      return reduceReportDeleteMessage(model, msg);
    case "go_today":
    case "report_today":
    case "clock_ready":
    case "local_date_ready":
    case "local_date_failed":
    case "calendar_today_ready":
    case "calendar_local_date_ready":
    case "calendar_local_date_failed":
    case "report_today_ready":
    case "report_local_date_ready":
    case "report_local_date_failed":
      return reduceDateSyncMessage(model, msg);
    case "home_ready":
    case "recovery_loaded":
    case "recovery_load_failed":
    case "recovery_committed":
    case "recovery_commit_failed":
    case "data_loaded":
    case "data_load_failed":
    case "data_staged":
    case "data_committed":
    case "data_commit_failed":
    case "data_save_failed":
      return reduceStorageMessage(model, msg);
  }
}
