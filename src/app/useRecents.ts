import { useCallback, useEffect, useState } from "react";
import { useCharacter } from "../characterStore";
import { useT } from "../i18n/useI18n";
import {
  clearRecents,
  listRecents,
  recentsSupported,
  recordRecent,
  removeRecent,
  reopenRecent,
  type RecentEntry,
} from "../storage/recents";
import { useToast } from "../ui/useToast";
import { isStorageError } from "../storage/errors";

export function useRecents(characterOpen: boolean) {
  const connect = useCharacter((state) => state.connect);
  const loadRaw = useCharacter((state) => state.loadRaw);
  const t = useT();
  const [recents, setRecents] = useState<RecentEntry[]>([]);

  const refresh = useCallback(() => {
    if (recentsSupported()) void listRecents().then(setRecents).catch(() => setRecents([]));
  }, []);

  useEffect(() => {
    if (!characterOpen) refresh();
  }, [characterOpen, refresh]);

  const reopen = useCallback(async (entry: RecentEntry) => {
    try {
      const result = await reopenRecent(entry);
      if (result.mode === "live") connect(result.provider, result.raw, result.sourceName, result.images);
      else loadRaw(result.raw, result.sourceName, result.images, true);
      void recordRecent(entry);
    } catch (error) {
      if (isStorageError(error, "recent-permission-denied") || isStorageError(error, "permission-denied")) {
        useToast.getState().push("error", t("recents.permissionDenied"));
        return;
      }
      useToast.getState().push("error", t("recents.reopenFailed"));
      await removeRecent(entry.key);
      refresh();
    }
  }, [connect, loadRaw, refresh, t]);

  const clear = useCallback(async () => {
    await clearRecents();
    refresh();
  }, [refresh]);

  const remove = useCallback(async (key: string) => {
    await removeRecent(key);
    setRecents((current) => current.filter((entry) => entry.key !== key));
  }, []);

  return { recents, reopenRecent: reopen, clearRecents: clear, removeRecent: remove };
}
