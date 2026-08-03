import { create } from "zustand";
import { en, type StringKey } from "./en";
import { it } from "./it";

export type { StringKey } from "./en";

export const LOCALES = [
  { id: "en", label: "English" },
  { id: "it", label: "Italiano" },
] as const;

export type Locale = (typeof LOCALES)[number]["id"];

const dict: Record<Locale, Record<StringKey, string>> = { en, it };
const KEY = "dndm.locale";
const initialLocale = ((): Locale => {
  if (typeof localStorage === "undefined") return "en";
  const saved = localStorage.getItem(KEY);
  return saved === "it" || saved === "en" ? saved : "en";
})();

interface I18nState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18n = create<I18nState>((set) => ({
  locale: initialLocale,
  setLocale: (locale) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, locale);
    set({ locale });
  },
}));

export type TFn = (key: StringKey) => string;

/** Non-hook translator — for use outside React (e.g. the store building a toast). */
export function translate(locale: Locale, key: StringKey): string {
  return dict[locale][key] ?? en[key] ?? key;
}

/** Hook returning the translator bound to the current locale. */
export function useT(): TFn {
  const locale = useI18n((state) => state.locale);
  return (key) => translate(locale, key);
}

/** Substitutes `{paramName}` tokens in a translated template. */
export function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}
