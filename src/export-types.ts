import type { TextEditState } from "@native-sdk/core/text";
import type { Bytes } from "./core-types.ts";
export type ExportScope = "project" | "client";
export type ExportPhase = "idle" | "clock" | "choosing" | "writing" | "saved";

export interface ExportState {
  readonly open: boolean;
  readonly scope: ExportScope;
  readonly targetId: number;
  readonly pickerOpen: boolean;
  readonly startEdit: TextEditState;
  readonly endEdit: TextEditState;
  readonly phase: ExportPhase;
  readonly path: Bytes;
  readonly error: Bytes;
  readonly cutoffDay: number;
  readonly cutoffMinute: number;
}
