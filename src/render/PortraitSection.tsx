import { useCallback, useEffect, useRef, useState, type TouchEvent, type WheelEvent } from "react";
import { Panel } from "./primitives";
import { useT } from "../i18n/useI18n";
import { useCharacter } from "../state/store";
import type { Character } from "../schema";

const basename = (p: string): string => p.split("/").pop() || p;
const MAX_ZOOM = 4;
const GALLERY_SWIPE_PX = 48;

type Point = { x: number; y: number };

function touchPoint(touch: React.Touch): Point {
  return { x: touch.clientX, y: touch.clientY };
}

function distance(a: React.Touch, b: React.Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Portrait + image gallery for the Story tab. Images come from the loaded folder (runtime
 * `images`, filename order) — the JSON carries no image references at all; the first image
 * alphabetically is the portrait. Renders nothing when no folder/images were loaded.
 */
export function PortraitSection({ c }: { c: Character }) {
  const t = useT();
  const images = useCharacter((s) => s.images);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const gesture = useRef<
    | { kind: "swipe"; start: Point }
    | { kind: "pan"; start: Point; origin: Point }
    | { kind: "pinch"; distance: number; zoom: number }
    | null
  >(null);
  const wheelLock = useRef(false);
  const open = lightbox !== null;

  const resetTransform = useCallback(() => {
    gesture.current = null;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  const show = useCallback((delta: -1 | 1) => {
    setLightbox((i) => (i === null ? i : (i + delta + images.length) % images.length));
    resetTransform();
  }, [images.length, resetTransform]);

  function setClampedZoom(next: number) {
    const value = clamp(next, 1, MAX_ZOOM);
    setZoom(value);
    if (value === 1) setOffset({ x: 0, y: 0 });
  }

  function onImageTouchStart(e: TouchEvent<HTMLImageElement>) {
    if (e.touches.length === 2) {
      gesture.current = { kind: "pinch", distance: distance(e.touches[0], e.touches[1]), zoom };
      return;
    }
    if (e.touches.length !== 1) {
      gesture.current = null;
      return;
    }
    const start = touchPoint(e.touches[0]);
    gesture.current = zoom > 1 ? { kind: "pan", start, origin: offset } : { kind: "swipe", start };
  }

  function onImageTouchMove(e: TouchEvent<HTMLImageElement>) {
    const current = gesture.current;
    if (e.touches.length === 2) {
      e.preventDefault();
      const previous = current?.kind === "pinch"
        ? current
        : { kind: "pinch" as const, distance: distance(e.touches[0], e.touches[1]), zoom };
      gesture.current = previous;
      setClampedZoom(previous.zoom * (distance(e.touches[0], e.touches[1]) / previous.distance));
      return;
    }
    if (e.touches.length !== 1 || !current) return;
    const point = touchPoint(e.touches[0]);
    if (current.kind === "pan") {
      e.preventDefault();
      setOffset({
        x: current.origin.x + point.x - current.start.x,
        y: current.origin.y + point.y - current.start.y,
      });
    }
  }

  function onImageTouchEnd(e: TouchEvent<HTMLImageElement>) {
    const current = gesture.current;
    if (e.touches.length === 1 && current?.kind === "pinch") {
      const start = touchPoint(e.touches[0]);
      gesture.current = zoom > 1 ? { kind: "pan", start, origin: offset } : { kind: "swipe", start };
      return;
    }
    gesture.current = null;
    if (e.touches.length !== 0 || current?.kind !== "swipe" || zoom !== 1 || images.length < 2) return;
    const end = touchPoint(e.changedTouches[0]);
    const dx = end.x - current.start.x;
    const dy = end.y - current.start.y;
    if (Math.abs(dx) >= GALLERY_SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.25) show(dx < 0 ? 1 : -1);
  }

  function onImageWheel(e: WheelEvent<HTMLImageElement>) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setClampedZoom(zoom * Math.exp(-e.deltaY * 0.01));
      return;
    }
    if (images.length < 2 || Math.abs(e.deltaX) < 24 || Math.abs(e.deltaX) <= Math.abs(e.deltaY) || wheelLock.current) return;
    e.preventDefault();
    wheelLock.current = true;
    show(e.deltaX > 0 ? 1 : -1);
    window.setTimeout(() => { wheelLock.current = false; }, 280);
  }

  // Keyboard nav while the lightbox is open: Esc closes, arrows cycle.
  useEffect(() => {
    if (!open || images.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      else if (e.key === "ArrowRight") show(1);
      else if (e.key === "ArrowLeft") show(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, images.length, show]);

  useEffect(() => {
    if (!open) resetTransform();
  }, [open, resetTransform]);

  if (images.length === 0) return null;

  const portraitIdx = 0; // first image alphabetically is the portrait — no JSON reference
  const alt = c.meta.name || t("portrait.alt");

  return (
    <Panel plain>
      <div className="portrait">
        <button type="button" className="portrait-main" onClick={() => setLightbox(portraitIdx)} aria-label={alt}>
          <img src={images[portraitIdx].url} alt={alt} />
        </button>

        {images.length > 1 && (
          <div className="portrait-thumbs">
            {images.map((im, i) => (
              <button
                type="button"
                key={im.name}
                className={i === portraitIdx ? "portrait-thumb is-active" : "portrait-thumb"}
                onClick={() => setLightbox(i)}
                aria-label={basename(im.name)}
              >
                <img src={im.url} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div
          className="lightbox no-swipe"
          role="dialog"
          aria-modal="true"
          aria-label={t("portrait.viewer")}
          onClick={() => setLightbox(null)}
        >
          <img
            className={zoom > 1 ? "lightbox-img is-zoomed" : "lightbox-img"}
            src={images[lightbox].url}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setClampedZoom(zoom === 1 ? 2 : 1);
            }}
            onTouchStart={onImageTouchStart}
            onTouchMove={onImageTouchMove}
            onTouchEnd={onImageTouchEnd}
            onTouchCancel={() => { gesture.current = null; }}
            onWheel={onImageWheel}
            draggable={false}
            style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})` }}
          />
          <button type="button" className="lightbox-close" aria-label={t("portrait.close")} onClick={() => setLightbox(null)}>
            ×
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                className="lightbox-nav lightbox-prev"
                aria-label={t("portrait.prev")}
                onClick={(e) => {
                  e.stopPropagation();
                  show(-1);
                }}
              >
                ‹
              </button>
              <button
                type="button"
                className="lightbox-nav lightbox-next"
                aria-label={t("portrait.next")}
                onClick={(e) => {
                  e.stopPropagation();
                  show(1);
                }}
              >
                ›
              </button>
            </>
          )}
        </div>
      )}
    </Panel>
  );
}
