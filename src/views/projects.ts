import { asciiBytes } from "@native-sdk/core";
import { concat3 } from "../core-bytes.ts";
import { EMPTY, MAX_ENTITIES } from "../core-constants.ts";
import { minutesLabel, signedMinutesLabel } from "../core-format.ts";
import { draftProjectTargetMinutes, projectTargetLimit } from "../core-project-budget.ts";
import { allocatedForProject, totalAllocatedForProject, clientById, modelCanMutate, projectById, projectClientName } from "../core-queries.ts";
import type { Bytes, Model, Project, ProjectRow } from "../core-types.ts";

function projectStatusLabel(project: Project): Bytes {
  return project.isActive ? asciiBytes("Active") : asciiBytes("Paused");
}

function projectToggleLabel(project: Project): Bytes {
  if (project.isActive) return concat3(asciiBytes("Pause "), project.name, asciiBytes(" project"));
  return concat3(asciiBytes("Resume "), project.name, asciiBytes(" project"));
}

export function deriveProjectNameText(model: Model): Bytes {
  return model.projectNameEdit.text;
}

export function deriveHasProjects(model: Model): boolean {
  return model.projects.length > 0;
}

export function deriveHasActiveProjects(model: Model): boolean {
  return model.projects.some((project) => project.isActive);
}

export function deriveCanCreateProject(model: Model): boolean {
  return modelCanMutate(model) && model.projects.length < MAX_ENTITIES;
}

export function deriveCanSaveProject(model: Model): boolean {
  const validProject = model.projectEditingId === 0 ? model.projects.length < MAX_ENTITIES
    : projectById(model.projects, model.projectEditingId) !== null;
  return modelCanMutate(model) && validProject && model.projectNameEdit.text.trim().length > 0
    && draftProjectTargetMinutes(model) !== null
    && (model.projectClientId === 0 || clientById(model.clients, model.projectClientId) !== null);
}

export function deriveCanDecreaseProjectTarget(model: Model): boolean {
  return model.projectTargetHours > 0;
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
  const canMutate = modelCanMutate(model);
  for (const project of model.projects) {
    const allocatedMinutes = project.budgetKind === "total" ? totalAllocatedForProject(model.slots, project.id)
      : allocatedForProject(model.slots, project.id, model.weekStartDay, weekEnd);
    const remainingMinutes = project.targetMinutes - allocatedMinutes;
    rows.push({
      id: project.id,
      clientId: project.clientId,
      name: project.name,
      clientName: projectClientName(model, project),
      targetMinutes: project.targetMinutes,
      targetLabel: minutesLabel(project.targetMinutes),
      allocationScopeLabel: project.budgetKind === "total" ? asciiBytes("Planned all time") : asciiBytes("Planned this week"),
      budgetLabel: project.budgetKind === "total" ? asciiBytes("Fixed total") : asciiBytes("Weekly recurring"),
      weekMinutes: allocatedMinutes,
      weekLabel: minutesLabel(allocatedMinutes),
      remainingMinutes: remainingMinutes,
      remainingLabel: project.isActive || project.budgetKind === "total" ? signedMinutesLabel(remainingMinutes) : asciiBytes("-"),
      isOver: (project.isActive || project.budgetKind === "total") && remainingMinutes < 0,
      isActive: project.isActive,
      statusLabel: projectStatusLabel(project),
      toggleLabel: projectToggleLabel(project),
      canDecreaseTarget: canMutate && project.targetMinutes > 0,
      canIncreaseTarget: canMutate && project.targetMinutes < projectTargetLimit(project),
    });
  }
  return rows;
}

export function deriveProjectClientLabel(model: Model): Bytes {
  if (model.projectClientId === 0) return asciiBytes("No client");
  const client = clientById(model.clients, model.projectClientId);
  return client === null ? asciiBytes("Select a client") : client.name;
}

export function deriveProjectTargetLabel(model: Model): Bytes {
  return minutesLabel(model.projectTargetHours * 60);
}
