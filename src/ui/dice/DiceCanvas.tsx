import { useEffect, useRef } from "react";
import { DiceScene } from "./DiceScene";
import { useDice } from "../useDice";
import { useTheme } from "../../theme/useTheme";

/**
 * Mounts the WebGL dice layer and keeps it in sync with the dice store and theme.
 * All interaction (tap to dismiss, drag to move) lives in DiceScene; React only
 * owns the lifecycle. If WebGL is unavailable the layer simply no-ops.
 */
export function DiceCanvas() {
  const ref = useRef<HTMLDivElement>(null);

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
    scene.onTap = (id) => useDice.getState().dismiss(id);
    scene.sync(useDice.getState().dice);
    const unsubDice = useDice.subscribe((s) => scene.sync(s.dice));
    const unsubTheme = useTheme.subscribe(() => scene.applyTheme());
    return () => {
      unsubDice();
      unsubTheme();
      scene.dispose();
    };
  }, []);

  return <div className="dice-canvas" ref={ref} aria-hidden="true" />;
}
