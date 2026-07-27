import { useCallback, useEffect, useState } from "react";
import { loadCharacter, type Character, type Issue } from "../schema";
import type { CharacterVersion, VersionReason } from "../storage/versions";
import { interpolate, useI18n, useT, type StringKey } from "../i18n/useI18n";
import { useCharacter } from "../state/store";
import { useToast } from "./useToast";

interface Preview {
  raw: unknown;
  character: Character;
  issues: Issue[];
  schemaVersion: string;
}

const REASON_KEYS: Record<VersionReason, StringKey> = {
  checkpoint: "versions.reason.checkpoint",
  "before-import": "versions.reason.before-import",
  "before-restore": "versions.reason.before-restore",
};

function issueCounts(issues: Issue[]): { errors: number; warnings: number } {
  return {
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length,
  };
}

export function VersionsPage({ onRestored }: { onRestored: () => void }) {
  const t = useT();
  const locale = useI18n((state) => state.locale);
  const provider = useCharacter((state) => state.provider);
  const replaceCharacter = useCharacter((state) => state.replaceCharacter);
  const versionBusy = useCharacter((state) => state.versionBusy);
  const [versions, setVersions] = useState<CharacterVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(false);
  const [selected, setSelected] = useState<CharacterVersion | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const store = provider?.versions;
  const loadVersions = useCallback(async () => {
    if (!store) {
      setVersions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setListError(false);
    try {
      setVersions(await store.list());
    } catch {
      setListError(true);
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void loadVersions();
  }, [loadVersions]);

  const openPreview = async (version: CharacterVersion) => {
    if (!store) return;
    setSelected(version);
    setPreview(null);
    setPreviewError(false);
    setPreviewLoading(true);
    try {
      const raw = await store.read(version);
      const loaded = loadCharacter(raw);
      const rawVersion = (raw as { schemaVersion?: unknown } | null)?.schemaVersion;
      setPreview({
        raw,
        character: loaded.character,
        issues: loaded.issues,
        schemaVersion: typeof rawVersion === "string" ? rawVersion : loaded.character.schemaVersion,
      });
    } catch {
      setPreviewError(true);
    } finally {
      setPreviewLoading(false);
    }
  };

  const restore = async () => {
    if (!selected || !preview || versionBusy) return;
    const counts = issueCounts(preview.issues);
    const confirmed = window.confirm(
      interpolate(t("versions.confirmRestore"), {
        filename: selected.filename,
        errors: counts.errors,
        warnings: counts.warnings,
      }),
    );
    if (!confirmed) return;
    if (await replaceCharacter(preview.raw, "before-restore")) {
      useToast.getState().push(
        "success",
        interpolate(t("versions.restored"), { filename: selected.filename }),
      );
      onRestored();
    }
  };

  return (
    <main className="versions-page" aria-labelledby="versions-heading">
      <section className="panel">
        <h2 id="versions-heading" className="panel-title">{t("versions.title")}</h2>
        {loading ? (
          <p className="versions-state">{t("versions.loading")}</p>
        ) : listError ? (
          <div className="versions-state">
            <p>{t("versions.listFailed")}</p>
            <button type="button" className="btn" onClick={() => void loadVersions()}>{t("versions.retry")}</button>
          </div>
        ) : versions.length === 0 ? (
          <p className="versions-state">{t("versions.empty")}</p>
        ) : (
          <ul className="versions-list">
            {versions.map((version) => (
              <li key={version.id} className={selected?.id === version.id ? "version-row is-selected" : "version-row"}>
                <div>
                  <strong>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(version.createdAt))}</strong>
                  <span>{t(REASON_KEYS[version.reason])}</span>
                  <code>{version.filename}</code>
                </div>
                <button type="button" className="btn" onClick={() => void openPreview(version)}>
                  {t("versions.preview")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <section className="panel version-preview" aria-live="polite">
          <h2 className="panel-title">{t("versions.preview")}</h2>
          {previewLoading ? (
            <p>{t("versions.loadingPreview")}</p>
          ) : previewError || !preview ? (
            <p className="version-error">{t("versions.unreadable")}</p>
          ) : (
            <>
              <dl className="version-preview-grid">
                <div><dt>{t("versions.character")}</dt><dd>{preview.character.meta.name}</dd></div>
                <div><dt>{t("versions.classes")}</dt><dd>{preview.character.classes.map((entry) => `${entry.name} ${entry.level}`).join(" / ") || "—"}</dd></div>
                <div><dt>{t("versions.schema")}</dt><dd>{preview.schemaVersion}</dd></div>
                <div><dt>{t("versions.validation")}</dt><dd>{interpolate(t("versions.issueCounts"), issueCounts(preview.issues))}</dd></div>
              </dl>
              <button type="button" className="btn btn-danger" disabled={versionBusy} onClick={() => void restore()}>
                {t("versions.restore")}
              </button>
            </>
          )}
        </section>
      )}
    </main>
  );
}
