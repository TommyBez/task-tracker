import { asciiBytes } from "@native-sdk/core";
import { PATH_SUFFIX, TEMP_SUFFIX } from "./core-constants.ts";
import type { Bytes } from "./core-types.ts";

export function concat2(a: Bytes, b: Bytes): Bytes {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

export function bytesPreview(value: Bytes, maxBytes: number): Bytes {
  if (value.length <= maxBytes) return value;
  let end = maxBytes - 3;
  while (end > 0 && (value[end] & 192) === 128) end -= 1;
  return concat2(value.slice(0, end), asciiBytes("..."));
}

export function concat3(a: Bytes, b: Bytes, c: Bytes): Bytes {
  const out = new Uint8Array(a.length + b.length + c.length);
  out.set(a, 0);
  out.set(b, a.length);
  out.set(c, a.length + b.length);
  return out;
}

export function concat5(a: Bytes, b: Bytes, c: Bytes, d: Bytes, e: Bytes): Bytes {
  const out = new Uint8Array(a.length + b.length + c.length + d.length + e.length);
  out.set(a, 0);
  out.set(b, a.length);
  out.set(c, a.length + b.length);
  out.set(d, a.length + b.length + c.length);
  out.set(e, a.length + b.length + c.length + d.length);
  return out;
}

export function bytesEqual(a: Bytes, b: Bytes): boolean {
  return a.length === b.length && a.startsWith(b);
}

export function dataPathForHome(home: Bytes): Bytes {
  return concat2(home, PATH_SUFFIX);
}

export function temporaryDataPath(dataPath: Bytes): Bytes {
  return concat2(dataPath, TEMP_SUFFIX);
}
