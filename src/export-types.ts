import type { TextEditState } from "@native-sdk/core/text";
import type { Bytes } from "./core-types.ts";
export type ExportScope = "project" | "client";
export type ExportPhase = "idle" | "clock" | "choosing" | "writing" | "saved";
export type ExportDatePicker = "none" | "start" | "end";
export type ExportDayVariant = "primary" | "secondary" | "outline" | "ghost";

export interface ExportCalendarDay {
  readonly dayIndex: number;
  readonly label: Bytes;
  readonly accessibilityLabel: Bytes;
  readonly inRange: boolean;
  readonly disabled: boolean;
  readonly variant: ExportDayVariant;
  readonly focus: boolean;
}

export interface ExportState {
  readonly open: boolean;
  readonly scope: ExportScope;
  readonly targetId: number;
  readonly pickerOpen: boolean;
  readonly datePicker: ExportDatePicker;
  readonly monthAnchor: number;
  readonly startEdit: TextEditState;
  readonly endEdit: TextEditState;
  readonly phase: ExportPhase;
  readonly path: Bytes;
  readonly error: Bytes;
  readonly cutoffDay: number;
  readonly cutoffMinute: number;
}
