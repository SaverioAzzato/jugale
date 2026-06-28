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
  onClearRecents,
  t,
}: {
  onOpenJson: () => void;
  onOpenFolder: () => void;
  onSample: (data: unknown, label: string, images: GalleryImage[]) => void;
  recents: RecentEntry[];
  onReopenRecent: (entry: RecentEntry) => void;
  onClearRecents: () => void;
  t: TFn;
}) {
  return (
    <div className="empty-state">
      <div className="empty-brand">:JUGALE</div>
      <div className="empty-card">
        <h1>{t("empty.title")}</h1>
        <div className="empty-actions">
          <button className="btn btn-primary" onClick={onOpenFolder}>
            {t("app.openFolder")}
          </button>
          <button className="btn" onClick={onOpenJson}>
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
          <div className="empty-recents-list">
            {recents.map((e) => (
              <button
                key={e.key}
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
            ))}
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
