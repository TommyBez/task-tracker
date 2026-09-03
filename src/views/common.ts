import { asciiBytes } from "@native-sdk/core";
import { concat3 } from "../core-bytes.ts";
import { EMPTY, SIDEBAR_EXPANDED_THRESHOLD } from "../core-constants.ts";
import { modelCanMutate } from "../core-queries.ts";
import type { Bytes, Model } from "../core-types.ts";

export function deriveHasValidation(model: Model): boolean {
  return model.validationText.length > 0;
}

export function deriveCanMutate(model: Model): boolean {
  return modelCanMutate(model);
}

export function deriveSidebarExpanded(model: Model): boolean {
  return model.sidebarFraction >= SIDEBAR_EXPANDED_THRESHOLD;
}

export function deriveSidebarCollapsed(model: Model): boolean {
  return model.sidebarFraction < SIDEBAR_EXPANDED_THRESHOLD;
}

export function deriveHasDeleteConfirmation(model: Model): boolean {
  return model.deleteKind !== "none";
}

export function deriveDeleteConfirmationTitle(model: Model): Bytes {
  switch (model.deleteKind) {
    case "client": return asciiBytes("Delete this client?");
    case "project": return asciiBytes("Delete this project?");
    case "slot": return asciiBytes("Delete this slot?");
    default: return EMPTY;
  }
}

export function deriveDeleteConfirmationBody(model: Model): Bytes {
  switch (model.deleteKind) {
    case "client":
      return concat3(asciiBytes("Deleting "), model.deleteTargetName, asciiBytes(" will also remove all linked projects and slots."));
    case "project":
      return concat3(asciiBytes("Deleting "), model.deleteTargetName, asciiBytes(" will also remove all linked slots."));
    case "slot":
      return concat3(asciiBytes("Permanently delete "), model.deleteTargetName, asciiBytes("?"));
    default:
      return EMPTY;
  }
}
