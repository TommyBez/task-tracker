import type { TextEditState, TextInputEvent } from "@native-sdk/core/text";

export type Bytes = Uint8Array;
export type ActiveView = "calendar" | "clients" | "projects" | "reports";
export type CalendarMode = "day" | "week" | "month";
export type ReportPeriod = "weekly" | "monthly";
export type DeleteKind = "none" | "client" | "project" | "slot";

export interface Client {
  readonly id: number;
  readonly name: Bytes;
  readonly contact: Bytes;
  readonly notes: Bytes;
}

export interface Project {
  readonly id: number;
  readonly clientId: number;
  readonly name: Bytes;
  readonly targetMinutes: number;
  readonly isActive: boolean;
}

export interface Slot {
  readonly id: number;
  readonly projectId: number;
  readonly dayIndex: number;
  readonly startMinutes: number;
  readonly durationMinutes: number;
  readonly title: Bytes;
  readonly notes: Bytes;
}

export interface CalendarSlotView {
  readonly id: number;
  readonly projectId: number;
  readonly projectName: Bytes;
  readonly clientName: Bytes;
  readonly dayIndex: number;
  readonly dayOffset: number;
  readonly startMinutes: number;
  readonly durationMinutes: number;
  readonly timeLabel: Bytes;
  readonly durationLabel: Bytes;
  readonly title: Bytes;
  readonly notesPreview: Bytes;
  readonly hasTitle: boolean;
  readonly hasNotes: boolean;
  readonly projectIsActive: boolean;
  readonly isCurrent: boolean;
  readonly currentStatusLabel: Bytes;
}

export interface CalendarDayView {
  readonly dayIndex: number;
  readonly dayOffset: number;
  readonly weekday: Bytes;
  readonly dateLabel: Bytes;
  readonly isToday: boolean;
  readonly hasSlots: boolean;
  readonly hasHiddenSlots: boolean;
  readonly totalMinutes: number;
  readonly slotCount: number;
  readonly totalLabel: Bytes;
  readonly hiddenSlotCountLabel: Bytes;
}

export interface MonthCalendarDayView {
  readonly dayIndex: number;
  readonly dayNumberLabel: Bytes;
  readonly dateLabel: Bytes;
  readonly accessibilityLabel: Bytes;
  readonly isAvailable: boolean;
  readonly inMonth: boolean;
  readonly isToday: boolean;
  readonly hasSlots: boolean;
  readonly totalLabel: Bytes;
  readonly slotCountLabel: Bytes;
  readonly primarySlotLabel: Bytes;
  readonly hasPrimarySlotLabel: boolean;
  readonly hasCurrentSlot: boolean;
  readonly currentSlotDisplayName: Bytes;
}

export interface ClientRow {
  readonly id: number;
  readonly name: Bytes;
  readonly contact: Bytes;
  readonly notesPreview: Bytes;
  readonly hasContact: boolean;
  readonly hasNotes: boolean;
  readonly projectCount: number;
  readonly projectCountLabel: Bytes;
  readonly targetMinutes: number;
  readonly targetLabel: Bytes;
  readonly allocatedMinutes: number;
  readonly allocatedLabel: Bytes;
}

export interface ProjectRow {
  readonly id: number;
  readonly clientId: number;
  readonly name: Bytes;
  readonly clientName: Bytes;
  readonly targetMinutes: number;
  readonly targetLabel: Bytes;
  readonly weekMinutes: number;
  readonly weekLabel: Bytes;
  readonly remainingMinutes: number;
  readonly remainingLabel: Bytes;
  readonly isOver: boolean;
  readonly isActive: boolean;
  readonly statusLabel: Bytes;
  readonly toggleLabel: Bytes;
  readonly canDecreaseTarget: boolean;
  readonly canIncreaseTarget: boolean;
}

