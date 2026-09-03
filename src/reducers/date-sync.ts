import { dayFromTimestamp, parseLocalDay, weekStartFor } from "../core-dates.ts";
import type { Model, Msg } from "../core-types.ts";

export function reduceDateSyncMessage(model: Model, msg: Msg): Model {
  switch (msg.kind) {
    case "go_today":
      return { ...model, calendarNowPending: true, calendarLocalPending: false };
    case "report_today":
      return { ...model, reportNowPending: true, reportLocalPending: false };
    case "clock_ready": {
      const today = dayFromTimestamp(msg.at);
      return {
        ...model,
        currentDayIndex: today,
        calendarAnchorDay: model.calendarNavigated ? model.calendarAnchorDay : today,
        weekStartDay: model.calendarNavigated ? model.weekStartDay : weekStartFor(today),
        reportAnchorDay: model.reportNavigated ? model.reportAnchorDay : today,
        hasClock: true,
      };
    }
    case "local_date_ready": {
      if (msg.code !== 0) return { ...model, calendarLocalPending: false };
      const localDay = parseLocalDay(msg.output);
      if (localDay === null) return { ...model, calendarLocalPending: false };
      return {
        ...model,
        currentDayIndex: localDay,
        calendarAnchorDay: model.calendarNavigated ? model.calendarAnchorDay : localDay,
        weekStartDay: model.calendarNavigated ? model.weekStartDay : weekStartFor(localDay),
        reportAnchorDay: model.reportNavigated ? model.reportAnchorDay : localDay,
        calendarLocalPending: false,
      };
    }
    case "local_date_failed":
      return { ...model, calendarLocalPending: false };
    case "calendar_today_ready": {
      if (!model.calendarNowPending) return model;
      const today = dayFromTimestamp(msg.at);
      return {
        ...model,
        currentDayIndex: today,
        calendarAnchorDay: today,
        weekStartDay: weekStartFor(today),
        calendarNavigated: false,
        calendarNowPending: false,
        calendarLocalPending: true,
      };
    }
    case "calendar_local_date_ready": {
      if (!model.calendarLocalPending) return model;
      if (msg.code !== 0) return { ...model, calendarLocalPending: false };
      const localDay = parseLocalDay(msg.output);
      if (localDay === null) return { ...model, calendarLocalPending: false };
      return {
        ...model,
        currentDayIndex: localDay,
        calendarAnchorDay: localDay,
        weekStartDay: weekStartFor(localDay),
        calendarLocalPending: false,
      };
    }
    case "calendar_local_date_failed":
      return { ...model, calendarLocalPending: false };
    case "report_today_ready": {
      if (!model.reportNowPending) return model;
      const today = dayFromTimestamp(msg.at);
      return {
        ...model,
        currentDayIndex: today,
        reportAnchorDay: today,
        reportNavigated: false,
        reportNowPending: false,
        reportLocalPending: true,
      };
    }
    case "report_local_date_ready": {
      if (!model.reportLocalPending) return model;
      if (msg.code !== 0) return { ...model, reportLocalPending: false };
      const localDay = parseLocalDay(msg.output);
      if (localDay === null) return { ...model, reportLocalPending: false };
      return { ...model, currentDayIndex: localDay, reportAnchorDay: localDay, reportLocalPending: false };
    }
    case "report_local_date_failed":
      return { ...model, reportLocalPending: false };
    default:
      return model;
  }
}
