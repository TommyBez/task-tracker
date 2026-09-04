import { asciiBytes } from "@native-sdk/core";
import { concat3 } from "../core-bytes.ts";
import { DATE_SEPARATOR, EMPTY, SPACE } from "../core-constants.ts";
import { civilFromDay, formatDateLong, monthLong } from "../core-dates.ts";
import { minutesLabel, signedMinutesLabel } from "../core-format.ts";
import { allocatedForProject, projectClientName, reportEnd, reportStart } from "../core-queries.ts";
import type { Bytes, Model, ReportRow } from "../core-types.ts";

export function deriveHasReportRows(model: Model): boolean {
  return model.projects.length > 0;
}

export function deriveReportPeriodLabel(model: Model): Bytes {
  return model.reportPeriod === "weekly" ? asciiBytes("Weekly") : asciiBytes("Monthly");
}

export function deriveReportRangeLabel(model: Model): Bytes {
  const start = reportStart(model);
  const end = reportEnd(model) - 1;
  if (model.reportPeriod === "monthly") {
    const date = civilFromDay(start);
    return concat3(monthLong(date.month), SPACE, asciiBytes(`${date.year}`));
  }
  return concat3(formatDateLong(start), DATE_SEPARATOR, formatDateLong(end));
}

export function deriveReportRows(model: Model): readonly ReportRow[] {
  const rows: ReportRow[] = [];
  const start = reportStart(model);
  const end = reportEnd(model);
  for (const project of model.projects) {
    const allocatedMinutes = allocatedForProject(model.slots, project.id, start, end);
    if (model.reportPeriod === "monthly") {
      rows.push({
        projectId: project.id,
        projectName: project.name,
        clientName: projectClientName(model, project),
        targetMinutes: 0,
        targetLabel: asciiBytes("-"),
        allocatedMinutes: allocatedMinutes,
        allocatedLabel: minutesLabel(allocatedMinutes),
        deltaMinutes: 0,
        deltaLabel: EMPTY,
        isOver: false,
        isActive: project.isActive,
      });
    } else {
      const deltaMinutes = allocatedMinutes - project.targetMinutes;
      rows.push({
        projectId: project.id,
        projectName: project.name,
        clientName: projectClientName(model, project),
        targetMinutes: project.targetMinutes,
        targetLabel: minutesLabel(project.targetMinutes),
        allocatedMinutes: allocatedMinutes,
        allocatedLabel: minutesLabel(allocatedMinutes),
        deltaMinutes: deltaMinutes,
        deltaLabel: signedMinutesLabel(deltaMinutes),
        isOver: deltaMinutes > 0,
        isActive: project.isActive,
      });
    }
  }
  return rows;
}

export function deriveReportTotalLabel(model: Model): Bytes {
  const start = reportStart(model);
  const end = reportEnd(model);
  let total = 0;
  for (const slot of model.slots) if (slot.dayIndex >= start && slot.dayIndex < end) total += slot.durationMinutes;
  return minutesLabel(total);
}
