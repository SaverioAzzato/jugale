import { useEffect, useRef, useState, type ReactNode } from "react";
import { useT } from "../i18n/useI18n";
import { useDice } from "./useDice";

/** Each die type maps to a simple regular polygon (n sides, rotation) used as its glyph. */
const DICE: { sides: number; n: number; rot: number }[] = [
  { sides: 4, n: 3, rot: -90 }, // triangle
  { sides: 6, n: 4, rot: 45 }, // square
  { sides: 8, n: 4, rot: 0 }, // diamond
  { sides: 10, n: 5, rot: -90 }, // pentagon
  { sides: 12, n: 6, rot: -90 }, // hexagon
  { sides: 20, n: 8, rot: 22.5 }, // octagon
  { sides: 100, n: 10, rot: -90 }, // decagon
];

function polygonPoints(n: number, rot: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = ((rot + (i * 360) / n) * Math.PI) / 180;
    pts.push(`${(50 + 42 * Math.cos(a)).toFixed(1)},${(50 + 42 * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

const SHAPE: Record<number, string> = Object.fromEntries(DICE.map((d) => [d.sides, polygonPoints(d.n, d.rot)]));

/** A themed die glyph (polygon + optional centered number). Colors come from theme tokens. */
function DieShape({ sides, label }: { sides: number; label?: ReactNode }) {
  return (
    <svg className="die-svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <polygon points={SHAPE[sides]} />
      {label != null && (
        <text x="50" y="50" className="die-svg-label">
          {label}
        </text>
      )}
    </svg>
  );
}

/**
 * Topbar dice palette. Two ways to roll:
 *  - tap the toggle to open, then click a die;
 *  - press the toggle, drag onto a die, and release (faster).
 * Releasing on empty space cancels; tapping the toggle again closes it.
 */
export function DicePalette() {
  const t = useT();
  const roll = useDice((s) => s.roll);
  const [open, setOpen] = useState(false);
  // The menu is position:fixed (the toolbar clips overflow), anchored under the toggle.
  const [pos, setPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pressRef = useRef<{ x: number; y: number; moved: boolean; wasOpen: boolean } | null>(null);

  const openMenu = () => {
    const r = toggleRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    setOpen(true);
  };

  // Close on Escape, on a pointerdown outside the palette, or reposition on resize/scroll.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const reposition = () => {
      const r = toggleRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 8, right: window.innerWidth - r.right });
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  const dieAt = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-die]");
    return el ? Number(el.dataset.die) : null;
  };
  const onToggle = (x: number, y: number): boolean =>
    !!document.elementFromPoint(x, y)?.closest("[data-dice-toggle]");

  const onTogglePointerDown = (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return;
    const wasOpen = open;
    pressRef.current = { x: e.clientX, y: e.clientY, moved: false, wasOpen };
    if (!wasOpen) openMenu();

    const onMove = (ev: PointerEvent) => {
      const p = pressRef.current;
      if (p && Math.hypot(ev.clientX - p.x, ev.clientY - p.y) > 6) p.moved = true;
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const p = pressRef.current;
      pressRef.current = null;
      const sides = dieAt(ev.clientX, ev.clientY);
      if (sides != null) {
        roll(sides);
        setOpen(false);
        return;
      }
      if (p?.moved) {
        setOpen(false); // dragged out to empty space → cancel
        return;
      }
      if (p?.wasOpen && onToggle(ev.clientX, ev.clientY)) setOpen(false); // tap to close
      // otherwise the tap just opened it — leave open for click-to-pick
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Keyboard activation (Enter/Space) produces a click with detail 0; mouse clicks are
  // detail >= 1 and already handled by the pointer flow above.
  const onToggleClick = (e: React.MouseEvent) => {
    if (e.detail !== 0) return; // keyboard only
    if (open) setOpen(false);
    else openMenu();
  };

  return (
    <div className="dice-palette" ref={ref}>
      <button
        ref={toggleRef}
        type="button"
        className="btn btn-icon dice-toggle"
        data-dice-toggle
        aria-label={t("dice.roll")}
        aria-haspopup="menu"
        aria-expanded={open}
        onPointerDown={onTogglePointerDown}
        onClick={onToggleClick}
      >
        <DieShape sides={20} />
      </button>
      {open && (
        <div className="dice-menu" role="menu" style={{ top: pos.top, right: pos.right }}>
          {DICE.map((d) => (
            <button
              key={d.sides}
              type="button"
              role="menuitem"
              className="dice-option"
              data-die={d.sides}
              onClick={() => {
                roll(d.sides);
                setOpen(false);
              }}
            >
              <DieShape sides={d.sides} />
              <span>d{d.sides}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
