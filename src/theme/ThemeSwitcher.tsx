import { THEMES, useTheme, type ThemeId } from "./useTheme";

/** Centralized theme picker — the only UI that changes the active theme. */
export function ThemeSwitcher() {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  return (
    <label className="theme-switcher" title="Tema">
      <span className="theme-switcher-icon" aria-hidden>
        ◑
      </span>
      <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeId)} aria-label="Tema">
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </label>
  );
}
