import { asciiBytes } from "@native-sdk/core";
import { EMPTY, MAX_DAY_INDEX, MAX_SLOTS, MAX_SLOTS_PER_WEEK, MINUTES_PER_DAY } from "../core-constants.ts";
import { weekStartFor } from "../core-dates.ts";
import { timeRangeLabel } from "../core-format.ts";
import { countSlotsInWeek, hasSlotOverlap, modelCanMutate, projectById } from "../core-queries.ts";
import { applyEdit, createEmptyEdit } from "../core-state.ts";
import { prepareMutation } from "../core-storage.ts";
import type { Model, Msg, Slot } from "../core-types.ts";

export function reduceSlotMessage(model: Model, msg: Msg): Model {
  switch (msg.kind) {
    case "open_slot_modal": {
      if (!modelCanMutate(model)) return { ...model, statusText: asciiBytes("Data file unavailable: changes are disabled.") };
      if (model.calendarNowPending || model.calendarLocalPending) return { ...model, statusText: asciiBytes("Wait for the local date to update.") };
      if (model.slots.length >= MAX_SLOTS) return { ...model, statusText: asciiBytes("Maximum of 1,000 slots reached.") };
      const slotWeekStart = weekStartFor(model.calendarAnchorDay);
      if (countSlotsInWeek(model.slots, slotWeekStart) >= MAX_SLOTS_PER_WEEK) return { ...model, statusText: asciiBytes("Maximum of 70 slots for this week reached.") };
      if (model.projects.length === 0) return { ...model, statusText: asciiBytes("Create a project first.") };
      const offset = model.calendarAnchorDay - slotWeekStart;
      return {
        ...model,
        weekStartDay: slotWeekStart,
        slotModalOpen: true,
        slotProjectPickerOpen: false,
        slotTitleEdit: createEmptyEdit(),
        slotNotesEdit: createEmptyEdit(),
        slotProjectId: model.projects.length > 0 ? model.projects[0].id : 0,
        slotDayOffset: offset,
        slotStartMinutes: 540,
        slotDurationMinutes: 60,
        validationText: EMPTY,
      };
    }
    case "open_slot_for_day": {
      if (!modelCanMutate(model)) return { ...model, statusText: asciiBytes("Data file unavailable: changes are disabled.") };
      if (model.calendarNowPending || model.calendarLocalPending) return { ...model, statusText: asciiBytes("Wait for the local date to update.") };
      if (model.slots.length >= MAX_SLOTS) return { ...model, statusText: asciiBytes("Maximum of 1,000 slots reached.") };
      if (countSlotsInWeek(model.slots, model.weekStartDay) >= MAX_SLOTS_PER_WEEK) return { ...model, statusText: asciiBytes("Maximum of 70 slots for this week reached.") };
      if (model.projects.length === 0) return { ...model, statusText: asciiBytes("Create a project first.") };
      const offset = Math.max(0, Math.min(6, msg.dayOffset));
      return {
        ...model,
        slotModalOpen: true,
        slotProjectPickerOpen: false,
        slotTitleEdit: createEmptyEdit(),
        slotNotesEdit: createEmptyEdit(),
        slotProjectId: model.projects.length > 0 ? model.projects[0].id : 0,
        slotDayOffset: offset,
        slotStartMinutes: 540,
        slotDurationMinutes: 60,
        validationText: EMPTY,
      };
    }
    case "close_slot_modal":
      return { ...model, slotModalOpen: false, slotProjectPickerOpen: false, validationText: EMPTY };
    case "slot_title_edit":
      return { ...model, slotTitleEdit: applyEdit(model.slotTitleEdit, msg.edit, 160), validationText: EMPTY };
    case "slot_notes_edit":
      return { ...model, slotNotesEdit: applyEdit(model.slotNotesEdit, msg.edit, 2000), validationText: EMPTY };
    case "toggle_slot_project_picker":
      return { ...model, slotProjectPickerOpen: !model.slotProjectPickerOpen };
    case "select_slot_project":
      return { ...model, slotProjectId: msg.projectId, slotProjectPickerOpen: false, validationText: EMPTY };
    case "slot_day_previous":
      return { ...model, slotDayOffset: Math.max(0, model.slotDayOffset - 1) };
    case "slot_day_next":
      return { ...model, slotDayOffset: Math.min(6, model.slotDayOffset + 1) };
    case "slot_start_earlier":
      return { ...model, slotStartMinutes: Math.max(0, model.slotStartMinutes - 30) };
    case "slot_start_later":
      return { ...model, slotStartMinutes: Math.min(MINUTES_PER_DAY - model.slotDurationMinutes, model.slotStartMinutes + 30) };
    case "slot_duration_less":
      return { ...model, slotDurationMinutes: Math.max(30, model.slotDurationMinutes - 30) };
    case "slot_duration_more":
      return { ...model, slotDurationMinutes: Math.min(MINUTES_PER_DAY - model.slotStartMinutes, model.slotDurationMinutes + 30) };
    case "save_slot": {
      if (model.calendarNowPending || model.calendarLocalPending) return { ...model, validationText: asciiBytes("Wait for the local date to update.") };
      if (!modelCanMutate(model)) {
        return {
          ...model,
          validationText: asciiBytes("Data file unavailable: cannot save."),
          statusText: asciiBytes("Changes are disabled until the data file is available."),
        };
      }
      if (model.slots.length >= MAX_SLOTS) return { ...model, validationText: asciiBytes("Maximum of 1,000 slots reached.") };
      if (countSlotsInWeek(model.slots, model.weekStartDay) >= MAX_SLOTS_PER_WEEK) return { ...model, validationText: asciiBytes("Maximum of 70 slots for this week reached.") };
      if (projectById(model.projects, model.slotProjectId) === null) return { ...model, validationText: asciiBytes("Select a project.") };
      const dayIndex = model.weekStartDay + model.slotDayOffset;
      if (dayIndex < 0 || dayIndex > MAX_DAY_INDEX) return { ...model, validationText: asciiBytes("Date is outside the supported range.") };
      if (hasSlotOverlap(model.slots, dayIndex, model.slotStartMinutes, model.slotDurationMinutes, 0)) {
        return { ...model, validationText: asciiBytes("This time overlaps an existing slot.") };
      }
      const slot: Slot = {
        id: model.nextSlotId,
        projectId: model.slotProjectId,
        dayIndex: dayIndex,
        startMinutes: model.slotStartMinutes,
        durationMinutes: model.slotDurationMinutes,
        title: model.slotTitleEdit.text.trim(),
        notes: model.slotNotesEdit.text.trim(),
      };
      const next: Model = {
        ...model,
        slots: [...model.slots, slot],
        nextSlotId: model.nextSlotId + 1,
        dataRevision: model.dataRevision + 1,
        slotModalOpen: false,
        slotProjectPickerOpen: false,
        validationText: EMPTY,
      };
      return prepareMutation(model, next, true);
    }
    case "open_slot_details":
      if (!model.slots.some((slot) => slot.id === msg.slotId)) return model;
      return { ...model, slotDetailsId: msg.slotId };
    case "close_slot_details":
      return { ...model, slotDetailsId: 0 };
    case "delete_slot": {
      if (!modelCanMutate(model)) return { ...model, statusText: asciiBytes("Data file unavailable: deletion is disabled.") };
      const slot = model.slots.find((candidate) => candidate.id === msg.slotId);
      if (slot === undefined) return model;
      let targetName = slot.title;
      if (targetName.length === 0) {
        for (const project of model.projects) if (project.id === slot.projectId) targetName = project.name;
      }
      if (targetName.length === 0) targetName = timeRangeLabel(slot.startMinutes, slot.durationMinutes);
      return { ...model, slotDetailsId: 0, deleteKind: "slot", deleteTargetId: slot.id, deleteTargetName: targetName };
    }
    default:
      return model;
  }
}
