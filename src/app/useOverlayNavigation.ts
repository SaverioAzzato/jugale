import { useCallback, useEffect, useRef, useState } from "react";
import { onBackButtonPress } from "@tauri-apps/api/app";
import { isAndroid } from "../storage/androidProvider";
import { handleTransientBack, useUiBackDepth } from "../ui/uiBack";

export type AppOverlay = "settings" | "prompts" | "help" | "json" | "versions";

interface OverlayNavigationOptions {
  characterOpen: boolean;
  dirty: boolean;
  liveSync: boolean;
  versionBusy: boolean;
  clearCharacter(): void;
  confirmLeave(): boolean;
  reportNativeError?(error: unknown): void;
}

export function useOverlayNavigation({
  characterOpen,
  dirty,
  liveSync,
  versionBusy,
  clearCharacter,
  confirmLeave,
  reportNativeError = (error) => console.error("Could not register Android Back handler", error),
}: OverlayNavigationOptions) {
  const [overlay, setOverlay] = useState<AppOverlay | null>(null);
  const [saveVersionOpen, setSaveVersionOpen] = useState(false);
  const overlayBackRef = useRef<HTMLButtonElement>(null);
  const transientBackDepth = useUiBackDepth();

  const backToHome = useCallback((): boolean => {
    if (dirty && !liveSync && !confirmLeave()) return false;
    clearCharacter();
    return true;
  }, [clearCharacter, confirmLeave, dirty, liveSync]);

  const handleUiBack = useCallback((): boolean => {
    if (saveVersionOpen) {
      if (!versionBusy) setSaveVersionOpen(false);
      return true;
    }
    if (handleTransientBack()) return true;
    if (overlay) {
      setOverlay(null);
      return true;
    }
    return characterOpen ? backToHome() : false;
  }, [backToHome, characterOpen, overlay, saveVersionOpen, versionBusy]);

  // Full-page overlays focus their Back action and restore focus to their live trigger on close.
  useEffect(() => {
    if (!overlay) return;
    overlayBackRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (overlay === "json" && document.querySelector(".cm-tooltip-autocomplete, .cm-snippetField")) return;
      if (handleTransientBack()) return;
      setOverlay(null);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.querySelector<HTMLElement>(`[data-overlay-trigger="${overlay}"]`)?.focus();
    };
  }, [overlay]);

  // Android system Back mirrors the visible application Back action.
  useEffect(() => {
    if (!isAndroid() || (transientBackDepth === 0 && !saveVersionOpen && !overlay && !characterOpen)) return;
    let disposed = false;
    let listener: { unregister: () => Promise<void> } | null = null;
    void onBackButtonPress(() => { handleUiBack(); })
      .then((registered) => {
        if (disposed) void registered.unregister();
        else listener = registered;
      })
      .catch(reportNativeError);
    return () => {
      disposed = true;
      if (listener) void listener.unregister();
    };
  }, [characterOpen, handleUiBack, overlay, reportNativeError, saveVersionOpen, transientBackDepth]);

  return {
    overlay,
    setOverlay,
    saveVersionOpen,
    setSaveVersionOpen,
    overlayBackRef,
    handleUiBack,
  };
}
