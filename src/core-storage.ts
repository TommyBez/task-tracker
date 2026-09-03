import { asciiBytes } from "@native-sdk/core";
import { temporaryDataPath } from "./core-bytes.ts";
import {
  EMPTY,
  FORMAT_VERSION,
  MAGIC,
  MAX_DAY_INDEX,
  MAX_ENTITIES,
  MAX_FILE_BYTES,
  MAX_SLOTS,
  MAX_SLOTS_PER_WEEK,
  MAX_TEXT_BYTES,
  MINUTES_PER_DAY,
} from "./core-constants.ts";
import { weekStartFor } from "./core-dates.ts";
import { clientById, countSlotsInWeek, hasSlotOverlap, projectById } from "./core-queries.ts";
import type { Bytes, Client, Model, Project, Slot, StoredData } from "./core-types.ts";

function writeU32(out: Uint8Array, offset: number, value: number): number {
  out[offset] = value & 255;
  out[offset + 1] = (value >>> 8) & 255;
  out[offset + 2] = (value >>> 16) & 255;
  out[offset + 3] = (value >>> 24) & 255;
  return offset + 4;
}

function writeSizedBytes(out: Uint8Array, offset: number, value: Bytes): number {
  const contentOffset = writeU32(out, offset, value.length);
  out.set(value, contentOffset);
  return contentOffset + value.length;
}

class ByteReader {
  bytes: Uint8Array;
  offset: number;
  ok: boolean;

  constructor(bytes: Uint8Array) {
    this.bytes = bytes;
    this.offset = 0;
    this.ok = true;
  }

  readU32(): number {
    if (!this.ok || this.offset + 4 > this.bytes.length) {
      this.ok = false;
      return 0;
    }
    const value = (
      this.bytes[this.offset] |
      (this.bytes[this.offset + 1] << 8) |
      (this.bytes[this.offset + 2] << 16) |
      (this.bytes[this.offset + 3] << 24)
    ) >>> 0;
    this.offset += 4;
    return value;
  }

  readBytes(maxLength: number): Uint8Array | null {
    const length = this.readU32();
    if (!this.ok || length > maxLength || this.offset + length > this.bytes.length) {
      this.ok = false;
      return null;
    }
    const value = this.bytes.slice(this.offset, this.offset + length);
    this.offset += length;
    return value;
  }

  finished(): boolean {
    return this.ok && this.offset === this.bytes.length;
  }
}

export function encodedSize(model: Model): number {
  let size = 32;
  for (const client of model.clients) size += 16 + client.name.length + client.contact.length + client.notes.length;
  for (const project of model.projects) size += 16 + project.name.length;
  for (const slot of model.slots) size += 28 + slot.title.length + slot.notes.length;
  return size;
}

export function encodeData(model: Model): Bytes {
  const out = new Uint8Array(encodedSize(model));
  let offset = 0;
  offset = writeU32(out, offset, MAGIC);
  offset = writeU32(out, offset, FORMAT_VERSION);
  offset = writeU32(out, offset, model.nextClientId);
  offset = writeU32(out, offset, model.nextProjectId);
  offset = writeU32(out, offset, model.nextSlotId);
  offset = writeU32(out, offset, model.clients.length);
  for (const client of model.clients) {
    offset = writeU32(out, offset, client.id);
    offset = writeSizedBytes(out, offset, client.name);
    offset = writeSizedBytes(out, offset, client.contact);
    offset = writeSizedBytes(out, offset, client.notes);
  }
  offset = writeU32(out, offset, model.projects.length);
  for (const project of model.projects) {
    offset = writeU32(out, offset, project.id);
    offset = writeU32(out, offset, project.clientId);
    offset = writeU32(out, offset, project.targetMinutes);
    offset = writeSizedBytes(out, offset, project.name);
  }
  offset = writeU32(out, offset, model.slots.length);
  for (const slot of model.slots) {
    offset = writeU32(out, offset, slot.id);
    offset = writeU32(out, offset, slot.projectId);
    offset = writeU32(out, offset, slot.dayIndex);
    offset = writeU32(out, offset, slot.startMinutes);
    offset = writeU32(out, offset, slot.durationMinutes);
    offset = writeSizedBytes(out, offset, slot.title);
    offset = writeSizedBytes(out, offset, slot.notes);
  }
  return out;
}