export interface ReportRow {
  readonly projectId: number;
  readonly projectName: Bytes;
  readonly clientName: Bytes;
  readonly targetMinutes: number;
  readonly targetLabel: Bytes;
  readonly allocatedMinutes: number;
  readonly allocatedLabel: Bytes;
  readonly deltaMinutes: number;
  readonly deltaLabel: Bytes;
  readonly isOver: boolean;
  readonly isActive: boolean;
}

export interface PickerOption {
  readonly id: number;
  readonly label: Bytes;
  readonly secondary: Bytes;
  readonly selected: boolean;
}

export interface StoredData {
  readonly nextClientId: number;
  readonly nextProjectId: number;
  readonly nextSlotId: number;
  readonly clients: readonly Client[];
  readonly projects: readonly Project[];
  readonly slots: readonly Slot[];
}

export interface Model {
  readonly activeView: ActiveView;
  readonly calendarMode: CalendarMode;
  readonly reportPeriod: ReportPeriod;
  readonly clients: readonly Client[];
  readonly projects: readonly Project[];
  readonly slots: readonly Slot[];
  readonly nextClientId: number;
  readonly nextProjectId: number;
  readonly nextSlotId: number;
  readonly currentDayIndex: number;
  readonly currentMinuteOfDay: number;
  readonly calendarAnchorDay: number;
  readonly weekStartDay: number;
  readonly reportAnchorDay: number;
  readonly sidebarFraction: number;
  readonly hasClock: boolean;
  readonly loading: boolean;
  readonly storageReady: boolean;
  readonly storageBlocked: boolean;
  readonly dataPath: Bytes;
  readonly dataRevision: number;
  readonly writeInFlight: boolean;
  readonly writeRevision: number;
  readonly recoveryWarning: boolean;
  readonly statusText: Bytes;
  readonly validationText: Bytes;
  readonly clientModalOpen: boolean;
  readonly projectModalOpen: boolean;
  readonly slotModalOpen: boolean;
  readonly clientPickerOpen: boolean;
  readonly slotProjectPickerOpen: boolean;
  readonly clientNameEdit: TextEditState;
  readonly clientContactEdit: TextEditState;
  readonly clientNotesEdit: TextEditState;
  readonly projectNameEdit: TextEditState;
  readonly projectClientId: number;
  readonly projectTargetHours: number;
  readonly slotTitleEdit: TextEditState;
  readonly slotNotesEdit: TextEditState;
  readonly slotEditingId: number;
  readonly slotProjectId: number;
  readonly slotDayOffset: number;
  readonly slotStartMinutes: number;
  readonly slotDurationMinutes: number;
  readonly clientDetailsId: number;
  readonly slotDetailsId: number;
  readonly deleteKind: DeleteKind;
  readonly deleteTargetId: number;
  readonly deleteTargetName: Bytes;
  readonly calendarNavigated: boolean;
  readonly reportNavigated: boolean;
  readonly calendarNowPending: boolean;
  readonly calendarLocalPending: boolean;
  readonly reportNowPending: boolean;
  readonly reportLocalPending: boolean;
}

