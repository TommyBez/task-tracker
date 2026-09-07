import { asciiBytes } from "@native-sdk/core";
import { concat3, concat5 } from "./core-bytes.ts";
import { civilFromDay, intDiv, parseLocalDay } from "./core-dates.ts";
import { timeLabel } from "./core-format.ts";
import { clientById, projectById } from "./core-queries.ts";
import type { Bytes, Model, Slot } from "./core-types.ts";

// Bound allocation in the native dispatch arena; refuse rather than truncate.
export const MAX_CSV_BYTES = 262144;
const CSV_HEADER = asciiBytes("Date,Start,End,Duration (minutes),Duration (hours),Client,Project,Title,Notes\r\n");

export function isoDay(dayIndex: number): Bytes {
  const date = civilFromDay(dayIndex);
  const month = asciiBytes(`${date.month}`).padStart(2, asciiBytes("0"));
  const day = asciiBytes(`${date.day}`).padStart(2, asciiBytes("0"));
  return concat5(asciiBytes(`${date.year}-`), month, asciiBytes("-"), day, asciiBytes(""));
}

export function exportSlots(model: Model): readonly Slot[] {
  const start = parseLocalDay(model.csvExport.startEdit.text);
  const end = parseLocalDay(model.csvExport.endEdit.text);
  if (start === null) return [];
  if (end === null) return [];
  if (start > end) return [];
  return model.slots.filter((slot) => {
    if (slot.dayIndex < start || slot.dayIndex > end) return false;
    if (slot.dayIndex > model.csvExport.cutoffDay) return false;
    if (slot.dayIndex === model.csvExport.cutoffDay && slot.startMinutes + slot.durationMinutes > model.csvExport.cutoffMinute) return false;
    if (model.csvExport.scope === "project") return slot.projectId === model.csvExport.targetId;
    const project = projectById(model.projects, slot.projectId);
    return project !== null && project.clientId === model.csvExport.targetId;
  }).toSorted((a, b) => {
    if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    return a.id - b.id;
  });
}

function csvTextFields(model: Model, slot: Slot): readonly Bytes[] {
  const project = projectById(model.projects, slot.projectId);
  const client = project === null ? null : clientById(model.clients, project.clientId);
  return [client === null ? asciiBytes("Unassigned") : client.name,
    project === null ? asciiBytes("No project") : project.name, slot.title, slot.notes];
}

function needsFormulaGuard(value: Bytes): boolean {
  const trimmed = value.trimStart();
  const first = trimmed.length > 0 ? trimmed[0] : 0;
  return first === 61 || first === 43 || first === 45 || first === 64
    || (value.length > 0 && (value[0] === 9 || value[0] === 10 || value[0] === 13));
}

function csvPrefix(slot: Slot): Bytes {
  const hours = intDiv(slot.durationMinutes, 60);
  const hundredths = intDiv((slot.durationMinutes % 60) * 100 + 30, 60);
  const decimal = asciiBytes(`${hundredths}`).padStart(2, asciiBytes("0"));
  const times = concat5(isoDay(slot.dayIndex), asciiBytes(","), timeLabel(slot.startMinutes), asciiBytes(","), timeLabel(slot.startMinutes + slot.durationMinutes));
  return concat5(times, asciiBytes(`,${slot.durationMinutes},${hours}.`), decimal, asciiBytes(","), asciiBytes(""));
}

export function csvByteLength(model: Model, slots: readonly Slot[]): number {
  let size = 3 + CSV_HEADER.length;
  for (const slot of slots) {
    size += csvPrefix(slot).length + 5; // three commas and CRLF
    for (const field of csvTextFields(model, slot)) {
      size += field.length + 2;
      if (needsFormulaGuard(field)) size += 1;
      for (const byte of field) if (byte === 34) size += 1;
    }
    if (size > MAX_CSV_BYTES) return size;
  }
  return size;
}

export function encodeCsv(model: Model): Bytes {
  const slots = exportSlots(model);
  const size = csvByteLength(model, slots);
  if (size > MAX_CSV_BYTES) return asciiBytes("");
  const output = new Uint8Array(size);
  output[0] = 239; output[1] = 187; output[2] = 191; // UTF-8 BOM for spreadsheet apps.
  output.set(CSV_HEADER, 3);
  let offset = 3 + CSV_HEADER.length;
  for (const slot of slots) {
    const prefix = csvPrefix(slot);
    output.set(prefix, offset);
    offset += prefix.length;
    const fields = csvTextFields(model, slot);
    for (let i = 0; i < fields.length; i += 1) {
      const field = fields[i];
      output[offset++] = 34;
      if (needsFormulaGuard(field)) output[offset++] = 39;
      for (const byte of field) {
        output[offset++] = byte;
        if (byte === 34) output[offset++] = 34;
      }
      output[offset++] = 34;
      if (i < fields.length - 1) output[offset++] = 44;
    }
    output[offset++] = 13;
    output[offset++] = 10;
  }
  return output;
}

export function exportFilename(model: Model): Bytes {
  const scope = model.csvExport.scope === "client" ? asciiBytes("client") : asciiBytes("project");
  const prefix = concat3(asciiBytes("activities-"), scope, asciiBytes(`-${model.csvExport.targetId}-`));
  return concat5(prefix, model.csvExport.startEdit.text.trim(), asciiBytes("-"), model.csvExport.endEdit.text.trim(), asciiBytes(".csv"));
}

// A fixed script and separate argv keep names/paths out of executable source.
export const CSV_SAVE_DIALOG = asciiBytes("on run argv\ntry\nactivate\nset destination to choose file name with prompt \"Export activities as CSV\" default name (item 1 of argv)\nreturn POSIX path of destination\non error number -128\nreturn \"\"\nend try\nend run");
