import { useCallback, useEffect, useRef, type ChangeEvent } from "react";
import { useCharacter } from "../characterStore";
import { useT } from "../i18n/useI18n";
import {
  importCharacterFolder,
  importJsonFile,
  isDirectoryAccessSupported,
  isFileAccessSupported,
  openCharacterFile,
  openCharacterFolder,
} from "../storage/provider";
import { openCharacterFileTauri, openCharacterFolderTauri, isTauri } from "../storage/tauriProvider";
import { isAndroid, openCharacterFileAndroid, openCharacterFolderAndroid } from "../storage/androidProvider";
import { recordRecent } from "../storage/recents";
import { useToast } from "../ui/useToast";
import { isStorageError } from "../storage/errors";

export function useCharacterOpening() {
  const loadRaw = useCharacter((state) => state.loadRaw);
  const connect = useCharacter((state) => state.connect);
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileAccessSupported = isTauri() || isFileAccessSupported();

  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
  }, []);

  const reportOpenError = useCallback((error: unknown) => {
    const push = useToast.getState().push;
    if (isStorageError(error, "no-character-json")) {
      push("error", t("app.noCharacterJson"));
    } else if (error instanceof SyntaxError) {
      push("error", t("app.invalidJson"));
    } else {
      const detail = error instanceof Error ? error.message : String(error);
      push("error", `${t("app.openFailed")}: ${detail}`);
    }
  }, [t]);

  const openFile = useCallback(async () => {
    try {
      const result = isAndroid()
        ? await openCharacterFileAndroid()
        : isTauri()
          ? await openCharacterFileTauri()
          : await openCharacterFile();
      if (result) {
        connect(result.provider, result.raw, result.ref.name);
        void recordRecent(result.ref);
      }
    } catch (error) {
      reportOpenError(error);
    }
  }, [connect, reportOpenError]);

  const openFolder = useCallback(async () => {
    try {
      const result = isAndroid()
        ? await openCharacterFolderAndroid()
        : isTauri()
          ? await openCharacterFolderTauri()
          : await openCharacterFolder();
      if (result) {
        connect(result.provider, result.raw, result.sourceName, result.images);
        void recordRecent(result.ref);
      }
    } catch (error) {
      reportOpenError(error);
    }
  }, [connect, reportOpenError]);

  const handleOpenJson = useCallback(() => {
    if (fileAccessSupported) void openFile();
    else fileInputRef.current?.click();
  }, [fileAccessSupported, openFile]);

  const handleOpenFolder = useCallback(() => {
    if (isTauri() || isDirectoryAccessSupported()) void openFolder();
    else folderInputRef.current?.click();
  }, [openFolder]);

  const handleImportFile = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const raw = await importJsonFile(file);
      loadRaw(raw, file.name, [], true);
      void recordRecent({ platform: "snapshot", kind: "file", name: file.name, raw, images: [] });
    } catch {
      useToast.getState().push("error", t("app.invalidJson"));
    }
  }, [loadRaw, t]);

  const handleImportFolder = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      event.target.value = "";
      return;
    }
    try {
      const result = await importCharacterFolder(files);
      loadRaw(result.raw, result.sourceName, result.images, true);
      void recordRecent({
        platform: "snapshot",
        kind: "folder",
        name: result.sourceName,
        raw: result.raw,
        images: result.imageBlobs,
      });
    } catch (error) {
      const key = isStorageError(error, "no-character-json")
        ? "app.noCharacterJson"
        : "app.invalidJson";
      useToast.getState().push("error", t(key));
    } finally {
      event.target.value = "";
    }
  }, [loadRaw, t]);

  return {
    fileInputRef,
    folderInputRef,
    handleOpenJson,
    handleOpenFolder,
    handleImportFile,
    handleImportFolder,
    reportOpenError,
  };
}
