import { asciiBytes } from "@native-sdk/core";
import { applyTextInputEvent, clampedInsertEvent } from "@native-sdk/core/text";
import type { TextEditState, TextInputEvent } from "@native-sdk/core/text";
import { DEFAULT_SIDEBAR_FRACTION, EMPTY, MINUTES_PER_DAY } from "./core-constants.ts";
import type { Model } from "./core-types.ts";

export function createEmptyEdit(): TextEditState {
  return createTextEdit(EMPTY);
}

export function createTextEdit(text: Uint8Array): TextEditState {
  return {
    text: text,
    selection: { anchor: text.length, focus: text.length },
    composition: null,
  };
}

export function applyEdit(state: TextEditState, edit: TextInputEvent, capacity: number): TextEditState {
  const applied = applyTextInputEvent(state, edit, capacity);
  if (applied !== null) return applied;
  const clamped = clampedInsertEvent(state, edit, capacity);
  if (clamped === null) return state;
  const recovered = applyTextInputEvent(state, clamped, capacity);
  return recovered ?? state;
}

export function createInitialState(): Model {
  return {
    csvExport: { open: false, scope: "project", targetId: -1, pickerOpen: false,
      startEdit: createEmptyEdit(), endEdit: createEmptyEdit(), phase: "idle",
      path: EMPTY, error: EMPTY, cutoffDay: 0, cutoffMinute: 0 },
    activeView: "calendar",
    calendarMode: "week",
    reportPeriod: "weekly",
    clients: [],
    projects: [],
    slots: [],
    nextClientId: 1,
    nextProjectId: 1,
    nextSlotId: 1,
    currentDayIndex: 0,
    currentMinuteOfDay: MINUTES_PER_DAY,
    calendarAnchorDay: 0,
    weekStartDay: 0,
    reportAnchorDay: 0,
    sidebarFraction: DEFAULT_SIDEBAR_FRACTION,
    hasClock: false,
    loading: true,
    storageReady: false,
    storageBlocked: false,
    dataPath: EMPTY,
    dataRevision: 0,
    writeInFlight: false,
    writeRevision: 0,
    recoveryWarning: false,
    statusText: asciiBytes("Loading local data..."),
    validationText: EMPTY,
    clientModalOpen: false,
    projectModalOpen: false,
    slotModalOpen: false,
    clientPickerOpen: false,
    slotProjectPickerOpen: false,
    clientNameEdit: createEmptyEdit(),
    clientContactEdit: createEmptyEdit(),
    clientNotesEdit: createEmptyEdit(),
    projectNameEdit: createEmptyEdit(),
    projectClientId: 0,
    projectTargetHours: 10,
    slotTitleEdit: createEmptyEdit(),
    slotNotesEdit: createEmptyEdit(),
    slotEditingId: 0,
    slotProjectId: 0,
    slotDayOffset: 0,
    slotStartMinutes: 540,
    slotDurationMinutes: 60,
    clientDetailsId: 0,
    slotDetailsId: 0,
    deleteKind: "none",
    deleteTargetId: 0,
    deleteTargetName: EMPTY,
    calendarNavigated: false,
    reportNavigated: false,
    calendarNowPending: false,
    calendarLocalPending: false,
    reportNowPending: false,
    reportLocalPending: false,
  };
}
