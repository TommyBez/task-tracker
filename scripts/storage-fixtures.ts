import { encodeData } from "../src/core-storage.ts";
import { UNASSIGNED_FORMAT_VERSION } from "../src/core-constants.ts";
import type { Model } from "../src/core-types.ts";

// V3 has the same layout as V4 except for the project's budget-kind word.
export function encodeV3(model: Model): Uint8Array {
  const current = encodeData(model);
  const view = new DataView(current.buffer);
  let offset = 24;
  for (const client of model.clients) offset += 16 + client.name.length + client.contact.length + client.notes.length;
  offset += 4;
  const removed = new Set<number>();
  for (const project of model.projects) {
    for (let i = 0; i < 4; i++) removed.add(offset + 16 + i);
    offset += 24 + project.name.length;
  }
  view.setUint32(4, UNASSIGNED_FORMAT_VERSION, true);
  return current.filter((_, index) => !removed.has(index));
}
