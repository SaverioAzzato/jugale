import { SCHEMA_VERSION, type AbilityId } from "./character";

/**
 * In-memory upgrade of older character files to the current schema.
 * Runs on load; the result is only persisted on a real save.
 * Defensive by design: high-confidence fields are mapped to typed v2 fields;
 * everything else (unknown top-level keys, freeform v1 lists) is preserved
 * verbatim — either by passthrough or as `customSections` — so nothing is lost.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Heuristics for a version-less file: only the legacy v1 shape triggers migration. */
function looksLikeV1(data: Json): boolean {
  return Array.isArray(data?.identity) || data?.build != null || data?.session?.resources?.slots != null;
}

export function schemaMajor(data: Json): number {
  const raw = data?.schemaVersion;
  if (raw == null || raw === "") return looksLikeV1(data) ? 1 : 2;
  return Number(String(raw).split(".")[0]) || 0;
}

export function needsMigration(data: Json): boolean {
  return schemaMajor(data) < Number(SCHEMA_VERSION.split(".")[0]);
}

export function migrateToCurrent(data: Json): Json {
  if (data == null || typeof data !== "object") return data;
  let out = data;
  if (schemaMajor(out) < 2) out = migrateV1toV2(out);
  return out;
}

const slugify = (s: unknown): string =>
  String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "x";

const ABILITY_BY_IT: Record<string, AbilityId> = {
  forza: "str",
  destrezza: "dex",
  costituzione: "con",
  intelligenza: "int",
  saggezza: "wis",
  carisma: "cha",
};

/** Italian abbreviations / prefixes used for saving throws (e.g. "For", "Des", "Sag", "Car"). */
const ABILITY_BY_ABBR: Record<string, AbilityId> = {
  for: "str",
  des: "dex",
  cos: "con",
  int: "int",
  sag: "wis",
  car: "cha",
};

const SKILL_BY_IT: Record<string, string> = {
  acrobazia: "acrobatics",
  "addestrare animali": "animal-handling",
  arcano: "arcana",
  atletica: "athletics",
  inganno: "deception",
  storia: "history",
  intuizione: "insight",
  intimidire: "intimidation",
  indagare: "investigation",
  medicina: "medicine",
  natura: "nature",
  percezione: "perception",
  intrattenere: "performance",
  persuasione: "persuasion",
  religione: "religion",
  "rapidità di mano": "sleight-of-hand",
  furtività: "stealth",
  sopravvivenza: "survival",
};

const truthy = (v: unknown): boolean => /s[iì]|y|yes|true|conc/i.test(String(v ?? ""));
const isCompetent = (v: unknown): boolean => /compet/i.test(String(v ?? ""));
const firstInt = (v: unknown): number | null => {
  const m = /-?\d+/.exec(String(v ?? ""));
  return m ? Number(m[0]) : null;
};

const CONSUMED_KEYS = new Set([
  "schemaVersion",
  "meta",
  "identity",
  "build",
  "combat",
  "spellSections",
  "reminders",
  "features",
  "inventory",
  "origin",
  "narrative",
  "session",
]);

