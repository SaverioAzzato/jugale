export const STORAGE_ERROR_CODES = [
  "no-character-json",
  "recent-permission-denied",
  "import-target-not-empty",
  "not-found",
  "permission-denied",
  "io-failed",
  "invalid-version-filename",
] as const;

export type StorageErrorCode = (typeof STORAGE_ERROR_CODES)[number];

/** Stable application error at an I/O boundary; `cause` retains the host-specific failure. */
export class StorageError extends Error {
  readonly name = "StorageError";

  constructor(
    readonly code: StorageErrorCode,
    message: string = code,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

export function isStorageError(error: unknown, code?: StorageErrorCode): error is StorageError {
  return error instanceof StorageError && (code === undefined || error.code === code);
}

export function storageError(
  code: StorageErrorCode,
  cause?: unknown,
  message: string = code,
): StorageError {
  return new StorageError(code, message, { cause });
}

/** Normalize structured browser/host failures while retaining their original cause. */
export function normalizeStorageError(
  error: unknown,
  fallback: StorageErrorCode = "io-failed",
): StorageError {
  if (isStorageError(error)) return error;
  if (error instanceof DOMException) {
    if (error.name === "NotFoundError") return storageError("not-found", error, error.message);
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return storageError("permission-denied", error, error.message);
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  return storageError(fallback, error, message);
}
