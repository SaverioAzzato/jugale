import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Caret } from "../render/primitives";
import { isTauri } from "../storage/tauriProvider";
import type { GalleryImage } from "../storage/provider";
import type { RecentEntry } from "../storage/recents";
import type { TFn } from "../i18n/useI18n";
import warlock from "../../characters/example-warlock/character.json";
import fighter from "../../characters/example-fighter/character.json";
import cleric from "../../characters/example-cleric/character.json";
import sorcerer from "../../characters/example-sorcerer/character.json";
import multiclass from "../../characters/example-multiclass/character.json";

// Sample images bundled at build time so the example portraits/gallery work with no real folder.
const imageModules = import.meta.glob("../../characters/*/images/*", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const IMAGE_RE = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

/** Images for a sample's folder, alphabetical by filename — same ordering the folder loaders use. */
function sampleImages(folder: string): GalleryImage[] {
  const prefix = `../../characters/${folder}/images/`;
  return Object.entries(imageModules)
    .filter(([path]) => path.startsWith(prefix) && IMAGE_RE.test(path))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, url]) => ({ name: `images/${path.slice(prefix.length)}`, url }));
}

const SAMPLES = [
  { key: "warlock", label: "Warlock", folder: "example-warlock", data: warlock },
  { key: "fighter", label: "Fighter", folder: "example-fighter", data: fighter },
  { key: "cleric", label: "Cleric", folder: "example-cleric", data: cleric },
  { key: "sorcerer", label: "Sorcerer", folder: "example-sorcerer", data: sorcerer },
  { key: "multiclass", label: "Multiclass", folder: "example-multiclass", data: multiclass },
];

/** The welcome screen shown when no character is loaded: open actions, recents, samples, footer. */
export function EmptyState({
  onOpenJson,
  onOpenFolder,
  onSample,
  recents,
  onReopenRecent,
  onRemoveRecent,
  onClearRecents,
  t,
}: {
  onOpenJson: () => void;
  onOpenFolder: () => void;
  onSample: (data: unknown, label: string, images: GalleryImage[]) => void;
  recents: RecentEntry[];
  onReopenRecent: (entry: RecentEntry) => void;
  onRemoveRecent: (key: string) => void;
  onClearRecents: () => void;
  t: TFn;
}) {
  const recentListRef = useRef<HTMLDivElement>(null);
  const [recentScrollEdges, setRecentScrollEdges] = useState({ up: false, down: false });
  const updateRecentScrollEdges = useCallback(() => {
    const list = recentListRef.current;
    if (!list) return;
    const maxScrollTop = list.scrollHeight - list.clientHeight;
    setRecentScrollEdges({
      up: list.scrollTop > 1,
      down: maxScrollTop > 1 && list.scrollTop < maxScrollTop - 1,
    });
  }, []);

  useLayoutEffect(() => {
    updateRecentScrollEdges();
    window.addEventListener("resize", updateRecentScrollEdges);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateRecentScrollEdges);
    if (recentListRef.current) observer?.observe(recentListRef.current);
    return () => {
      window.removeEventListener("resize", updateRecentScrollEdges);
      observer?.disconnect();
    };
  }, [recents, updateRecentScrollEdges]);

  return (
    <div className="empty-state">
      <div className="empty-brand">:JUGALE</div>
      <div className="empty-card">
        <h1>{t("empty.title")}</h1>
        <div className="empty-actions">
          <button type="button" className="empty-action" onClick={onOpenFolder}>
            <FolderIcon />
            {t("app.openFolder")}
          </button>
          <button type="button" className="empty-action" onClick={onOpenJson}>
            <BracesIcon />
            {t("app.open")}
          </button>
        </div>
      </div>
      {recents.length > 0 && (
        <div className="empty-recents">
          <div className="empty-recents-head">
            <span className="empty-recents-title">{t("recents.title")}</span>
            <button type="button" className="empty-recents-clear" onClick={onClearRecents}>
              {t("recents.clear")}
            </button>
          </div>
          <div
            className={`empty-recents-scroll${recentScrollEdges.up ? " can-scroll-up" : ""}${recentScrollEdges.down ? " can-scroll-down" : ""}`}
          >
            <div ref={recentListRef} className="empty-recents-list" onScroll={updateRecentScrollEdges}>
              {recents.map((e) => (
                <div key={e.key} className="recent-row">
                  <button
                    type="button"
                    className="recent-item"
                    onClick={() => onReopenRecent(e)}
                    title={e.path ?? e.name}
                  >
                    <span className="recent-icon" aria-hidden>
                      {e.kind === "folder" ? "🗂" : "📄"}
                    </span>
                    <span className="recent-name">{e.name}</span>
                  </button>
                  <button
                    type="button"
                    className="recent-remove"
                    onClick={() => onRemoveRecent(e.key)}
                    aria-label={`${t("recents.remove")}: ${e.name}`}
                    title={t("recents.remove")}
                  >
                    <span aria-hidden>×</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <details className="empty-samples-disclosure">
        <summary>
          <Caret open={false} />
          {t("empty.tryExample")}
        </summary>
        <div className="empty-samples">
          {SAMPLES.map((s) => (
            <button
              key={s.key}
              className="sample sample-grid-item"
              onClick={() => onSample(s.data, s.label, sampleImages(s.folder))}
            >
              {s.label}
            </button>
          ))}
        </div>
      </details>
      <footer className="empty-footer">
        <a
          className="empty-footer-link"
          href="https://github.com/SaverioAzzato/jugale"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        {/* "Get the app" is a web-only path to native downloads — pointless inside the app. */}
        {!isTauri() && (
          <>
            <span className="empty-footer-sep" aria-hidden>
              ·
            </span>
            <a
              className="empty-footer-link"
              href="https://github.com/SaverioAzzato/jugale/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("empty.getApp")}
            </a>
          </>
        )}
        <span className="empty-footer-sep" aria-hidden>
          ·
        </span>
        <span className="empty-footer-version">{__APP_VERSION__}</span>
      </footer>
    </div>
  );
}

const ICON_PROPS = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Lucide "folder". */
function FolderIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

/** Lucide "braces" — reads as JSON. */
function BracesIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1" />
      <path d="M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1" />
    </svg>
  );
}
