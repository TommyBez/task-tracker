import { asciiBytes } from "@native-sdk/core";
import { bytesEqual, dataPathForHome } from "../core-bytes.ts";
import { MAX_FILE_BYTES } from "../core-constants.ts";
import { decodeData, encodedSize } from "../core-storage.ts";
import type { Model, Msg } from "../core-types.ts";

export function reduceStorageMessage(model: Model, msg: Msg): Model {
  switch (msg.kind) {
    case "home_ready":
      if (msg.value.length === 0) {
        return {
          ...model,
          loading: false,
          storageReady: false,
          storageBlocked: true,
          statusText: asciiBytes("HOME is unavailable: saving is disabled."),
        };
      }
      return {
        ...model,
        dataPath: dataPathForHome(msg.value),
        loading: true,
        recoveryWarning: false,
        statusText: asciiBytes("Checking local data recovery..."),
      };
    case "recovery_loaded": {
      const decoded = decodeData(msg.bytes);
      if (decoded === null) {
        return {
          ...model,
          recoveryWarning: true,
          statusText: asciiBytes("Temporary data file is invalid; checking the main data file..."),
        };
      }
      return {
        ...model,
        clients: decoded.clients,
        projects: decoded.projects,
        slots: decoded.slots,
        nextClientId: decoded.nextClientId,
        nextProjectId: decoded.nextProjectId,
        nextSlotId: decoded.nextSlotId,
        dataRevision: 0,
        writeInFlight: false,
        writeRevision: 0,
        recoveryWarning: false,
        loading: true,
        storageReady: false,
        storageBlocked: false,
        statusText: asciiBytes("Recovering the latest save..."),
      };
    }
    case "recovery_load_failed":
      if (bytesEqual(msg.reason, asciiBytes("not_found"))) {
        return { ...model, recoveryWarning: false, statusText: asciiBytes("Loading the main data file...") };
      }
      return {
        ...model,
        loading: false,
        storageReady: false,
        storageBlocked: true,
        statusText: asciiBytes("Could not verify recovery; files were preserved and changes are disabled."),
      };
    case "recovery_committed":
      if (msg.code !== 0) {
        return {
          ...model,
          loading: false,
          storageReady: false,
          storageBlocked: true,
          statusText: asciiBytes("Recovery failed; files were preserved and changes are disabled."),
        };
      }
      return {
        ...model,
        loading: false,
        storageReady: true,
        storageBlocked: false,
        recoveryWarning: false,
        statusText: asciiBytes("Latest save recovered."),
      };
    case "recovery_commit_failed":
      return {
        ...model,
        loading: false,
        storageReady: false,
        storageBlocked: true,
        statusText: asciiBytes("Recovery could not start; files were preserved and changes are disabled."),
      };
    case "data_loaded": {
      const decoded = decodeData(msg.bytes);
      if (decoded === null) {
        return {
          ...model,
          loading: false,
          storageReady: false,
          storageBlocked: true,
          statusText: model.recoveryWarning
            ? asciiBytes("Temporary and main data files are invalid: files were preserved and changes are disabled.")
            : asciiBytes("Data file is invalid: the file was preserved and saving is disabled."),
        };
      }
      if (model.dataRevision > 0) {
        return { ...model, loading: false, storageReady: false, storageBlocked: true, statusText: asciiBytes("Data changed while loading: the data file was preserved.") };
      }
      return {
        ...model,
        clients: decoded.clients,
        projects: decoded.projects,
        slots: decoded.slots,
        nextClientId: decoded.nextClientId,
        nextProjectId: decoded.nextProjectId,
        nextSlotId: decoded.nextSlotId,
        writeInFlight: false,
        writeRevision: 0,
        loading: false,
        storageReady: true,
        storageBlocked: false,
        recoveryWarning: false,
        statusText: model.recoveryWarning
          ? asciiBytes("Main data file loaded; invalid temporary file ignored.")
          : asciiBytes("Local data loaded."),
      };
    }
    case "data_load_failed":
      if (bytesEqual(msg.reason, asciiBytes("not_found"))) {
        if (model.recoveryWarning) {
          return {
            ...model,
            loading: false,
            storageReady: false,
            storageBlocked: true,
            statusText: asciiBytes("Temporary data is invalid and the main file is missing: the file was preserved and changes are disabled."),
          };
        }
        const next: Model = {
          ...model,
          loading: false,
          storageReady: true,
          storageBlocked: false,
          statusText: asciiBytes("New local data file is ready."),
        };
        if (model.dataRevision === 0) return next;
        if (encodedSize(next) > MAX_FILE_BYTES) {
          return { ...next, storageReady: false, storageBlocked: true, statusText: asciiBytes("In-memory data is too large: saving is disabled.") };
        }
        return {
          ...next,
          writeInFlight: true,
          writeRevision: next.dataRevision,
          statusText: asciiBytes("Saving..."),
        };
      }
      return { ...model, loading: false, storageReady: false, storageBlocked: true, statusText: asciiBytes("Could not read the local data file; the file was preserved.") };
    case "data_staged":
      if (!model.writeInFlight) return model;
      return { ...model, statusText: asciiBytes("Finalizing save...") };
    case "data_committed":
      if (!model.writeInFlight) return model;
      if (msg.code !== 0) {
        return {
          ...model,
          writeInFlight: false,
          storageReady: false,
          storageBlocked: true,
          statusText: asciiBytes("Data file commit failed: changes are disabled."),
        };
      }
      if (model.dataRevision > model.writeRevision) {
        return { ...model, writeRevision: model.dataRevision, statusText: asciiBytes("Saving...") };
      }
      return {
        ...model,
        writeInFlight: false,
        writeRevision: model.dataRevision,
        statusText: asciiBytes("All changes are saved."),
      };
    case "data_commit_failed":
      return {
        ...model,
        writeInFlight: false,
        storageReady: false,
        storageBlocked: true,
        statusText: asciiBytes("Data file commit could not start: changes are disabled."),
      };
    case "data_save_failed":
      return {
        ...model,
        writeInFlight: false,
        storageReady: false,
        storageBlocked: true,
        statusText: asciiBytes("Save failed: further changes are disabled."),
      };
    default:
      return model;
  }
}
