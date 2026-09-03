import { asciiBytes } from "@native-sdk/core";
import { EMPTY, MAX_ENTITIES } from "../core-constants.ts";
import { minutesLabel, signedMinutesLabel } from "../core-format.ts";
import { allocatedForProject, clientById, modelCanMutate, projectClientName } from "../core-queries.ts";
import type { Bytes, Model, ProjectRow } from "../core-types.ts";

export function deriveProjectNameText(model: Model): Bytes {
  return model.projectNameEdit.text;
}

export function deriveHasProjects(model: Model): boolean {
  return model.projects.length > 0;
}

export function deriveCanCreateProject(model: Model): boolean {
  return modelCanMutate(model) && model.clients.length > 0 && model.projects.length < MAX_ENTITIES;
}

export function deriveCanSaveProject(model: Model): boolean {
  return deriveCanCreateProject(model) && model.projectNameEdit.text.trim().length > 0
    && clientById(model.clients, model.projectClientId) !== null;
}

export function deriveCanDecreaseProjectTarget(model: Model): boolean {
  return model.projectTargetHours > 1;
}

export function deriveCanIncreaseProjectTarget(model: Model): boolean {
  return model.projectTargetHours < 168;
}

export function deriveProjectCountLabel(model: Model): Bytes {
  if (model.projects.length === 1) return asciiBytes("1 project");
  return asciiBytes(`${model.projects.length} projects`);
}

export function deriveProjectRows(model: Model): readonly ProjectRow[] {
  const rows: ProjectRow[] = [];
  const weekEnd = model.weekStartDay + 7;
  for (const project of model.projects) {
    const allocatedMinutes = allocatedForProject(model.slots, project.id, model.weekStartDay, weekEnd);
    const remainingMinutes = project.targetMinutes - allocatedMinutes;
    rows.push({
      id: project.id,
      clientId: project.clientId,
      name: project.name,
      clientName: projectClientName(model, project),
      targetMinutes: project.targetMinutes,
      targetLabel: minutesLabel(project.targetMinutes),
      weekMinutes: allocatedMinutes,
      weekLabel: minutesLabel(allocatedMinutes),
      remainingMinutes: remainingMinutes,
      remainingLabel: signedMinutesLabel(remainingMinutes),
      isOver: remainingMinutes < 0,
    });
  }
  return rows;
}

export function deriveProjectClientLabel(model: Model): Bytes {
  const client = clientById(model.clients, model.projectClientId);
  return client === null ? asciiBytes("Select a client") : client.name;
}

export function deriveProjectTargetLabel(model: Model): Bytes {
  return minutesLabel(model.projectTargetHours * 60);
}
