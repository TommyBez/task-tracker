import { asciiBytes } from "@native-sdk/core";
import { EMPTY, MAX_DAY_INDEX } from "../core-constants.ts";
import { monthStartFor } from "../core-dates.ts";
import { modelCanMutate, reportEnd } from "../core-queries.ts";
import { prepareMutation } from "../core-storage.ts";
import type { Model, Msg } from "../core-types.ts";

export function reduceReportDeleteMessage(model: Model, msg: Msg): Model {
  switch (msg.kind) {
    case "set_report_weekly":
      return { ...model, reportPeriod: "weekly" };
    case "set_report_monthly":
      return { ...model, reportPeriod: "monthly" };
    case "report_previous":
      if (model.reportPeriod === "weekly") {
        return {
          ...model,
          reportAnchorDay: Math.max(0, model.reportAnchorDay - 7),
          reportNavigated: true,
          reportNowPending: false,
          reportLocalPending: false,
        };
      }
      return {
        ...model,
        reportAnchorDay: Math.max(0, monthStartFor(model.reportAnchorDay) - 1),
        reportNavigated: true,
        reportNowPending: false,
        reportLocalPending: false,
      };
    case "report_next":
      if (model.reportPeriod === "weekly") {
        return {
          ...model,
          reportAnchorDay: Math.min(MAX_DAY_INDEX, model.reportAnchorDay + 7),
          reportNavigated: true,
          reportNowPending: false,
          reportLocalPending: false,
        };
      }
      return {
        ...model,
        reportAnchorDay: Math.min(MAX_DAY_INDEX, reportEnd(model)),
        reportNavigated: true,
        reportNowPending: false,
        reportLocalPending: false,
      };
    case "confirm_delete": {
      if (model.deleteKind === "none") return model;
      if (!modelCanMutate(model)) return { ...model, statusText: asciiBytes("Data file unavailable: deletion is disabled.") };
      if (model.deleteKind === "client") {
        const remainingClients = model.clients.filter((client) => client.id !== model.deleteTargetId);
        if (remainingClients.length === model.clients.length) return { ...model, deleteKind: "none", deleteTargetId: 0, deleteTargetName: EMPTY };
        const remainingProjects = model.projects.filter((project) => project.clientId !== model.deleteTargetId);
        const remainingSlots = model.slots.filter((slot) => remainingProjects.some((project) => project.id === slot.projectId));
        const next: Model = {
          ...model,
          clients: remainingClients,
          projects: remainingProjects,
          slots: remainingSlots,
          dataRevision: model.dataRevision + 1,
          clientDetailsId: 0,
          slotDetailsId: 0,
          deleteKind: "none",
          deleteTargetId: 0,
          deleteTargetName: EMPTY,
        };
        return prepareMutation(model, next, false);
      }
      if (model.deleteKind === "project") {
        const remainingProjects = model.projects.filter((project) => project.id !== model.deleteTargetId);
        if (remainingProjects.length === model.projects.length) return { ...model, deleteKind: "none", deleteTargetId: 0, deleteTargetName: EMPTY };
        const next: Model = {
          ...model,
          projects: remainingProjects,
          slots: model.slots.filter((slot) => slot.projectId !== model.deleteTargetId),
          dataRevision: model.dataRevision + 1,
          slotDetailsId: 0,
          deleteKind: "none",
          deleteTargetId: 0,
          deleteTargetName: EMPTY,
        };
        return prepareMutation(model, next, false);
      }
      const remainingSlots = model.slots.filter((slot) => slot.id !== model.deleteTargetId);
      if (remainingSlots.length === model.slots.length) return { ...model, deleteKind: "none", deleteTargetId: 0, deleteTargetName: EMPTY };
      const next: Model = {
        ...model,
        slots: remainingSlots,
        dataRevision: model.dataRevision + 1,
        slotDetailsId: 0,
        deleteKind: "none",
        deleteTargetId: 0,
        deleteTargetName: EMPTY,
      };
      return prepareMutation(model, next, false);
    }
    case "cancel_delete":
      return { ...model, deleteKind: "none", deleteTargetId: 0, deleteTargetName: EMPTY };
    default:
      return model;
  }
}
