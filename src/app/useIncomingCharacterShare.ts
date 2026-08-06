import { useCallback, useEffect, useRef, useState } from "react";
import { useCharacter } from "../characterStore";
import { useT, type StringKey } from "../i18n/useI18n";
import { loadCharacter } from "../schema";
import { isAndroid } from "../storage/androidProvider";
import { recordRecent } from "../storage/recents";
import { pickCharacterImportTarget } from "../storage/characterImport";
import type { CharacterImportTarget } from "../storage/provider";
import {
  listenForCharacterShares,
  takePendingCharacterShare,
  type IncomingSharePayload,
} from "../share/incomingCharacterShare";
import { useToast } from "../ui/useToast";
import { isStorageError } from "../storage/errors";

interface PendingIncomingCharacter {
  id: string;
  source: "android-share" | "file-import";
  sourceName: string;
  raw: unknown;
  preview: ReturnType<typeof loadCharacter>;
  target: CharacterImportTarget | null;
}

export function useIncomingCharacterShare(
  currentCharacterName: string | null,
  reportOpenError: (error: unknown) => void,
) {
  const connect = useCharacter((state) => state.connect);
  const replaceCharacter = useCharacter((state) => state.replaceCharacter);
  const flushPendingSave = useCharacter((state) => state.flushPendingSave);
  const versionBusy = useCharacter((state) => state.versionBusy);
  const t = useT();
  const [incoming, setIncoming] = useState<PendingIncomingCharacter | null>(null);
  const incomingIdRef = useRef<string | null>(null);

  const receive = useCallback((payload: IncomingSharePayload) => {
    if (payload.status === "empty") return;
    if (payload.status === "error") {
      useToast.getState().push("error", t(`incoming.error.${payload.error}` as StringKey));
      return;
    }
    if (incomingIdRef.current === payload.id) return;
    try {
      const raw = JSON.parse(payload.contents) as unknown;
      incomingIdRef.current = payload.id;
      setIncoming({
        id: payload.id,
        source: "android-share",
        sourceName: payload.name,
        raw,
        preview: loadCharacter(raw),
        target: null,
      });
    } catch {
      useToast.getState().push("error", t("incoming.error.invalid-json"));
    }
  }, [t]);

  useEffect(() => {
    if (!isAndroid()) return;
    let disposed = false;
    let listener: { unregister: () => Promise<void> } | null = null;
    void listenForCharacterShares((payload) => {
      if (!disposed) receive(payload);
    }).then(async (registered) => {
      if (disposed) {
        await registered?.unregister();
        return;
      }
      listener = registered;
      receive(await takePendingCharacterShare());
    }).catch(() => useToast.getState().push("error", t("incoming.error.unreadable")));
    return () => {
      disposed = true;
      if (listener) void listener.unregister();
    };
  }, [receive, t]);

  /** Stage a user-picked JSON through the same preview/validation path as an Android share. */
  const stageFileImport = useCallback((raw: unknown, sourceName: string) => {
    const id = `file-import-${Date.now()}`;
    incomingIdRef.current = id;
    setIncoming({
      id,
      source: "file-import",
      sourceName,
      raw,
      preview: loadCharacter(raw),
      target: null,
    });
  }, []);

  const chooseTarget = useCallback(async () => {
    if (!incoming || (incoming.source === "file-import" && currentCharacterName !== null)) return;
    try {
      const target = await pickCharacterImportTarget();
      if (target) setIncoming((current) => current ? { ...current, target } : null);
    } catch (error) {
      if (isStorageError(error, "import-target-not-empty")) {
        useToast.getState().push("error", t("incoming.targetNotEmpty"));
      } else if (isStorageError(error, "import-folder-unsupported")) {
        useToast.getState().push("error", t("import.folderUnsupported"));
      } else {
        reportOpenError(error);
      }
    }
  }, [currentCharacterName, incoming, reportOpenError, t]);

  const apply = useCallback(async () => {
    const pending = incoming;
    if (!pending || versionBusy || pending.preview.validation.kind !== "valid") return;
    if (pending.target?.kind === "existing") {
      if (!(await flushPendingSave())) return;
      connect(pending.target.provider, pending.target.raw, pending.target.sourceName, pending.target.images);
    } else if (pending.target?.kind === "empty") {
      if (!(await flushPendingSave())) return;
      try {
        const loaded = await pending.target.create(pending.preview.validation.persistable);
        connect(loaded.provider, loaded.raw, loaded.sourceName, loaded.images);
        void recordRecent(pending.target.ref);
        setIncoming(null);
        incomingIdRef.current = null;
        useToast.getState().push("success", t("incoming.applied"));
      } catch (error) {
        useToast.getState().push(
          "error",
          t("versions.replaceFailed"),
          error instanceof Error ? error.message : String(error),
        );
      }
      return;
    }
    if (await replaceCharacter(pending.raw, "before-import")) {
      if (pending.target) void recordRecent(pending.target.ref);
      setIncoming(null);
      incomingIdRef.current = null;
      useToast.getState().push("success", t("incoming.applied"));
    }
  }, [connect, flushPendingSave, incoming, replaceCharacter, t, versionBusy]);

  const cancel = useCallback(() => {
    if (versionBusy) return;
    setIncoming(null);
    incomingIdRef.current = null;
  }, [versionBusy]);

  const targetName = incoming?.target?.kind === "existing"
    ? loadCharacter(incoming.target.raw).character.meta.name
    : incoming?.target?.kind === "empty"
      ? incoming.target.sourceName
      : currentCharacterName;
  const nameMismatch = incoming
    ? incoming.target?.kind === "empty"
      ? false
      : targetName !== incoming.preview.character.meta.name
    : false;

  return { incoming, targetName, nameMismatch, stageFileImport, chooseTarget, apply, cancel };
}
