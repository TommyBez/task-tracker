import { asciiBytes } from "@native-sdk/core";
import { bytesPreview, concat3, concat5 } from "../core-bytes.ts";
import {
  DATE_SEPARATOR,
  EMPTY,
  MAX_DAY_INDEX,
  MAX_WEEK_SLOT_PREVIEWS_PER_DAY,
  MINUTES_PER_DAY,
  SLOT_NOTES_PREVIEW_BYTES,
  SPACE,
} from "../core-constants.ts";
import {
  calendarPeriodEnd,
  calendarPeriodStart,
  civilFromDay,
  formatDateLong,
  formatDateShort,
  monthLong,
  monthStartFor,
  unboundedWeekStartFor,
  weekdayName,
} from "../core-dates.ts";
import { minutesLabel, timeRangeLabel } from "../core-format.ts";
import { projectById, projectClientName } from "../core-queries.ts";
import type { Bytes, CalendarDayView, CalendarSlotView, Model, MonthCalendarDayView, Slot } from "../core-types.ts";

export function deriveHasSlotsThisWeek(model: Model): boolean {
  return model.slots.some((slot) => slot.dayIndex >= model.weekStartDay && slot.dayIndex < model.weekStartDay + 7);
}

export function deriveHasCalendarDaySlots(model: Model): boolean {
  return model.slots.some((slot) => slot.dayIndex === model.calendarAnchorDay);
}

export function deriveSlotCountLabel(model: Model): Bytes {
  let count = 0;
  const start = calendarPeriodStart(model);
  const end = calendarPeriodEnd(model);
  for (const slot of model.slots) if (slot.dayIndex >= start && slot.dayIndex < end) count += 1;
  if (count === 1) return asciiBytes("1 slot");
  return asciiBytes(`${count} slots`);
}

export function deriveCalendarTotalLabel(model: Model): Bytes {
  let total = 0;
  const start = calendarPeriodStart(model);
  const end = calendarPeriodEnd(model);
  for (const slot of model.slots) if (slot.dayIndex >= start && slot.dayIndex < end) total += slot.durationMinutes;
  return minutesLabel(total);
}

export function deriveCalendarPlannedProjectCountLabel(model: Model): Bytes {
  const projectIds: number[] = [];
  const start = calendarPeriodStart(model);
  const end = calendarPeriodEnd(model);
  for (const slot of model.slots) {
    if (slot.dayIndex < start || slot.dayIndex >= end) continue;
    let found = false;
    for (const projectId of projectIds) if (projectId === slot.projectId) found = true;
    if (!found) projectIds.push(slot.projectId);
  }
  if (projectIds.length === 1) return asciiBytes("1 planned project");
  return asciiBytes(`${projectIds.length} planned projects`);
}

export function deriveCalendarModeLabel(model: Model): Bytes {
  if (model.calendarMode === "day") return asciiBytes("Day");
  if (model.calendarMode === "month") return asciiBytes("Month");
  return asciiBytes("Week");
}

export function derivePreviousCalendarLabel(model: Model): Bytes {
  if (model.calendarMode === "day") return asciiBytes("Previous day");
  if (model.calendarMode === "month") return asciiBytes("Previous month");
  return asciiBytes("Previous week");
}

export function deriveNextCalendarLabel(model: Model): Bytes {
  if (model.calendarMode === "day") return asciiBytes("Next day");
  if (model.calendarMode === "month") return asciiBytes("Next month");
  return asciiBytes("Next week");
}

export function deriveCalendarRangeLabel(model: Model): Bytes {
  const start = calendarPeriodStart(model);
  if (model.calendarMode === "day") return formatDateLong(start);
  if (model.calendarMode === "month") {
    const date = civilFromDay(start);
    return concat3(monthLong(date.month), SPACE, asciiBytes(`${date.year}`));
  }
  return concat3(formatDateLong(start), DATE_SEPARATOR, formatDateLong(calendarPeriodEnd(model) - 1));
}

