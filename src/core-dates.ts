import { asciiBytes } from "@native-sdk/core";
import { concat3 } from "./core-bytes.ts";
import { MAX_DAY_INDEX, MS_PER_DAY, SPACE } from "./core-constants.ts";
import type { Bytes, Model } from "./core-types.ts";

export interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export function intDiv(n: number, d: number): number {
  if (n <= 0 || d <= 0) return 0;
  let quotient = 0;
  let remainder = n;
  while (remainder >= d) {
    let step = d;
    let count = 1;
    while (step + step <= remainder) {
      step += step;
      count += count;
    }
    remainder -= step;
    quotient += count;
  }
  return quotient;
}

export function dayFromTimestamp(at: number): number {
  if (at <= 0) return 0;
  return Math.min(MAX_DAY_INDEX, intDiv(at, MS_PER_DAY));
}

export function weekStartFor(dayIndex: number): number {
  return Math.max(0, Math.min(MAX_DAY_INDEX - 6, unboundedWeekStartFor(dayIndex)));
}

export function unboundedWeekStartFor(dayIndex: number): number {
  const rawWeekday = (dayIndex + 3) % 7;
  const weekday = rawWeekday < 0 ? rawWeekday + 7 : rawWeekday;
  return dayIndex - weekday;
}

export function civilFromDay(dayIndex: number): CivilDate {
  const z = dayIndex + 719468;
  const era = intDiv(z, 146097);
  const dayOfEra = z - era * 146097;
  const yearOfEra = intDiv(
    dayOfEra - intDiv(dayOfEra, 1460) + intDiv(dayOfEra, 36524) - intDiv(dayOfEra, 146096),
    365,
  );
  let year = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + intDiv(yearOfEra, 4) - intDiv(yearOfEra, 100));
  const monthPosition = intDiv(5 * dayOfYear + 2, 153);
  const day = dayOfYear - intDiv(153 * monthPosition + 2, 5) + 1;
  let month = monthPosition + 3;
  if (monthPosition >= 10) month = monthPosition - 9;
  if (month <= 2) year += 1;
  return { year: year, month: month, day: day };
}

function isLeapYear(year: number): boolean {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

export function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2: return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11: return 30;
    default: return 31;
  }
}

export function monthStartFor(dayIndex: number): number {
  const date = civilFromDay(dayIndex);
  return dayIndex - date.day + 1;
}

function dayFromCivil(year: number, month: number, day: number): number {
  let adjustedYear = year;
  if (month <= 2) adjustedYear -= 1;
  const era = intDiv(adjustedYear, 400);
  const yearOfEra = adjustedYear - era * 400;
  let monthPosition = month - 3;
  if (month <= 2) monthPosition = month + 9;
  const dayOfYear = intDiv(153 * monthPosition + 2, 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + intDiv(yearOfEra, 4) - intDiv(yearOfEra, 100) + dayOfYear;
  return era * 146097 + dayOfEra - 719468;
}

export function clampDayIndex(dayIndex: number): number {
  return Math.max(0, Math.min(MAX_DAY_INDEX, dayIndex));
}

export function shiftCalendarMonth(dayIndex: number, direction: number): number {
  const date = civilFromDay(clampDayIndex(dayIndex));
  let year = date.year;
  let month = date.month + direction;
  if (month < 1) {
    month = 12;
    year -= 1;
  } else if (month > 12) {
    month = 1;
    year += 1;
  }
  const day = Math.min(date.day, daysInMonth(year, month));
  return clampDayIndex(dayFromCivil(year, month, day));
}

export function calendarPeriodStart(model: Model): number {
  if (model.calendarMode === "day") return clampDayIndex(model.calendarAnchorDay);
  if (model.calendarMode === "week") return weekStartFor(model.calendarAnchorDay);
  return Math.max(0, monthStartFor(model.calendarAnchorDay));
}

export function calendarPeriodEnd(model: Model): number {
  const start = calendarPeriodStart(model);
  if (model.calendarMode === "day") return Math.min(MAX_DAY_INDEX + 1, start + 1);
  if (model.calendarMode === "week") return Math.min(MAX_DAY_INDEX + 1, start + 7);
  const date = civilFromDay(start);
  return Math.min(MAX_DAY_INDEX + 1, start + daysInMonth(date.year, date.month));
}

function digitValue(byte: number): number {
  if (byte < 48 || byte > 57) return -1;
  return byte - 48;
}

export function parseLocalDay(output: Bytes): number | null {
  const text = output.trim();
  if (text.length !== 10 || text[4] !== 45 || text[7] !== 45) return null;
  const y0 = digitValue(text[0]);
  const y1 = digitValue(text[1]);
  const y2 = digitValue(text[2]);
  const y3 = digitValue(text[3]);
  const m0 = digitValue(text[5]);
  const m1 = digitValue(text[6]);
  const d0 = digitValue(text[8]);
  const d1 = digitValue(text[9]);
  if (y0 < 0 || y1 < 0 || y2 < 0 || y3 < 0 || m0 < 0 || m1 < 0 || d0 < 0 || d1 < 0) return null;
  const year = y0 * 1000 + y1 * 100 + y2 * 10 + y3;
  const month = m0 * 10 + m1;
  const day = d0 * 10 + d1;
  if (year < 1970 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  const localDay = dayFromCivil(year, month, day);
  if (localDay < 0 || localDay > MAX_DAY_INDEX) return null;
  return localDay;
}

export function monthShort(month: number): Bytes {
  switch (month) {
    case 1: return asciiBytes("Jan");
    case 2: return asciiBytes("Feb");
    case 3: return asciiBytes("Mar");
    case 4: return asciiBytes("Apr");
    case 5: return asciiBytes("May");
    case 6: return asciiBytes("Jun");
    case 7: return asciiBytes("Jul");
    case 8: return asciiBytes("Aug");
    case 9: return asciiBytes("Sep");
    case 10: return asciiBytes("Oct");
    case 11: return asciiBytes("Nov");
    default: return asciiBytes("Dec");
  }
}

export function monthLong(month: number): Bytes {
  switch (month) {
    case 1: return asciiBytes("January");
    case 2: return asciiBytes("February");
    case 3: return asciiBytes("March");
    case 4: return asciiBytes("April");
    case 5: return asciiBytes("May");
    case 6: return asciiBytes("June");
    case 7: return asciiBytes("July");
    case 8: return asciiBytes("August");
    case 9: return asciiBytes("September");
    case 10: return asciiBytes("October");
    case 11: return asciiBytes("November");
    default: return asciiBytes("December");
  }
}

export function weekdayName(dayOffset: number): Bytes {
  switch (dayOffset) {
    case 0: return asciiBytes("Mon");
    case 1: return asciiBytes("Tue");
    case 2: return asciiBytes("Wed");
    case 3: return asciiBytes("Thu");
    case 4: return asciiBytes("Fri");
    case 5: return asciiBytes("Sat");
    default: return asciiBytes("Sun");
  }
}

export function formatDateShort(dayIndex: number): Bytes {
  const date = civilFromDay(dayIndex);
  return concat3(monthShort(date.month), SPACE, asciiBytes(`${date.day}`));
}

export function formatDateLong(dayIndex: number): Bytes {
  const date = civilFromDay(dayIndex);
  return concat3(monthLong(date.month), SPACE, concat3(asciiBytes(`${date.day}`), asciiBytes(", "), asciiBytes(`${date.year}`)));
}