function migrateV1toV2(v1: Json): Json {
  const out: Json = { schemaVersion: SCHEMA_VERSION };
  const custom: Json[] = [];

  // Unknown top-level keys (platform, assets, corrections, …) survive verbatim.
  for (const [key, value] of Object.entries(v1)) {
    if (!CONSUMED_KEYS.has(key)) out[key] = value;
  }

  // meta — spread to keep portrait/player/summary and any extras.
  out.meta = { ...(v1.meta ?? {}), name: v1.meta?.name ?? "Personaggio" };

  // identity[] (freeform label/value) → best-effort typed fields + lossless copy.
  const idArr: Json[] = Array.isArray(v1.identity) ? v1.identity : [];
  const find = (re: RegExp) => idArr.find((i) => re.test(String(i?.label ?? "")));
  const valueOf = (entry: Json): string =>
    entry?.value ?? (Array.isArray(entry?.parts) ? entry.parts.map((p: Json) => p?.value).filter(Boolean).join(" / ") : "");

  const classEntry = find(/class/i);
  const classText = valueOf(classEntry);
  const classMatch = /^(.*?)[\s,]+(\d+)\s*$/.exec(classText);
  // Level may be embedded in the class text ("Warlock 4") or a separate entry ("Livello": "5").
  const level = (classMatch ? Number(classMatch[2]) : null) ?? firstInt(valueOf(find(/^livello$|^level$/i))) ?? 1;
  out.classes = classText
    ? [
        {
          name: classMatch ? classMatch[1].trim() : classText,
          level,
          subclass: valueOf(find(/patrono|sottoclasse|subclass/i)),
          link: classEntry?.link ?? null,
        },
      ]
    : [];

  const raceEntry = find(/razza|race|lignaggio|lineage/i);
  out.identity = {
    race: valueOf(raceEntry),
    background: valueOf(find(/background/i)),
    alignment: valueOf(find(/allineament|alignment/i)),
    link: raceEntry?.link ?? null,
  };
  if (idArr.length > 0) {
    custom.push({ id: "identita-migrato", title: "Identità (migrato)", layout: "list", items: idArr });
  }

  // abilities + saving-throw proficiency
  const abilities: Json = {};
  for (const a of v1.build?.abilities ?? []) {
    const id = ABILITY_BY_IT[String(a?.name ?? "").toLowerCase().trim()];
    if (id) abilities[id] = { score: Number(a.score) || 10 };
  }
  for (const st of v1.build?.savingThrows ?? []) {
    const key = String(st?.name ?? "").toLowerCase().trim().slice(0, 3);
    const id = ABILITY_BY_ABBR[key] ?? ABILITY_BY_IT[String(st?.name ?? "").toLowerCase().trim()];
    if (id && isCompetent(st?.note)) abilities[id] = { ...(abilities[id] ?? { score: 10 }), saveProficient: true };
  }
  out.abilities = abilities;

  // skills → proficiencies.skills (proficient where flagged "competente")
  const skills: Json[] = [];
  for (const s of v1.build?.skills ?? []) {
    const id = SKILL_BY_IT[String(s?.name ?? "").toLowerCase().trim()];
    if (id && isCompetent(s?.note)) skills.push({ id, proficient: true });
  }
  out.proficiencies = { skills };
  if (Array.isArray(v1.build?.proficiencies) && v1.build.proficiencies.length > 0) {
    custom.push({ id: "competenze-migrato", title: "Competenze (migrato)", layout: "list", items: v1.build.proficiencies });
  }

  // combat: AC/speed from baseStats (where unambiguous), HP from session, attacks verbatim
  const baseStats: Json[] = v1.build?.baseStats ?? [];
  const stat = (re: RegExp) => baseStats.find((s) => re.test(String(s?.label ?? "")));
  const r = v1.session?.resources ?? {};
  out.combat = {
    armorClass: firstInt(stat(/^ca\b|classe armatura|armor class/i)?.value) ?? 10,
    speed: { walk: firstInt(stat(/velocit|speed/i)?.value) ?? 30 },
    hp: { max: Number(r.maxHp) || 0, current: Number(r.currentHp) || 0, temp: Number(r.tempHp) || 0 },
    attacks: Array.isArray(v1.combat?.attacks) ? v1.combat.attacks : [],
  };
  if (baseStats.length > 0) {
    custom.push({
      id: "numeri-base-migrato",
      title: "Numeri base (migrato)",
      layout: "table",
      columns: ["Voce", "Valore", "Nota"],
      items: baseStats.map((s) => ({ Voce: s?.label ?? "", Valore: s?.value ?? "", Nota: s?.note ?? "" })),
    });
  }
  if (Array.isArray(v1.combat?.levelNotes) && v1.combat.levelNotes.length > 0) {
    custom.push({ id: "note-livello-migrato", title: "Note di livello (migrato)", layout: "list", items: v1.combat.levelNotes });
  }

  // resources: slots dict + arrows → generic resources[]
  const resources: Json[] = [];
  for (const [key, slot] of Object.entries(r.slots ?? {})) {
    const total = Number((slot as Json)?.total) || 0;
    const used = Number((slot as Json)?.used) || 0;
    const lvlMatch = /lvl?(\d)/.exec(key);
    const isSlot = key === "pact" || lvlMatch != null;
    resources.push({
      id: slugify(key),
      label: key === "pact" ? "Slot del Patto" : `Slot ${key}`,
      category: isSlot ? "spellSlot" : "charges",
      max: total,
      current: Math.max(0, total - used),
      level: lvlMatch ? Number(lvlMatch[1]) : null,
      resetOn: key === "pact" ? "shortRest" : "longRest",
    });
  }
  const arrows = Number(r.arrows) || 0;
  const arrowsTotal = Number(r.arrowsTotal) || arrows;
  if (arrows || arrowsTotal) {
    resources.push({ id: "arrows", label: "Frecce", category: "ammo", max: arrowsTotal, current: arrows, resetOn: "none" });
  }
  out.resources = resources;

  // spellcasting summary + spell sections
  out.spellcasting = { summary: typeof v1.combat?.spellcasting?.slots === "string" ? v1.combat.spellcasting.slots : "" };
  out.spellSections = (v1.spellSections ?? []).map((s: Json) => ({
    id: slugify(s?.title),
    title: s?.title ?? "",
    entries: (s?.entries ?? []).map((e: Json) => ({
      name: e?.name ?? "",
      link: e?.link ?? null,
      level: String(e?.level ?? ""),
      range: e?.range ?? "",
      attack: e?.attack ?? "",
      defense: e?.defense ?? "",
      effect: e?.effect ?? "",
      concentration: truthy(e?.concentration),
      notes: e?.notes ?? "",
    })),
  }));

  // features
  out.features = (v1.features?.items ?? []).map((f: Json) => ({
    id: slugify(f?.label ?? f?.name),
    name: f?.label ?? f?.name ?? "",
    description: f?.text ?? "",
    link: f?.link ?? null,
    source: "class",
  }));

  // inventory
  const cur = v1.inventory?.currencies ?? {};
  out.inventory = {
    items: Array.isArray(v1.inventory?.items) ? v1.inventory.items : [],
    currencies: { pp: 0, gp: Number(cur.gold) || 0, ep: 0, sp: Number(cur.silver) || 0, cp: Number(cur.copper) || 0 },
    notes: v1.inventory?.notes ?? [],
  };

  // origin
  out.origin = {
    languages: v1.origin?.languages ?? [],
    raceTraits: (v1.origin?.raceNotes ?? []).map((s: string) => ({ name: "", description: s })),
    backgroundFeature:
      (v1.origin?.backgroundFeature ?? []).length > 0
        ? { name: "", description: (v1.origin.backgroundFeature as string[]).join(" ") }
        : null,
  };

  // narrative
  out.narrative = {
    personality: v1.narrative?.roleplay ?? [],
    appearance: v1.narrative?.appearance ?? [],
    backstory: v1.narrative?.story ?? [],
    notes: v1.narrative?.unfilled ?? [],
  };

  // reminders + level checklist → custom sections (lossless)
  const list = (id: string, title: string, items: unknown) => {
    if (Array.isArray(items) && items.length > 0) custom.push({ id, title, layout: "list", items });
  };
  list("checklist-migrato", "Checklist livello (migrato)", v1.features?.levelChecklist);
  list("note-migrato", "Note (migrato)", v1.reminders?.notes);
  list("uso-tavolo-migrato", "Uso al tavolo (migrato)", v1.reminders?.tablePlay);
  out.customSections = custom;

  // session: keep only ephemeral state; preserve any extra session keys verbatim
  const { resources: _consumed, ...sessionExtras } = v1.session ?? {};
  void _consumed;
  out.session = { conditions: [], notes: v1.session?.inventoryNotes ?? "", ...sessionExtras };

  return out;
}
