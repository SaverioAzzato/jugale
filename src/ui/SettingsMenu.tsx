import { THEMES, useTheme, type ThemeId } from "../theme/useTheme";
import { LOCALES, useI18n, useT, type Locale } from "../i18n/useI18n";
import { useSettings, type UnitSystem } from "./useSettings";
import { Panel } from "../render/primitives";

const TOAST_OPTIONS = [5, 10, 15, 20, 0];

/** Gear icon button — opens the full settings page (App owns the open/close state). */
export function SettingsButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button type="button" className="btn btn-icon" aria-label={t("settings.title")} onClick={onClick}>
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        className="settings-icon"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5ZM9.75 2.25h4.5a.75.75 0 0 1 .73.58l.5 2.1a8.06 8.06 0 0 1 1.62.94l2.06-.76a.75.75 0 0 1 .9.33l2.1 3.64a.75.75 0 0 1-.16.95l-1.7 1.4a8.1 8.1 0 0 1 0 1.94l1.7 1.4a.75.75 0 0 1 .16.95l-2.1 3.64a.75.75 0 0 1-.9.33l-2.06-.76a8.06 8.06 0 0 1-1.62.94l-.5 2.1a.75.75 0 0 1-.73.58h-4.5a.75.75 0 0 1-.73-.58l-.5-2.1a8.06 8.06 0 0 1-1.62-.94l-2.06.76a.75.75 0 0 1-.9-.33l-2.1-3.64a.75.75 0 0 1 .16-.95l1.7-1.4a8.1 8.1 0 0 1 0-1.94l-1.7-1.4a.75.75 0 0 1-.16-.95l2.1-3.64a.75.75 0 0 1 .9-.33l2.06.76a8.06 8.06 0 0 1 1.62-.94l.5-2.1a.75.75 0 0 1 .73-.58Z"
        />
      </svg>
    </button>
  );
}

/** Full-page settings: language, theme, notification duration. */
export function SettingsPage() {
  const t = useT();
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const locale = useI18n((s) => s.locale);
  const setLocale = useI18n((s) => s.setLocale);
  const toastSeconds = useSettings((s) => s.toastSeconds);
  const setToastSeconds = useSettings((s) => s.setToastSeconds);
  const units = useSettings((s) => s.units);
  const setUnits = useSettings((s) => s.setUnits);

  return (
    <div className="settings-page">
      <Panel title={t("settings.title")}>
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
        <label className="settings-row">
          <span>{t("settings.units")}</span>
          <select value={units} onChange={(e) => setUnits(e.target.value as UnitSystem)}>
            <option value="imperial">{t("settings.unitsImperial")}</option>
            <option value="metric">{t("settings.unitsMetric")}</option>
          </select>
        </label>
      </Panel>
    </div>
  );
}
