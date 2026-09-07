import { asciiBytes } from "@native-sdk/core";
import { concat2, concat3 } from "./core-bytes.ts";
import { EMPTY, MAX_DAY_INDEX } from "./core-constants.ts";
import { civilFromDay, clampDayIndex, daysInMonth, formatDateLong, monthLong, monthStartFor, parseLocalDay, shiftCalendarMonth, unboundedWeekStartFor } from "./core-dates.ts";
import { createTextEdit } from "./core-state.ts";
import { isoDay } from "./export-data.ts";
import type { ExportCalendarDay, ExportDayVariant } from "./export-types.ts";
import type { Bytes, Model, Msg } from "./core-types.ts";

export function exportCalendarMonthLabel(model: Model): Bytes {
  const date = civilFromDay(model.csvExport.monthAnchor);
  return concat3(monthLong(date.month), asciiBytes(" "), asciiBytes(`${date.year}`));
}

export function exportCalendarDays(model: Model): readonly ExportCalendarDay[] {
  const state = model.csvExport;
  const monthStart = monthStartFor(state.monthAnchor);
  const month = civilFromDay(monthStart);
  const monthEnd = monthStart + daysInMonth(month.year, month.month);
  const gridStart = unboundedWeekStartFor(monthStart);
  const from = parseLocalDay(state.startEdit.text) ?? -1;
  const to = parseLocalDay(state.endEdit.text) ?? -1;
  const current = state.datePicker === "start" ? from : to;
  const focusDay = current >= monthStart && current < monthEnd ? current : monthStart;
  const days: ExportCalendarDay[] = [];
  for (let i = 0; i < 42; i += 1) {
    const day = gridStart + i;
    const safeDay = clampDayIndex(day);
    const disabled = day < monthStart || day >= monthEnd || day < 0 || day > MAX_DAY_INDEX;
    const endpoint = day === from || day === to;
    const today = day === model.currentDayIndex;
    const inRange = !disabled && from >= 0 && to >= from && day >= from && day <= to;
    let variant: ExportDayVariant = "ghost";
    if (inRange) variant = "secondary";
    if (today) variant = "outline";
    if (endpoint && !disabled) variant = "primary";
    let label = formatDateLong(safeDay);
    if (day === from) label = concat2(label, asciiBytes(", start date"));
    if (day === to) label = concat2(label, asciiBytes(", end date"));
    if (today) label = concat2(label, asciiBytes(", today"));
    days.push({ dayIndex: day, label: day < 0 || day > MAX_DAY_INDEX ? EMPTY : asciiBytes(`${civilFromDay(safeDay).day}`),
      accessibilityLabel: label, disabled: disabled, variant: variant,
      inRange: inRange,
      focus: !disabled && day === focusDay });
  }
  return days;
}

function applyExportRange(model: Model, from: number, to: number): Model {
  return { ...model, csvExport: { ...model.csvExport,
    startEdit: createTextEdit(isoDay(clampDayIndex(from))), endEdit: createTextEdit(isoDay(clampDayIndex(to))),
    monthAnchor: monthStartFor(clampDayIndex(from)), datePicker: "none", pickerOpen: false,
    phase: "idle", error: EMPTY, path: EMPTY } };
}

export function reduceExportCalendar(model: Model, msg: Msg): Model {
  const state = model.csvExport;
  if (!state.open || state.phase === "clock" || state.phase === "choosing" || state.phase === "writing") return model;
  switch (msg.kind) {
    case "csv_open_start":
    case "csv_open_end": {
      const openingStart = msg.kind === "csv_open_start";
      const alreadyOpen = openingStart ? state.datePicker === "start" : state.datePicker === "end";
      const day = parseLocalDay(openingStart ? state.startEdit.text : state.endEdit.text) ?? model.currentDayIndex;
      return { ...model, csvExport: { ...state, pickerOpen: false,
        datePicker: alreadyOpen ? "none" : openingStart ? "start" : "end", monthAnchor: monthStartFor(day) } };
    }
    case "csv_close_dates":
      return { ...model, csvExport: { ...state, datePicker: "none" } };
    case "csv_previous_month":
    case "csv_next_month":
      if (state.datePicker === "none") return model;
      return { ...model, csvExport: { ...state,
        monthAnchor: monthStartFor(shiftCalendarMonth(state.monthAnchor, msg.kind === "csv_previous_month" ? -1 : 1)) } };
    case "csv_pick_date": {
      if (state.datePicker === "none" || msg.dayIndex < 0 || msg.dayIndex > MAX_DAY_INDEX) return model;
      const selectedMonth = monthStartFor(msg.dayIndex);
      if (selectedMonth !== state.monthAnchor) return model;
      const from = parseLocalDay(state.startEdit.text) ?? msg.dayIndex;
      const to = parseLocalDay(state.endEdit.text) ?? msg.dayIndex;
      if (state.datePicker === "start") return applyExportRange(model, msg.dayIndex, Math.max(to, msg.dayIndex));
      return applyExportRange(model, Math.min(from, msg.dayIndex), msg.dayIndex);
    }
    case "csv_this_week": {
      const start = unboundedWeekStartFor(model.currentDayIndex);
      return applyExportRange(model, start, start + 6);
    }
    case "csv_last_week": {
      const start = unboundedWeekStartFor(model.currentDayIndex) - 7;
      return applyExportRange(model, start, start + 6);
    }
    case "csv_this_month": {
      const start = monthStartFor(model.currentDayIndex);
      const date = civilFromDay(start);
      return applyExportRange(model, start, start + daysInMonth(date.year, date.month) - 1);
    }
    case "csv_last_month": {
      const end = monthStartFor(model.currentDayIndex) - 1;
      return applyExportRange(model, monthStartFor(clampDayIndex(end)), end);
    }
    default: return model;
  }
}
