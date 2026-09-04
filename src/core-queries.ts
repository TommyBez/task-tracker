import { asciiBytes } from "@native-sdk/core";
import { UNASSIGNED_PROJECT_ID } from "./core-constants.ts";
import { civilFromDay, daysInMonth, monthStartFor, weekStartFor } from "./core-dates.ts";
import type { Bytes, Client, Model, Project, Slot } from "./core-types.ts";

export function modelCanMutate(model: Model): boolean {
  return !model.loading && model.storageReady && !model.storageBlocked && !model.writeInFlight && model.dataPath.length > 0;
}

export function clientById(clients: readonly Client[], id: number): Client | null {
  const found = clients.find((client) => client.id === id);
  return found ?? null;
}

export function projectById(projects: readonly Project[], id: number): Project | null {
  const found = projects.find((project) => project.id === id);
  return found ?? null;
}

export function activeProjectById(projects: readonly Project[], id: number): Project | null {
  const project = projectById(projects, id);
  return project !== null && project.isActive ? project : null;
}

export function firstActiveProject(projects: readonly Project[]): Project | null {
  const project = projects.find((candidate) => candidate.isActive);
  return project ?? null;
}

export function isAssignableProjectId(projects: readonly Project[], id: number): boolean {
  return id === UNASSIGNED_PROJECT_ID || activeProjectById(projects, id) !== null;
}

export function projectClientName(model: Model, project: Project): Bytes {
  const client = clientById(model.clients, project.clientId);
  return client === null ? asciiBytes("Deleted client") : client.name;
}

export function allocatedForProject(slots: readonly Slot[], projectId: number, startDay: number, endDay: number): number {
  let total = 0;
  for (const slot of slots) {
    if (slot.projectId === projectId && slot.dayIndex >= startDay && slot.dayIndex < endDay) total += slot.durationMinutes;
  }
  return total;
}

export function hasSlotOverlap(slots: readonly Slot[], dayIndex: number, startMinutes: number, durationMinutes: number, ignoredSlotId: number): boolean {
  const endMinutes = startMinutes + durationMinutes;
  for (const slot of slots) {
    if (slot.id === ignoredSlotId || slot.dayIndex !== dayIndex) continue;
    const slotEnd = slot.startMinutes + slot.durationMinutes;
    if (startMinutes < slotEnd && endMinutes > slot.startMinutes) return true;
  }
  return false;
}

export function countSlotsInWeek(slots: readonly Slot[], weekStartDay: number): number {
  let count = 0;
  for (const slot of slots) if (slot.dayIndex >= weekStartDay && slot.dayIndex < weekStartDay + 7) count += 1;
  return count;
}

export function countProjectsForClient(projects: readonly Project[], clientId: number): number {
  let count = 0;
  for (const project of projects) if (project.clientId === clientId) count += 1;
  return count;
}

export function targetForClient(projects: readonly Project[], clientId: number): number {
  let total = 0;
  for (const project of projects) if (project.clientId === clientId && project.isActive) total += project.targetMinutes;
  return total;
}

export function allocatedForClient(projects: readonly Project[], slots: readonly Slot[], clientId: number, startDay: number, endDay: number): number {
  let total = 0;
  for (const project of projects) {
    if (project.clientId === clientId) total += allocatedForProject(slots, project.id, startDay, endDay);
  }
  return total;
}

export function reportStart(model: Model): number {
  if (model.reportPeriod === "weekly") return weekStartFor(model.reportAnchorDay);
  return monthStartFor(model.reportAnchorDay);
}

export function reportEnd(model: Model): number {
  const start = reportStart(model);
  if (model.reportPeriod === "weekly") return start + 7;
  const date = civilFromDay(start);
  return start + daysInMonth(date.year, date.month);
}
