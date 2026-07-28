import { useEffect, useState, type ReactNode } from "react";
import { useT } from "../i18n/useI18n";

export function VersionDialog({
  label,
  children,
  onCancel,
}: {
  label: string;
  children: ReactNode;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div className="version-dialog-backdrop" onMouseDown={onCancel}>
      <section
        className="version-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </section>
    </div>
  );
}

export function SaveVersionDialog({
  busy,
  onCancel,
  onSave,
}: {
  busy: boolean;
  onCancel: () => void;
  onSave: (title: string) => void;
}) {
  const t = useT();
  const [title, setTitle] = useState("");
  return (
    <VersionDialog label={t("versions.save")} onCancel={onCancel}>
      <h2>{t("versions.save")}</h2>
      <label className="version-dialog-field">
        <span>{t("versions.versionTitle")}</span>
        <input
          autoFocus
          maxLength={120}
          value={title}
          placeholder={t("versions.versionTitlePlaceholder")}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !busy) onSave(title);
          }}
        />
      </label>
      <div className="version-dialog-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onSave(title)}>
          {t("versions.save")}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={onCancel}>
          {t("prompts.cancel")}
        </button>
      </div>
    </VersionDialog>
  );
}
