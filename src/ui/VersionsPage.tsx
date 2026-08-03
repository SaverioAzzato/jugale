import { useCallback, useEffect, useState } from "react";
import type { CharacterVersion, VersionReason } from "../storage/versions";
import { interpolate, useI18n, useT, type StringKey } from "../i18n/useI18n";
import { useCharacter } from "../characterStore";
import { useToast } from "./useToast";
import { VersionDialog } from "./VersionDialog";

const REASON_KEYS: Record<VersionReason, StringKey> = {
  checkpoint: "versions.reason.checkpoint",
  "before-import": "versions.reason.before-import",
  "before-restore": "versions.reason.before-restore",
};

function RestoreIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 10v6M14 10v6" />
    </svg>
  );
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
  const [readingId, setReadingId] = useState<string | null>(null);
  const [unreadableIds, setUnreadableIds] = useState<Set<string>>(new Set());
  const [pendingRestore, setPendingRestore] = useState<{ version: CharacterVersion; raw: unknown } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<CharacterVersion | null>(null);

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

  async function requestRestore(version: CharacterVersion) {
    if (!store || versionBusy || readingId) return;
    setReadingId(version.id);
    setUnreadableIds((ids) => {
      const next = new Set(ids);
      next.delete(version.id);
      return next;
    });
    try {
      setPendingRestore({ version, raw: await store.read(version) });
    } catch {
      setUnreadableIds((ids) => new Set(ids).add(version.id));
    } finally {
      setReadingId(null);
    }
  }

  async function restore(saveCurrent: boolean) {
    if (!pendingRestore || versionBusy) return;
    const { raw, version } = pendingRestore;
    if (await replaceCharacter(raw, "before-restore", saveCurrent)) {
      useToast.getState().push("success", interpolate(t("versions.restored"), { filename: version.filename }));
      setPendingRestore(null);
      onRestored();
    }
  }

  async function deleteVersion() {
    if (!store || !pendingDelete || versionBusy) return;
    const target = pendingDelete;
    try {
      await store.delete(target);
      setVersions((current) => current.filter((version) => version.id !== target.id));
      setPendingDelete(null);
      useToast.getState().push("success", t("versions.deleted"));
    } catch (error) {
      useToast.getState().push(
        "error",
        t("versions.deleteFailed"),
        error instanceof Error ? error.message : String(error),
      );
    }
  }

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
              <li key={version.id} className="version-row">
                <div className="version-row-copy">
                  {version.title && <strong className="version-row-title">{version.title}</strong>}
                  <time dateTime={version.createdAt}>
                    {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(version.createdAt))}
                  </time>
                  <span>{t(REASON_KEYS[version.reason])}</span>
                  {unreadableIds.has(version.id) && <span className="version-error">{t("versions.unreadable")}</span>}
                </div>
                <div className="version-row-actions">
                  <button
                    type="button"
                    className="btn btn-icon"
                    disabled={versionBusy || readingId !== null}
                    aria-label={t("versions.restore")}
                    title={t("versions.restore")}
                    onClick={() => void requestRestore(version)}
                  >
                    <RestoreIcon />
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-danger"
                    disabled={versionBusy || readingId !== null}
                    aria-label={t("versions.delete")}
                    title={t("versions.delete")}
                    onClick={() => setPendingDelete(version)}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingRestore && (
        <VersionDialog label={t("versions.restore")} onCancel={() => setPendingRestore(null)}>
          <h2>{t("versions.restore")}</h2>
          <p>{t("versions.saveCurrentQuestion")}</p>
          <div className="version-dialog-actions">
            <button type="button" className="btn btn-primary" disabled={versionBusy} onClick={() => void restore(true)}>{t("common.yes")}</button>
            <button type="button" className="btn" disabled={versionBusy} onClick={() => void restore(false)}>{t("common.no")}</button>
            <button type="button" className="btn" disabled={versionBusy} onClick={() => setPendingRestore(null)}>{t("prompts.cancel")}</button>
          </div>
        </VersionDialog>
      )}

      {pendingDelete && (
        <VersionDialog label={t("versions.delete")} onCancel={() => setPendingDelete(null)}>
          <h2>{t("versions.delete")}</h2>
          <p>{t("versions.confirmDelete")}</p>
          <div className="version-dialog-actions">
            <button type="button" className="btn btn-danger" disabled={versionBusy} onClick={() => void deleteVersion()}>{t("versions.delete")}</button>
            <button type="button" className="btn" disabled={versionBusy} onClick={() => setPendingDelete(null)}>{t("prompts.cancel")}</button>
          </div>
        </VersionDialog>
      )}
    </main>
  );
}