export function decodeData(bytes: Bytes): StoredData | null {
  if (bytes.length > MAX_FILE_BYTES) return null;
  const reader = new ByteReader(bytes);
  if (reader.readU32() !== MAGIC || reader.readU32() !== FORMAT_VERSION) return null;
  const storedNextClientId = reader.readU32();
  const storedNextProjectId = reader.readU32();
  const storedNextSlotId = reader.readU32();
  const clientCount = reader.readU32();
  if (!reader.ok || clientCount > MAX_ENTITIES) return null;
  const clients: Client[] = [];
  let maxClientId = 0;
  for (let i = 0; i < clientCount; i += 1) {
    const id = reader.readU32();
    const name = reader.readBytes(MAX_TEXT_BYTES) ?? EMPTY;
    const contact = reader.readBytes(MAX_TEXT_BYTES) ?? EMPTY;
    const notes = reader.readBytes(MAX_TEXT_BYTES) ?? EMPTY;
    if (!reader.ok || id <= 0) return null;
    if (name.trim().length === 0 || clients.some((client) => client.id === id)) return null;
    clients.push({ id: id, name: name, contact: contact, notes: notes });
    if (id > maxClientId) maxClientId = id;
  }
  const projectCount = reader.readU32();
  if (!reader.ok || projectCount > MAX_ENTITIES) return null;
  const projects: Project[] = [];
  let maxProjectId = 0;
  for (let i = 0; i < projectCount; i += 1) {
    const id = reader.readU32();
    const clientId = reader.readU32();
    const targetMinutes = reader.readU32();
    const name = reader.readBytes(MAX_TEXT_BYTES) ?? EMPTY;
    if (!reader.ok) return null;
    if (id <= 0 || clientById(clients, clientId) === null || targetMinutes <= 0 || targetMinutes > 10080 || name.trim().length === 0 || projects.some((project) => project.id === id)) return null;
    projects.push({ id: id, clientId: clientId, name: name, targetMinutes: targetMinutes });
    if (id > maxProjectId) maxProjectId = id;
  }
  const slotCount = reader.readU32();
  if (!reader.ok || slotCount > MAX_SLOTS) return null;
  const slots: Slot[] = [];
  let maxSlotId = 0;
  for (let i = 0; i < slotCount; i += 1) {
    const id = reader.readU32();
    const projectId = reader.readU32();
    const dayIndex = reader.readU32();
    const startMinutes = reader.readU32();
    const durationMinutes = reader.readU32();
    const title = reader.readBytes(MAX_TEXT_BYTES) ?? EMPTY;
    const notes = reader.readBytes(MAX_TEXT_BYTES) ?? EMPTY;
    if (!reader.ok) return null;
    if (id <= 0 || projectById(projects, projectId) === null || dayIndex > MAX_DAY_INDEX || startMinutes >= MINUTES_PER_DAY || durationMinutes <= 0 || startMinutes + durationMinutes > MINUTES_PER_DAY || slots.some((slot) => slot.id === id) || hasSlotOverlap(slots, dayIndex, startMinutes, durationMinutes, 0)) return null;
    if (countSlotsInWeek(slots, weekStartFor(dayIndex)) >= MAX_SLOTS_PER_WEEK) return null;
    slots.push({ id: id, projectId: projectId, dayIndex: dayIndex, startMinutes: startMinutes, durationMinutes: durationMinutes, title: title, notes: notes });
    if (id > maxSlotId) maxSlotId = id;
  }
  if (!reader.finished()) return null;
  return {
    nextClientId: storedNextClientId > maxClientId ? storedNextClientId : maxClientId + 1,
    nextProjectId: storedNextProjectId > maxProjectId ? storedNextProjectId : maxProjectId + 1,
    nextSlotId: storedNextSlotId > maxSlotId ? storedNextSlotId : maxSlotId + 1,
    clients: clients,
    projects: projects,
    slots: slots,
  };
}

export function prepareMutation(previous: Model, candidate: Model, validationFailure: boolean): Model {
  if (encodedSize(candidate) > MAX_FILE_BYTES) {
    if (validationFailure) {
      return {
        ...previous,
        validationText: asciiBytes("Data file too large: shorten the title or notes."),
        statusText: asciiBytes("Change rejected: it would exceed the data file limit."),
      };
    }
    return { ...previous, statusText: asciiBytes("Change rejected: it would exceed the data file limit.") };
  }
  if (candidate.writeInFlight) return { ...candidate, statusText: asciiBytes("Save queued...") };
  return {
    ...candidate,
    writeInFlight: true,
    writeRevision: candidate.dataRevision,
    statusText: asciiBytes("Saving..."),
  };
}

export function shouldWrite(previous: Model, next: Model): boolean {
  if (!next.writeInFlight) return false;
  if (!previous.writeInFlight) return true;
  return next.writeRevision > previous.writeRevision;
}

export function stagedPath(model: Model): Bytes {
  return temporaryDataPath(model.dataPath);
}
