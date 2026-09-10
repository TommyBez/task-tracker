import { asciiBytes } from "@native-sdk/core";
import { bytesPreview } from "../core-bytes.ts";
import { CLIENT_NOTES_PREVIEW_BYTES, EMPTY, MAX_ENTITIES } from "../core-constants.ts";
import { minutesLabel } from "../core-format.ts";
import {
  allocatedForClient,
  clientById,
  countProjectsForClient,
  modelCanMutate,
  targetForClient,
} from "../core-queries.ts";
import type { Bytes, Client, ClientRow, Model, PickerOption } from "../core-types.ts";

export function deriveClientNameText(model: Model): Bytes {
  return model.clientNameEdit.text;
}

export function deriveClientContactText(model: Model): Bytes {
  return model.clientContactEdit.text;
}

export function deriveClientNotesText(model: Model): Bytes {
  return model.clientNotesEdit.text;
}

function selectedClientDetails(model: Model): Client | null {
  return clientById(model.clients, model.clientDetailsId);
}

export function deriveHasClientDetails(model: Model): boolean {
  return selectedClientDetails(model) !== null;
}

export function deriveClientDetailsName(model: Model): Bytes {
  const client = selectedClientDetails(model);
  return client === null ? EMPTY : client.name;
}

export function deriveClientDetailsContact(model: Model): Bytes {
  const client = selectedClientDetails(model);
  return client === null ? EMPTY : client.contact;
}

export function deriveClientDetailsNotes(model: Model): Bytes {
  const client = selectedClientDetails(model);
  return client === null ? EMPTY : client.notes;
}

export function deriveClientDetailsHasContact(model: Model): boolean {
  const client = selectedClientDetails(model);
  return client !== null && client.contact.length > 0;
}

export function deriveClientDetailsHasNotes(model: Model): boolean {
  const client = selectedClientDetails(model);
  return client !== null && client.notes.length > 0;
}

export function deriveClientDetailsProjectCountLabel(model: Model): Bytes {
  const client = selectedClientDetails(model);
  if (client === null) return EMPTY;
  const count = countProjectsForClient(model.projects, client.id);
  return count === 1 ? asciiBytes("1 project") : asciiBytes(`${count} projects`);
}

export function deriveClientDetailsTargetLabel(model: Model): Bytes {
  const client = selectedClientDetails(model);
  return client === null ? EMPTY : minutesLabel(targetForClient(model.projects, client.id));
}

export function deriveClientDetailsAllocatedLabel(model: Model): Bytes {
  const client = selectedClientDetails(model);
  if (client === null) return EMPTY;
  return minutesLabel(allocatedForClient(model.projects, model.slots, client.id, model.weekStartDay, model.weekStartDay + 7));
}

export function deriveHasClients(model: Model): boolean {
  return model.clients.length > 0;
}

export function deriveCanCreateClient(model: Model): boolean {
  return modelCanMutate(model) && model.clients.length < MAX_ENTITIES;
}

export function deriveCanSaveClient(model: Model): boolean {
  return deriveCanCreateClient(model) && model.clientNameEdit.text.trim().length > 0;
}

export function deriveClientCountLabel(model: Model): Bytes {
  if (model.clients.length === 1) return asciiBytes("1 client");
  return asciiBytes(`${model.clients.length} clients`);
}

export function deriveClientRows(model: Model): readonly ClientRow[] {
  const rows: ClientRow[] = [];
  const weekEnd = model.weekStartDay + 7;
  for (const client of model.clients) {
    const projectCount = countProjectsForClient(model.projects, client.id);
    const targetMinutes = targetForClient(model.projects, client.id);
    const allocatedMinutes = allocatedForClient(model.projects, model.slots, client.id, model.weekStartDay, weekEnd);
    rows.push({
      id: client.id,
      name: client.name,
      contact: client.contact,
      notesPreview: bytesPreview(client.notes, CLIENT_NOTES_PREVIEW_BYTES),
      hasContact: client.contact.length > 0,
      hasNotes: client.notes.length > 0,
      projectCount: projectCount,
      projectCountLabel: projectCount === 1 ? asciiBytes("1 project") : asciiBytes(`${projectCount} projects`),
      targetMinutes: targetMinutes,
      targetLabel: minutesLabel(targetMinutes),
      allocatedMinutes: allocatedMinutes,
      allocatedLabel: minutesLabel(allocatedMinutes),
    });
  }
  return rows;
}

export function deriveClientOptions(model: Model): readonly PickerOption[] {
  const options: readonly PickerOption[] = model.clients.map((client) => ({
    id: client.id,
    label: client.name,
    secondary: EMPTY,
    selected: client.id === model.projectClientId,
  }));
  return [{ id: 0, label: asciiBytes("No client"), secondary: EMPTY, selected: model.projectClientId === 0 }, ...options];
}