export function deriveWeekLabel(model: Model): Bytes {
  const start = civilFromDay(model.weekStartDay);
  const end = civilFromDay(model.weekStartDay + 6);
  const left = formatDateShort(model.weekStartDay);
  const right = formatDateShort(model.weekStartDay + 6);
  if (start.year === end.year) return concat5(left, DATE_SEPARATOR, right, SPACE, asciiBytes(`${end.year}`));
  return concat3(formatDateLong(model.weekStartDay), DATE_SEPARATOR, formatDateLong(model.weekStartDay + 6));
}

function compareSlotsByDayAndTime(a: Slot, b: Slot): number {
  if (a.dayIndex !== b.dayIndex) return a.dayIndex - b.dayIndex;
  if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
  return a.id - b.id;
}

function isCurrentSlot(model: Model, slot: Slot): boolean {
  return model.currentMinuteOfDay < MINUTES_PER_DAY
    && slot.dayIndex === model.currentDayIndex
    && slot.startMinutes <= model.currentMinuteOfDay
    && model.currentMinuteOfDay < slot.startMinutes + slot.durationMinutes;
}

function calendarDay(model: Model, dayOffset: number): CalendarDayView {
  const dayIndex = model.weekStartDay + dayOffset;
  let totalMinutes = 0;
  let slotCount = 0;
  for (const slot of model.slots) {
    if (slot.dayIndex !== dayIndex) continue;
    totalMinutes += slot.durationMinutes;
    slotCount += 1;
  }
  const hiddenSlotCount = Math.max(0, slotCount - MAX_WEEK_SLOT_PREVIEWS_PER_DAY);
  return {
    dayIndex: dayIndex,
    dayOffset: dayOffset,
    weekday: weekdayName((dayIndex + 3) % 7),
    dateLabel: formatDateShort(dayIndex),
    isToday: dayIndex === model.currentDayIndex,
    hasSlots: slotCount > 0,
    hasHiddenSlots: hiddenSlotCount > 0,
    totalMinutes: totalMinutes,
    slotCount: slotCount,
    totalLabel: minutesLabel(totalMinutes),
    hiddenSlotCountLabel: hiddenSlotCount === 1 ? asciiBytes("1 more slot") : asciiBytes(`${hiddenSlotCount} more slots`),
  };
}

export function deriveCalendarDays(model: Model): readonly CalendarDayView[] {
  const days: CalendarDayView[] = [];
  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) days.push(calendarDay(model, dayOffset));
  return days;
}

function calendarSlot(model: Model, slot: Slot, dayOffset: number): CalendarSlotView | null {
  const project = projectById(model.projects, slot.projectId);
  if (project === null) return null;
  const isCurrent = isCurrentSlot(model, slot);
  return {
    id: slot.id,
    projectId: slot.projectId,
    projectName: project.name,
    clientName: projectClientName(model, project),
    dayIndex: slot.dayIndex,
    dayOffset: dayOffset,
    startMinutes: slot.startMinutes,
    durationMinutes: slot.durationMinutes,
    timeLabel: timeRangeLabel(slot.startMinutes, slot.durationMinutes),
    durationLabel: minutesLabel(slot.durationMinutes),
    title: slot.title,
    notesPreview: bytesPreview(slot.notes, SLOT_NOTES_PREVIEW_BYTES),
    hasTitle: slot.title.length > 0,
    hasNotes: slot.notes.length > 0,
    projectIsActive: project.isActive,
    isCurrent: isCurrent,
    currentStatusLabel: isCurrent ? asciiBytes("Scheduled now. ") : EMPTY,
  };
}

export function deriveCalendarSlots(model: Model): readonly CalendarSlotView[] {
  const ordered = model.slots
    .filter((slot) => slot.dayIndex >= model.weekStartDay && slot.dayIndex < model.weekStartDay + 7)
    .toSorted(compareSlotsByDayAndTime);
  const visibleSlots: CalendarSlotView[] = [];
  const visiblePerDay = [0, 0, 0, 0, 0, 0, 0];
  for (const slot of ordered) {
    const dayOffset = slot.dayIndex - model.weekStartDay;
    if (dayOffset < 0 || dayOffset > 6) continue;
    const view = calendarSlot(model, slot, dayOffset);
    if (view === null) continue;
    if (visiblePerDay[dayOffset] >= MAX_WEEK_SLOT_PREVIEWS_PER_DAY) {
      if (view.isCurrent) visibleSlots[visibleSlots.length - 1] = view;
      continue;
    }
    visiblePerDay[dayOffset] += 1;
    visibleSlots.push(view);
  }
  return visibleSlots;
}

