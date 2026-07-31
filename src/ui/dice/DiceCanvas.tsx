import { useEffect, useRef } from "react";
import { DiceScene } from "./DiceScene";
import { useDice } from "../useDice";
import { useTheme } from "../../theme/useTheme";
import { useSettings } from "../useSettings";
import { useCharacter } from "../../state/store";

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
    let scene: DiceScene;
    try {
      scene = new DiceScene(el);
    } catch (err) {
      console.error("Dice layer unavailable (WebGL init failed)", err);
      return;
    }
    sceneRef.current = scene;
    scene.onTap = (id) => useDice.getState().dismiss(id);
    scene.sync(useDice.getState().dice);
    const unsubDice = useDice.subscribe((s) => scene.sync(s.dice));
    const unsubTheme = useTheme.subscribe(() => scene.applyTheme());
    const unsubSettings = useSettings.subscribe(() => window.requestAnimationFrame(() => scene.reflowBounds()));
    const unsubCharacter = useCharacter.subscribe((state, previous) => {
      if (state.character !== previous.character) window.requestAnimationFrame(() => scene.reflowBounds());
    });
    return () => {
      unsubDice();
      unsubTheme();
      unsubSettings();
      unsubCharacter();
      sceneRef.current = null;
      scene.dispose();
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => sceneRef.current?.reflowBounds());
    return () => window.cancelAnimationFrame(frame);
  }, [layoutKey]);

  return <div className="dice-canvas" ref={ref} aria-hidden="true" />;
}
