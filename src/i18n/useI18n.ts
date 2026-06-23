import { create } from "zustand";

/**
 * Tiny centralized i18n. English is the default; Italian is the second locale.
 * `en` is the canonical key set (its keys type every other locale), so a missing
 * translation is a type error, and `t` falls back to English then to the key.
 *
 * UI chrome only — character *data* is never translated (it's the user's content).
 */

export const LOCALES = [
  { id: "en", label: "English" },
  { id: "it", label: "Italiano" },
] as const;

export type Locale = (typeof LOCALES)[number]["id"];

const en = {
  // chrome / toolbar
  "app.export": "Export JSON",
  "app.open": "Open JSON",
  "app.back": "Back",
  "app.backTitle": "Back to the start screen",
  "app.confirmLeave": "There are unexported changes. Go back to the home screen?",
  "app.invalidJson": "Invalid JSON file.",
  "empty.title": "Your character, always yours.",
  "empty.body": "Open your character.json folder to get started.",
  "empty.tryExample": "Or try an example",
  "status.file": "File",
  "status.unnamed": "(unnamed)",
  "status.live": "Live sync",
  "status.unsaved": "Unexported changes",
  "status.memory": "In memory",
  "status.saveError": "Save error",
  // tabs
  "tab.gioco": "Play",
  "tab.scheda": "Attributes",
  "tab.inventario": "Inventory",
  "tab.storia": "Story",
  // header
  "header.level": "Level",
  "header.proficiency": "Proficiency",
  // vitals
  "vitals.title": "Vitals",
  "vitals.ac": "AC",
  "vitals.initiative": "Initiative",
  "vitals.speed": "Speed",
  "vitals.damage": "Damage",
  "vitals.heal": "Heal",
  "vitals.hp": "HP",
  "vitals.temp": "Temp",
  "vitals.hitDice": "Hit Dice",
  "vitals.shortRest": "Short rest",
  "vitals.longRest": "Long rest",
  "ac.manual": "manual",
  // status
  "status.title": "Status",
  "status.addCondition": "+ condition",
  "status.conditionPlaceholder": "condition…",
  "status.inspiration": "Inspiration",
  "status.deathSaves": "Death saving throws",
  "status.successes": "Successes",
  "status.failures": "Failures",
  // attacks
  "attacks.title": "Attacks",
  "attacks.innate": "innate",
  "attacks.notInHand": "not in hand · switching = 1 action",
  "attacks.modes": "attack modes",
  // shared detail labels
  "detail.range": "Range",
  "detail.yourRoll": "Your roll",
  "detail.enemyRoll": "Enemy roll",
  "detail.damageEffect": "Damage/Effect",
  "detail.notes": "Notes",
  "detail.openWiki": "Open on the wiki ↗",
  // spells
  "spells.title": "Spells",
  "spells.dc": "DC",
  "spells.attack": "attack",
  "spells.concentration": "conc.",
  "spells.school": "School",
  "spells.castingTime": "Casting time",
  "spells.area": "Area",
  "spells.duration": "Duration",
  "spells.components": "Components",
  "spells.concentrationFull": "concentration",
  // consumables
  "consumables.title": "Consumables",
  // resources
  "resources.title": "Resources",
  "resources.reset": "reset",
  "resources.level": "lvl",
  "reset.shortRest": "short rest",
  "reset.longRest": "long rest",
  "reset.dawn": "dawn",
  "reset.manual": "manual",
  "reset.none": "—",
} as const;

export type StringKey = keyof typeof en;

const it: Record<StringKey, string> = {
  "app.export": "Esporta JSON",
  "app.open": "Apri JSON",
  "app.back": "Indietro",
  "app.backTitle": "Torna alla schermata iniziale",
  "app.confirmLeave": "Ci sono modifiche non esportate. Tornare alla home?",
  "app.invalidJson": "File JSON non valido.",
  "empty.title": "Il tuo personaggio, sempre tuo.",
  "empty.body": "Apri il tuo character.json per iniziare subito.",
  "empty.tryExample": "Oppure prova un esempio",
  "status.file": "File",
  "status.unnamed": "(senza nome)",
  "status.live": "Sync live",
  "status.unsaved": "Modifiche non esportate",
  "status.memory": "In memoria",
  "status.saveError": "Errore salvataggio",
  "tab.gioco": "Gioco",
  "tab.scheda": "Attributi",
  "tab.inventario": "Inventario",
  "tab.storia": "Storia",
  "header.level": "Livello",
  "header.proficiency": "Competenza",
  "vitals.title": "Vitali",
  "vitals.ac": "CA",
  "vitals.initiative": "Iniziativa",
  "vitals.speed": "Velocità",
  "vitals.damage": "Danno",
  "vitals.heal": "Cura",
  "vitals.hp": "PF",
  "vitals.temp": "Temp",
  "vitals.hitDice": "Dadi Vita",
  "vitals.shortRest": "Riposo breve",
  "vitals.longRest": "Riposo lungo",
  "ac.manual": "manuale",
  "status.title": "Stato",
  "status.addCondition": "+ condizione",
  "status.conditionPlaceholder": "condizione…",
  "status.inspiration": "Ispirazione",
  "status.deathSaves": "Tiri salvezza contro la morte",
  "status.successes": "Successi",
  "status.failures": "Fallimenti",
  "attacks.title": "Attacchi",
  "attacks.innate": "innato",
  "attacks.notInHand": "non in mano · cambio = 1 azione",
  "attacks.modes": "modi d'attacco",
  "detail.range": "Gittata",
  "detail.yourRoll": "Tiro che fai tu",
  "detail.enemyRoll": "Tiro avversario",
  "detail.damageEffect": "Danno/Effetto",
  "detail.notes": "Note",
  "detail.openWiki": "Apri sul wiki ↗",
  "spells.title": "Incantesimi",
  "spells.dc": "CD",
  "spells.attack": "attacco",
  "spells.concentration": "conc.",
  "spells.school": "Scuola",
  "spells.castingTime": "Tempo di lancio",
  "spells.area": "Area",
  "spells.duration": "Durata",
  "spells.components": "Componenti",
  "spells.concentrationFull": "concentrazione",
  "consumables.title": "Consumabili",
  "resources.title": "Risorse",
  "resources.reset": "reset",
  "resources.level": "liv.",
  "reset.shortRest": "riposo breve",
  "reset.longRest": "riposo lungo",
  "reset.dawn": "alba",
  "reset.manual": "manuale",
  "reset.none": "—",
};

const dict: Record<Locale, Record<StringKey, string>> = { en, it };

const KEY = "dndm.locale";
const initialLocale = ((): Locale => {
  if (typeof localStorage === "undefined") return "en";
  const saved = localStorage.getItem(KEY);
  return saved === "it" || saved === "en" ? saved : "en";
})();

interface I18nState {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useI18n = create<I18nState>((set) => ({
  locale: initialLocale,
  setLocale: (locale) => {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, locale);
    set({ locale });
  },
}));

export type TFn = (key: StringKey) => string;

/** Hook returning the translator bound to the current locale. */
export function useT(): TFn {
  const locale = useI18n((s) => s.locale);
  return (key) => dict[locale][key] ?? en[key] ?? key;
}
