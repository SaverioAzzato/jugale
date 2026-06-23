import { useEffect, useRef, useState } from "react";
import { THEMES, useTheme, type ThemeId } from "../theme/useTheme";
import { LOCALES, useI18n, useT, type Locale } from "../i18n/useI18n";
import { useSettings } from "./useSettings";

const TOAST_OPTIONS = [5, 10, 15, 20, 0];

/** A single gear button opening a popover with language, theme and toast settings. */
export function SettingsMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const locale = useI18n((s) => s.locale);
  const setLocale = useI18n((s) => s.setLocale);
  const toastSeconds = useSettings((s) => s.toastSeconds);
  const setToastSeconds = useSettings((s) => s.setToastSeconds);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="settings" ref={ref}>
      <button
        type="button"
        className="btn btn-icon"
        aria-label={t("settings.title")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" className="settings-icon" aria-hidden="true" focusable="false">
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M19.4 13a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.87 1.2v.17a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 17.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 11a1.7 1.7 0 0 0-1.6-1.1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 4.6l-.06-.06A2 2 0 1 1 7.37 1.7l.06.06A1.7 1.7 0 0 0 9 2.1h.08A1.7 1.7 0 0 0 11 .5a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 17 2.1a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 21.9 7H22a2 2 0 1 1 0 4h-.09A1.7 1.7 0 0 0 19.4 13Z"
          />
        </svg>
      </button>

      {open && (
        <div className="settings-menu" role="menu">
          <label className="settings-row">
            <span>{t("settings.language")}</span>
            <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              {LOCALES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-row">
            <span>{t("settings.theme")}</span>
            <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeId)}>
              {THEMES.map((th) => (
                <option key={th.id} value={th.id}>
                  {th.label}
                </option>
              ))}
            </select>
          </label>
          <label className="settings-row">
            <span>{t("settings.toastDuration")}</span>
            <select value={toastSeconds} onChange={(e) => setToastSeconds(Number(e.target.value))}>
              {TOAST_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n === 0 ? t("settings.toastOff") : `${n}s`}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
