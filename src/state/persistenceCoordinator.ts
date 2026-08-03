import type { CharacterValidation } from "../schema";
import type { StorageProvider } from "../storage/provider";

export interface PersistenceState {
  provider: StorageProvider | null;
  liveSync: boolean;
  readOnly: boolean;
  draft: unknown | null;
  lastPersisted: unknown | null;
  validation: CharacterValidation | null;
  dirty: boolean;
  saveError: string | null;
}

interface PersistenceCoordinatorOptions<State extends PersistenceState> {
  get(): State;
  set(patch: Partial<PersistenceState>): void;
  reportFailure(provider: StorageProvider, error: unknown): void;
  schedule(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  cancelScheduled(handle: ReturnType<typeof setTimeout>): void;
  debounceMs?: number;
}

/** Owns debounce and write serialization; it can only write validation-issued persistable values. */
export function createPersistenceCoordinator<State extends PersistenceState>({
  get,
  set,
  reportFailure,
  schedule,
  cancelScheduled,
  debounceMs = 250,
}: PersistenceCoordinatorOptions<State>) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queue: Promise<boolean> = Promise.resolve(true);

  const cancel = () => {
    if (timer) cancelScheduled(timer);
    timer = null;
  };

  const persistCurrent = (): Promise<boolean> => {
    const write = queue.then(async () => {
      const { provider, liveSync, draft, validation, dirty } = get();
      if (!provider || !liveSync || draft == null || !dirty) return true;
      if (validation?.kind !== "valid") return false;
      const document = validation.persistable.document;
      try {
        await provider.write(validation.persistable);
        if (get().provider === provider && get().draft === draft) {
          set({ dirty: false, saveError: null, lastPersisted: document });
        }
        return true;
      } catch (error) {
        reportFailure(provider, error);
        return false;
      }
    });
    queue = write;
    return write;
  };

  const flush = async (): Promise<boolean> => {
    cancel();
    await queue;
    const { provider, dirty, liveSync, readOnly, validation } = get();
    if (dirty && validation?.kind !== "valid") return false;
    if (provider && dirty && (!liveSync || readOnly)) return false;
    return persistCurrent();
  };

  const schedulePersist = () => {
    cancel();
    timer = schedule(() => {
      timer = null;
      void persistCurrent();
    }, debounceMs);
  };

  return { cancel, flush, persistCurrent, schedule: schedulePersist };
}
