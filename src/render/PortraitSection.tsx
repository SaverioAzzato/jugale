import { useEffect, useState } from "react";
import { Panel } from "./primitives";
import { useT } from "../i18n/useI18n";
import { useCharacter } from "../state/store";
import type { Character } from "../schema";

const basename = (p: string): string => p.split("/").pop() || p;

/**
 * Portrait + image gallery for the Story tab. Images come from the loaded folder (runtime
 * `images`, filename order) — the JSON carries no image references at all; the first image
 * alphabetically is the portrait. Renders nothing when no folder/images were loaded.
 */
export function PortraitSection({ c }: { c: Character }) {
  const t = useT();
  const images = useCharacter((s) => s.images);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const open = lightbox !== null;

  // Keyboard nav while the lightbox is open: Esc closes, arrows cycle.
  useEffect(() => {
    if (!open || images.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      else if (e.key === "ArrowRight") setLightbox((i) => (i === null ? i : (i + 1) % images.length));
      else if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? i : (i - 1 + images.length) % images.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, images.length]);

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
        <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <img
            className="lightbox-img"
            src={images[lightbox].url}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
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
                  setLightbox((i) => (i === null ? i : (i - 1 + images.length) % images.length));
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
                  setLightbox((i) => (i === null ? i : (i + 1) % images.length));
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