export function deriveCalendarDaySlots(model: Model): readonly CalendarSlotView[] {
  const ordered = model.slots
    .filter((slot) => slot.dayIndex === model.calendarAnchorDay)
    .toSorted(compareSlotsByDayAndTime);
  const visibleSlots: CalendarSlotView[] = [];
  for (const slot of ordered) {
    const view = calendarSlot(model, slot, slot.dayIndex - model.weekStartDay);
    if (view !== null) visibleSlots.push(view);
  }
  return visibleSlots;
}

export function deriveMonthCalendarDays(model: Model): readonly MonthCalendarDayView[] {
  const anchorDate = civilFromDay(model.calendarAnchorDay);
  const firstDay = monthStartFor(model.calendarAnchorDay);
  const gridStart = unboundedWeekStartFor(firstDay);
  const days: MonthCalendarDayView[] = [];
  for (let offset = 0; offset < 42; offset += 1) {
    const dayIndex = gridStart + offset;
    const date = civilFromDay(dayIndex);
    let totalMinutes = 0;
    let slotCount = 0;
    let primaryProjectId = 0;
    let primaryStartMinutes = MINUTES_PER_DAY + 1;
    let primarySlotId = 0;
    let hasPrimarySlot = false;
    let currentProjectId = 0;
    let currentSlotTitle = EMPTY;
    let hasCurrentSlot = false;
    for (const slot of model.slots) {
      if (slot.dayIndex !== dayIndex) continue;
      totalMinutes += slot.durationMinutes;
      slotCount += 1;
      if (!hasPrimarySlot || slot.startMinutes < primaryStartMinutes || (slot.startMinutes === primaryStartMinutes && slot.id < primarySlotId)) {
        primaryProjectId = slot.projectId;
        primaryStartMinutes = slot.startMinutes;
        primarySlotId = slot.id;
        hasPrimarySlot = true;
      }
      if (isCurrentSlot(model, slot)) {
        currentProjectId = slot.projectId;
        currentSlotTitle = slot.title;
        hasCurrentSlot = true;
      }
    }
    const primaryProject = projectById(model.projects, primaryProjectId);
    const currentProject = projectById(model.projects, currentProjectId);
    const displaysCurrentSlot = hasCurrentSlot && currentProject !== null;
    const currentSlotDisplayName = currentSlotTitle.length > 0
      ? currentSlotTitle
      : currentProject === null ? EMPTY : currentProject.name;
    const slotSummary = slotCount === 1 ? asciiBytes("1 slot") : asciiBytes(`${slotCount} slots`);
    const baseLabel = concat5(formatDateLong(dayIndex), asciiBytes(", "), slotSummary, asciiBytes(", "), minutesLabel(totalMinutes));
    const detailedLabel = displaysCurrentSlot
      ? concat3(baseLabel, asciiBytes(", scheduled now, "), currentSlotDisplayName)
      : primaryProject === null ? baseLabel : concat3(baseLabel, asciiBytes(", "), primaryProject.name);
    days.push({
      dayIndex: dayIndex,
      dayNumberLabel: asciiBytes(`${date.day}`),
      dateLabel: formatDateShort(dayIndex),
      accessibilityLabel: detailedLabel,
      isAvailable: dayIndex >= 0 && dayIndex <= MAX_DAY_INDEX,
      inMonth: date.year === anchorDate.year && date.month === anchorDate.month,
      isToday: dayIndex === model.currentDayIndex,
      hasSlots: slotCount > 0,
      totalLabel: minutesLabel(totalMinutes),
      slotCountLabel: slotSummary,
      primaryProjectName: primaryProject === null ? EMPTY : primaryProject.name,
      hasPrimaryProject: primaryProject !== null,
      hasCurrentSlot: displaysCurrentSlot,
      currentSlotDisplayName: currentSlotDisplayName,
    });
  }
  return days;
}
