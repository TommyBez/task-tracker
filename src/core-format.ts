import { asciiBytes } from "@native-sdk/core";
import { concat2, concat3 } from "./core-bytes.ts";
import { DATE_SEPARATOR } from "./core-constants.ts";
import { intDiv } from "./core-dates.ts";
import type { Bytes } from "./core-types.ts";

export function minutesLabel(minutes: number): Bytes {
  const safeMinutes = minutes < 0 ? -minutes : minutes;
  const hours = intDiv(safeMinutes, 60);
  const rest = safeMinutes % 60;
  if (rest === 0) return asciiBytes(`${hours} h`);
  return asciiBytes(`${hours} h ${rest} min`);
}

export function signedMinutesLabel(minutes: number): Bytes {
  if (minutes > 0) return concat2(asciiBytes("+"), minutesLabel(minutes));
  if (minutes < 0) return concat2(asciiBytes("-"), minutesLabel(minutes));
  return asciiBytes("0 h");
}

export function timeLabel(minutes: number): Bytes {
  const hour = intDiv(minutes, 60);
  const minute = minutes % 60;
  const hh = asciiBytes(`${hour}`).padStart(2, asciiBytes("0"));
  const mm = asciiBytes(`${minute}`).padStart(2, asciiBytes("0"));
  return concat3(hh, asciiBytes(":"), mm);
}

export function timeRangeLabel(startMinutes: number, durationMinutes: number): Bytes {
  return concat3(timeLabel(startMinutes), DATE_SEPARATOR, timeLabel(startMinutes + durationMinutes));
}
