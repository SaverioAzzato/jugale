import { describe, expect, it } from "vitest";
import { isStorageError, normalizeStorageError, storageError } from "./errors";

describe("storage errors", () => {
  it("preserves typed errors and their causes", () => {
    const cause = new Error("disk full");
    const error = storageError("io-failed", cause, "Could not write");
    expect(isStorageError(error, "io-failed")).toBe(true);
    expect(error.cause).toBe(cause);
  });

  it("separates browser not-found and permission failures", () => {
    const missing = normalizeStorageError(new DOMException("gone", "NotFoundError"));
    const denied = normalizeStorageError(new DOMException("denied", "NotAllowedError"));
    expect(missing.code).toBe("not-found");
    expect(denied.code).toBe("permission-denied");
  });

  it("uses an explicit I/O fallback for unstructured host errors", () => {
    const error = normalizeStorageError(new Error("native plugin failed"));
    expect(error).toMatchObject({ code: "io-failed", message: "native plugin failed" });
  });
});
