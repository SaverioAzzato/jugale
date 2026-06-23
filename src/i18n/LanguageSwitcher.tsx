import { LOCALES, useI18n, type Locale } from "./useI18n";

/** Centralized language picker — English default, Italian second. */
export function LanguageSwitcher() {
  const locale = useI18n((s) => s.locale);
  const setLocale = useI18n((s) => s.setLocale);
  return (
    <label className="lang-switcher" title="Language">
      <span className="lang-switcher-icon" aria-hidden>
        ⚐
      </span>
      <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)} aria-label="Language">
        {LOCALES.map((l) => (
          <option key={l.id} value={l.id}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