export type Msg =
  | { readonly kind: "show_calendar" }
  | { readonly kind: "show_clients" }
  | { readonly kind: "show_projects" }
  | { readonly kind: "show_reports" }
  | { readonly kind: "toggle_sidebar" }
  | { readonly kind: "sidebar_resized"; readonly fraction: number }
  | { readonly kind: "set_calendar_day" }
  | { readonly kind: "set_calendar_week" }
  | { readonly kind: "set_calendar_month" }
  | { readonly kind: "calendar_previous" }
  | { readonly kind: "calendar_next" }
  | { readonly kind: "open_calendar_day"; readonly dayIndex: number }
  | { readonly kind: "go_today" }
  | { readonly kind: "open_client_modal" }
  | { readonly kind: "close_client_modal" }
  | { readonly kind: "client_name_edit"; readonly edit: TextInputEvent }
  | { readonly kind: "client_contact_edit"; readonly edit: TextInputEvent }
  | { readonly kind: "client_notes_edit"; readonly edit: TextInputEvent }
  | { readonly kind: "save_client" }
  | { readonly kind: "open_client_details"; readonly clientId: number }
  | { readonly kind: "close_client_details" }
  | { readonly kind: "delete_client"; readonly clientId: number }
  | { readonly kind: "open_project_modal" }
  | { readonly kind: "close_project_modal" }
  | { readonly kind: "project_name_edit"; readonly edit: TextInputEvent }
  | { readonly kind: "toggle_client_picker" }
  | { readonly kind: "select_project_client"; readonly clientId: number }
  | { readonly kind: "project_target_less" }
  | { readonly kind: "project_target_more" }
  | { readonly kind: "decrease_project_target"; readonly projectId: number }
  | { readonly kind: "increase_project_target"; readonly projectId: number }
  | { readonly kind: "toggle_project_active"; readonly projectId: number }
  | { readonly kind: "save_project" }
  | { readonly kind: "delete_project"; readonly projectId: number }
  | { readonly kind: "open_slot_modal" }
  | { readonly kind: "open_slot_for_day"; readonly dayOffset: number }
  | { readonly kind: "edit_slot"; readonly slotId: number }
  | { readonly kind: "close_slot_modal" }
  | { readonly kind: "slot_title_edit"; readonly edit: TextInputEvent }
  | { readonly kind: "slot_notes_edit"; readonly edit: TextInputEvent }
  | { readonly kind: "toggle_slot_project_picker" }
  | { readonly kind: "select_slot_project"; readonly projectId: number }
  | { readonly kind: "slot_day_previous" }
  | { readonly kind: "slot_day_next" }
  | { readonly kind: "slot_start_earlier" }
  | { readonly kind: "slot_start_later" }
  | { readonly kind: "slot_duration_less" }
  | { readonly kind: "slot_duration_more" }
  | { readonly kind: "save_slot" }
  | { readonly kind: "open_slot_details"; readonly slotId: number }
  | { readonly kind: "close_slot_details" }
  | { readonly kind: "delete_slot"; readonly slotId: number }
  | { readonly kind: "set_report_weekly" }
  | { readonly kind: "set_report_monthly" }
  | { readonly kind: "report_previous" }
  | { readonly kind: "report_next" }
  | { readonly kind: "report_today" }
  | { readonly kind: "confirm_delete" }
  | { readonly kind: "cancel_delete" }
  | { readonly kind: "clock_ready"; readonly at: number }
  | { readonly kind: "local_date_ready"; readonly code: number; readonly output: Bytes }
  | { readonly kind: "local_date_failed"; readonly reason: Bytes }
  | { readonly kind: "calendar_today_ready"; readonly at: number }
  | { readonly kind: "calendar_local_date_ready"; readonly code: number; readonly output: Bytes }
  | { readonly kind: "calendar_local_date_failed"; readonly reason: Bytes }
  | { readonly kind: "report_today_ready"; readonly at: number }
  | { readonly kind: "report_local_date_ready"; readonly code: number; readonly output: Bytes }
  | { readonly kind: "report_local_date_failed"; readonly reason: Bytes }
  | { readonly kind: "home_ready"; readonly value: Bytes }
  | { readonly kind: "recovery_loaded"; readonly bytes: Bytes }
  | { readonly kind: "recovery_load_failed"; readonly reason: Bytes }
  | { readonly kind: "recovery_committed"; readonly code: number; readonly output: Bytes }
  | { readonly kind: "recovery_commit_failed"; readonly reason: Bytes }
  | { readonly kind: "data_loaded"; readonly bytes: Bytes }
  | { readonly kind: "data_load_failed"; readonly reason: Bytes }
  | { readonly kind: "data_staged" }
  | { readonly kind: "data_committed"; readonly code: number; readonly output: Bytes }
  | { readonly kind: "data_commit_failed"; readonly reason: Bytes }
  | { readonly kind: "data_save_failed"; readonly reason: Bytes };
