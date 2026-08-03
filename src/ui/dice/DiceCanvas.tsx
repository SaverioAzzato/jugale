import { useEffect, useRef } from "react";
import type { DiceScene } from "./DiceScene";
import { useDice } from "../useDice";
import { useTheme } from "../../theme/useTheme";
import { useSettings } from "../useSettings";
import { useCharacter } from "../../characterStore";

/**
 * Mounts the WebGL dice layer and keeps it in sync with the dice store and theme.
 * All interaction (tap to dismiss, drag to move) lives in DiceScene; React only
 * owns the lifecycle. If WebGL is unavailable the layer simply no-ops.
 */
export function DiceCanvas({ layoutKey }: { layoutKey: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<DiceScene | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let disposed = false;
    let loading = false;
    const ensureScene = async () => {
      if (disposed || loading || sceneRef.current) return;
      loading = true;
      try {
        const { DiceScene: Scene } = await import("./DiceScene");
        if (disposed) return;
        const scene = new Scene(el);
        sceneRef.current = scene;
        scene.onTap = (id) => useDice.getState().dismiss(id);
        scene.sync(useDice.getState().dice);
      } catch (err) {
        console.error("Dice layer unavailable (WebGL init failed)", err);
      }
    };
    const syncDice = (dice: ReturnType<typeof useDice.getState>["dice"]) => {
      if (sceneRef.current) sceneRef.current.sync(dice);
      else if (dice.length > 0) void ensureScene();
    };
    syncDice(useDice.getState().dice);
    const unsubDice = useDice.subscribe((state) => syncDice(state.dice));
    const unsubTheme = useTheme.subscribe(() => sceneRef.current?.applyTheme());
    const unsubSettings = useSettings.subscribe(() => window.requestAnimationFrame(() => sceneRef.current?.reflowBounds()));
    const unsubCharacter = useCharacter.subscribe((state, previous) => {
      if (state.character !== previous.character) window.requestAnimationFrame(() => sceneRef.current?.reflowBounds());
    });
    return () => {
      disposed = true;
      unsubDice();
      unsubTheme();
      unsubSettings();
      unsubCharacter();
      const scene = sceneRef.current;
      sceneRef.current = null;
      scene?.dispose();
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => sceneRef.current?.reflowBounds());
    return () => window.cancelAnimationFrame(frame);
  }, [layoutKey]);

  return <div className="dice-canvas" ref={ref} aria-hidden="true" />;
}
