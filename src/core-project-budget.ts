import { MAX_TOTAL_TARGET_HOURS, MAX_WEEKLY_TARGET_MINUTES } from "./core-constants.ts";
import type { Bytes, Model, Project } from "./core-types.ts";

export function projectTargetLimit(project: Project): number {
  return project.budgetKind === "total" ? MAX_TOTAL_TARGET_HOURS * 60 : MAX_WEEKLY_TARGET_MINUTES;
}

export function parseTotalHours(text: Bytes): number | null {
  const input = text.trim();
  if (input.length === 0) return null;
  let hours = 0;
  for (const digit of input) {
    if (digit < 48 || digit > 57) return null;
    hours = hours * 10 + digit - 48;
    if (hours > MAX_TOTAL_TARGET_HOURS) return null;
  }
  return hours;
}

export function draftProjectTargetMinutes(model: Model): number | null {
  if (model.projectBudgetKind === "weekly") return model.projectTargetHours * 60;
  const hours = parseTotalHours(model.projectTotalHoursEdit.text);
  return hours === null ? null : hours * 60;
}
