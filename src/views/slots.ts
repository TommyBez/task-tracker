import { asciiBytes } from "@native-sdk/core";
import { concat3 } from "../core-bytes.ts";
import { EMPTY, MAX_SLOTS, MAX_SLOTS_PER_WEEK, MINUTES_PER_DAY, SPACE } from "../core-constants.ts";
import { formatDateLong, formatDateShort, weekdayName, weekStartFor } from "../core-dates.ts";
import { minutesLabel, timeLabel, timeRangeLabel } from "../core-format.ts";
import { activeProjectById, countSlotsInWeek, modelCanMutate, projectById, projectClientName } from "../core-queries.ts";
import type { Bytes, Model, PickerOption, Slot } from "../core-types.ts";

export function deriveSlotTitleText(model: Model): Bytes {
  return model.slotTitleEdit.text;
}

export function deriveSlotNotesText(model: Model): Bytes {
  return model.slotNotesEdit.text;
}

function selectedSlotDetails(model: Model): Slot | null {
  const slot = model.slots.find((candidate) => candidate.id === model.slotDetailsId);
  return slot ?? null;
}

export function deriveHasSlotDetails(model: Model): boolean {
  return selectedSlotDetails(model) !== null;
}

export function deriveSlotDetailsDateLabel(model: Model): Bytes {
  const slot = selectedSlotDetails(model);
  return slot === null ? EMPTY : formatDateLong(slot.dayIndex);
}

export function deriveSlotDetailsTimeLabel(model: Model): Bytes {
  const slot = selectedSlotDetails(model);
  return slot === null ? EMPTY : timeRangeLabel(slot.startMinutes, slot.durationMinutes);
}

export function deriveSlotDetailsDurationLabel(model: Model): Bytes {
  const slot = selectedSlotDetails(model);
  return slot === null ? EMPTY : minutesLabel(slot.durationMinutes);
}

export function deriveSlotDetailsProjectLabel(model: Model): Bytes {
  const slot = selectedSlotDetails(model);
  if (slot === null) return EMPTY;
  const project = projectById(model.projects, slot.projectId);
  return project === null ? EMPTY : project.name;
}

export function deriveSlotDetailsProjectIsPaused(model: Model): boolean {
  const slot = selectedSlotDetails(model);
  if (slot === null) return false;
  const project = projectById(model.projects, slot.projectId);
  return project !== null && !project.isActive;
}

export function deriveSlotDetailsClientLabel(model: Model): Bytes {
  const slot = selectedSlotDetails(model);
  if (slot === null) return EMPTY;
  const project = projectById(model.projects, slot.projectId);
  return project === null ? EMPTY : projectClientName(model, project);
}

export function deriveSlotDetailsTitle(model: Model): Bytes {
  const slot = selectedSlotDetails(model);
  return slot === null ? EMPTY : slot.title;
}

export function deriveSlotDetailsNotes(model: Model): Bytes {
  const slot = selectedSlotDetails(model);
  return slot === null ? EMPTY : slot.notes;
}

export function deriveSlotDetailsHasTitle(model: Model): boolean {
  const slot = selectedSlotDetails(model);
  return slot !== null && slot.title.length > 0;
}

export function deriveSlotDetailsHasNotes(model: Model): boolean {
  const slot = selectedSlotDetails(model);
  return slot !== null && slot.notes.length > 0;
}

export function deriveCanCreateSlot(model: Model): boolean {
  return modelCanMutate(model)
    && !model.calendarNowPending
    && !model.calendarLocalPending
    && model.projects.some((project) => project.isActive)
    && model.slots.length < MAX_SLOTS
    && countSlotsInWeek(model.slots, weekStartFor(model.calendarAnchorDay)) < MAX_SLOTS_PER_WEEK;
}

export function deriveCanSaveSlot(model: Model): boolean {
  return deriveCanCreateSlot(model) && activeProjectById(model.projects, model.slotProjectId) !== null;
}

export function deriveCanMoveSlotDayPrevious(model: Model): boolean {
  return model.slotDayOffset > 0;
}

export function deriveCanMoveSlotDayNext(model: Model): boolean {
  return model.slotDayOffset < 6;
}

export function deriveCanMoveSlotStartEarlier(model: Model): boolean {
  return model.slotStartMinutes > 0;
}

export function deriveCanMoveSlotStartLater(model: Model): boolean {
  return model.slotStartMinutes < MINUTES_PER_DAY - model.slotDurationMinutes;
}

export function deriveCanDecreaseSlotDuration(model: Model): boolean {
  return model.slotDurationMinutes > 30;
}

export function deriveCanIncreaseSlotDuration(model: Model): boolean {
  return model.slotDurationMinutes < MINUTES_PER_DAY - model.slotStartMinutes;
}

export function deriveSlotProjectOptions(model: Model): readonly PickerOption[] {
  const options: PickerOption[] = [];
  for (const project of model.projects) {
    if (!project.isActive) continue;
    options.push({ id: project.id, label: project.name, secondary: projectClientName(model, project), selected: project.id === model.slotProjectId });
  }
  return options;
}

export function deriveSlotProjectLabel(model: Model): Bytes {
  const project = activeProjectById(model.projects, model.slotProjectId);
  if (project === null) return asciiBytes("Select a project");
  return concat3(project.name, asciiBytes(" / "), projectClientName(model, project));
}

export function deriveSlotDayLabel(model: Model): Bytes {
  const dayIndex = model.weekStartDay + model.slotDayOffset;
  return concat3(weekdayName(model.slotDayOffset), SPACE, formatDateShort(dayIndex));
}

export function deriveSlotStartLabel(model: Model): Bytes {
  return timeLabel(model.slotStartMinutes);
}

export function deriveSlotEndLabel(model: Model): Bytes {
  return timeLabel(model.slotStartMinutes + model.slotDurationMinutes);
}

export function deriveSlotDurationLabel(model: Model): Bytes {
  return minutesLabel(model.slotDurationMinutes);
}
