import { asciiBytes } from "@native-sdk/core";
import {
  COLLAPSED_SIDEBAR_FRACTION,
  DEFAULT_SIDEBAR_FRACTION,
  EMPTY,
  MAX_ENTITIES,
  MAX_SIDEBAR_FRACTION,
  MIN_SIDEBAR_FRACTION,
  SIDEBAR_EXPANDED_THRESHOLD,
} from "../core-constants.ts";
import { clampDayIndex, shiftCalendarMonth, weekStartFor } from "../core-dates.ts";
import { clientById, modelCanMutate, projectById } from "../core-queries.ts";
import { applyEdit, createEmptyEdit } from "../core-state.ts";
import { prepareMutation } from "../core-storage.ts";
import type { Client, Model, Msg, Project } from "../core-types.ts";

export function reduceUiMessage(model: Model, msg: Msg): Model {
  switch (msg.kind) {
    case "show_calendar":
      return { ...model, activeView: "calendar", weekStartDay: weekStartFor(model.calendarAnchorDay), validationText: EMPTY };
    case "show_clients":
      return { ...model, activeView: "clients", weekStartDay: weekStartFor(model.calendarAnchorDay), validationText: EMPTY };
    case "show_projects":
      return { ...model, activeView: "projects", weekStartDay: weekStartFor(model.calendarAnchorDay), validationText: EMPTY };
    case "show_reports":
      return { ...model, activeView: "reports", validationText: EMPTY };
    case "toggle_sidebar":
      return {
        ...model,
        sidebarFraction: model.sidebarFraction >= SIDEBAR_EXPANDED_THRESHOLD
          ? COLLAPSED_SIDEBAR_FRACTION
          : DEFAULT_SIDEBAR_FRACTION,
      };
    case "sidebar_resized":
      return { ...model, sidebarFraction: Math.max(MIN_SIDEBAR_FRACTION, Math.min(MAX_SIDEBAR_FRACTION, msg.fraction)) };
    case "set_calendar_day":
      return { ...model, calendarMode: "day", weekStartDay: weekStartFor(model.calendarAnchorDay) };
    case "set_calendar_week":
      return { ...model, calendarMode: "week", weekStartDay: weekStartFor(model.calendarAnchorDay) };
    case "set_calendar_month":
      return { ...model, calendarMode: "month", weekStartDay: weekStartFor(model.calendarAnchorDay) };
    case "calendar_previous": {
      let nextAnchor = model.calendarAnchorDay;
      if (model.calendarMode === "day") nextAnchor = clampDayIndex(nextAnchor - 1);
      else if (model.calendarMode === "week") nextAnchor = clampDayIndex(nextAnchor - 7);
      else nextAnchor = shiftCalendarMonth(nextAnchor, -1);
      return {
        ...model,
        calendarAnchorDay: nextAnchor,
        weekStartDay: weekStartFor(nextAnchor),
        calendarNavigated: true,
        calendarNowPending: false,
        calendarLocalPending: false,
      };
    }
    case "calendar_next": {
      let nextAnchor = model.calendarAnchorDay;
      if (model.calendarMode === "day") nextAnchor = clampDayIndex(nextAnchor + 1);
      else if (model.calendarMode === "week") nextAnchor = clampDayIndex(nextAnchor + 7);
      else nextAnchor = shiftCalendarMonth(nextAnchor, 1);
      return {
        ...model,
        calendarAnchorDay: nextAnchor,
        weekStartDay: weekStartFor(nextAnchor),
        calendarNavigated: true,
        calendarNowPending: false,
        calendarLocalPending: false,
      };
    }
    case "open_calendar_day": {
      const nextAnchor = clampDayIndex(msg.dayIndex);
      return {
        ...model,
        calendarMode: "day",
        calendarAnchorDay: nextAnchor,
        weekStartDay: weekStartFor(nextAnchor),
        calendarNavigated: true,
        calendarNowPending: false,
        calendarLocalPending: false,
      };
    }
    case "open_client_modal":
      if (!modelCanMutate(model)) return { ...model, statusText: asciiBytes("Data file unavailable: changes are disabled.") };
      if (model.clients.length >= MAX_ENTITIES) return { ...model, statusText: asciiBytes("Maximum of 50 clients reached.") };
      return {
        ...model,
        clientModalOpen: true,
        clientNameEdit: createEmptyEdit(),
        clientContactEdit: createEmptyEdit(),
        clientNotesEdit: createEmptyEdit(),
        validationText: EMPTY,
      };
    case "close_client_modal":
      return { ...model, clientModalOpen: false, validationText: EMPTY };
    case "client_name_edit":
      return { ...model, clientNameEdit: applyEdit(model.clientNameEdit, msg.edit, 120), validationText: EMPTY };
    case "client_contact_edit":
      return { ...model, clientContactEdit: applyEdit(model.clientContactEdit, msg.edit, 160), validationText: EMPTY };
    case "client_notes_edit":
      return { ...model, clientNotesEdit: applyEdit(model.clientNotesEdit, msg.edit, 2000), validationText: EMPTY };
    case "save_client": {
      if (!modelCanMutate(model)) {
        return {
          ...model,
          validationText: asciiBytes("Data file unavailable: cannot save."),
          statusText: asciiBytes("Changes are disabled until the data file is available."),
        };
      }
      if (model.clients.length >= MAX_ENTITIES) return { ...model, validationText: asciiBytes("Maximum of 50 clients reached.") };
      const name = model.clientNameEdit.text.trim();
      if (name.length === 0) return { ...model, validationText: asciiBytes("Enter a client name.") };
      const client: Client = {
        id: model.nextClientId,
        name: name,
        contact: model.clientContactEdit.text.trim(),
        notes: model.clientNotesEdit.text.trim(),
      };
      const next: Model = {
        ...model,
        clients: [...model.clients, client],
        nextClientId: model.nextClientId + 1,
        dataRevision: model.dataRevision + 1,
        clientModalOpen: false,
        validationText: EMPTY,
      };
      return prepareMutation(model, next, true);
    }
    case "open_client_details":
      return clientById(model.clients, msg.clientId) === null ? model : { ...model, clientDetailsId: msg.clientId };
    case "close_client_details":
      return { ...model, clientDetailsId: 0 };
    case "delete_client": {
      if (!modelCanMutate(model)) return { ...model, statusText: asciiBytes("Data file unavailable: deletion is disabled.") };
      const client = clientById(model.clients, msg.clientId);
      if (client === null) return model;
      return { ...model, deleteKind: "client", deleteTargetId: client.id, deleteTargetName: client.name };
    }
    case "open_project_modal":
      if (!modelCanMutate(model)) return { ...model, statusText: asciiBytes("Data file unavailable: changes are disabled.") };
      if (model.projects.length >= MAX_ENTITIES) return { ...model, statusText: asciiBytes("Maximum of 50 projects reached.") };
      if (model.clients.length === 0) return { ...model, statusText: asciiBytes("Create a client first.") };
      return {
        ...model,
        projectModalOpen: true,
        clientPickerOpen: false,
        projectNameEdit: createEmptyEdit(),
        projectClientId: model.clients.length > 0 ? model.clients[0].id : 0,
        projectTargetHours: 10,
        validationText: EMPTY,
      };
    case "close_project_modal":
      return { ...model, projectModalOpen: false, clientPickerOpen: false, validationText: EMPTY };
    case "project_name_edit":
      return { ...model, projectNameEdit: applyEdit(model.projectNameEdit, msg.edit, 120), validationText: EMPTY };
    case "toggle_client_picker":
      return { ...model, clientPickerOpen: !model.clientPickerOpen };
    case "select_project_client":
      return { ...model, projectClientId: msg.clientId, clientPickerOpen: false, validationText: EMPTY };
    case "project_target_less":
      return { ...model, projectTargetHours: Math.max(0, model.projectTargetHours - 1) };
    case "project_target_more":
      return { ...model, projectTargetHours: Math.min(168, model.projectTargetHours + 1) };
    case "decrease_project_target": {
      if (!modelCanMutate(model)) return { ...model, statusText: asciiBytes("Data file unavailable: changes are disabled.") };
      const project = projectById(model.projects, msg.projectId);
      if (project === null || project.targetMinutes <= 0) return model;
      const next: Model = {
        ...model,
        projects: model.projects.map((project) => project.id === msg.projectId
          ? { ...project, targetMinutes: Math.max(0, project.targetMinutes - 60) }
          : project),
        dataRevision: model.dataRevision + 1,
      };
      return prepareMutation(model, next, false);
    }
    case "increase_project_target": {
      if (!modelCanMutate(model)) return { ...model, statusText: asciiBytes("Data file unavailable: changes are disabled.") };
      const project = projectById(model.projects, msg.projectId);
      if (project === null || project.targetMinutes >= 10080) return model;
      const next: Model = {
        ...model,
        projects: model.projects.map((project) => project.id === msg.projectId
          ? { ...project, targetMinutes: Math.min(10080, project.targetMinutes + 60) }
          : project),
        dataRevision: model.dataRevision + 1,
      };
      return prepareMutation(model, next, false);
    }
    case "toggle_project_active": {
      if (!modelCanMutate(model)) return { ...model, statusText: asciiBytes("Data file unavailable: changes are disabled.") };
      if (projectById(model.projects, msg.projectId) === null) return model;
      const next: Model = {
        ...model,
        projects: model.projects.map((candidate) => candidate.id === msg.projectId
          ? { ...candidate, isActive: !candidate.isActive }
          : candidate),
        dataRevision: model.dataRevision + 1,
      };
      return prepareMutation(model, next, false);
    }
    case "save_project": {
      if (!modelCanMutate(model)) {
        return {
          ...model,
          validationText: asciiBytes("Data file unavailable: cannot save."),
          statusText: asciiBytes("Changes are disabled until the data file is available."),
        };
      }
      if (model.projects.length >= MAX_ENTITIES) return { ...model, validationText: asciiBytes("Maximum of 50 projects reached.") };
      const name = model.projectNameEdit.text.trim();
      if (name.length === 0) return { ...model, validationText: asciiBytes("Enter a project name.") };
      if (clientById(model.clients, model.projectClientId) === null) return { ...model, validationText: asciiBytes("Select a client.") };
      const project: Project = {
        id: model.nextProjectId,
        clientId: model.projectClientId,
        name: name,
        targetMinutes: model.projectTargetHours * 60,
        isActive: true,
      };
      const next: Model = {
        ...model,
        projects: [...model.projects, project],
        nextProjectId: model.nextProjectId + 1,
        dataRevision: model.dataRevision + 1,
        projectModalOpen: false,
        clientPickerOpen: false,
        validationText: EMPTY,
      };
      return prepareMutation(model, next, true);
    }
    case "delete_project": {
      if (!modelCanMutate(model)) return { ...model, statusText: asciiBytes("Data file unavailable: deletion is disabled.") };
      const project = projectById(model.projects, msg.projectId);
      if (project === null) return model;
      return { ...model, deleteKind: "project", deleteTargetId: project.id, deleteTargetName: project.name };
    }
    default:
      return model;
  }
}
