import { SCHEMA_VERSION, type AbilityId } from "./character";

/**
 * In-memory upgrade of older character files to the current schema.
 * Runs on load; the result is only persisted on a real save.
 * Defensive by design: any unknown/legacy field is preserved rather than lost.
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

const truthy = (v: unknown): boolean => /s[iì]|y|yes|true|conc/i.test(String(v ?? ""));

function migrateV1toV2(v1: Json): Json {
  const out: Json = { schemaVersion: SCHEMA_VERSION };

  // meta
  out.meta = {
    name: v1.meta?.name ?? "Personaggio",
    player: v1.meta?.player ?? "",
    summary: v1.meta?.summary ?? "",
    portrait: v1.meta?.portrait ?? {},
  };

  // identity[] (label/value) → identity object + classes[]
  const idArr: Json[] = Array.isArray(v1.identity) ? v1.identity : [];
  const byLabel = (label: string): string | undefined =>
    idArr.find((i) => String(i?.label ?? "").toLowerCase() === label)?.value;
  out.identity = { race: byLabel("razza") ?? "", background: byLabel("background") ?? "" };
  const className = byLabel("classe");
  out.classes = className ? [{ name: className, level: Number(byLabel("livello")) || 1 }] : [];

  // abilities
  const abilities: Json = {};
  for (const a of v1.build?.abilities ?? []) {
    const id = ABILITY_BY_IT[String(a?.name ?? "").toLowerCase().trim()];
    if (id) abilities[id] = { score: Number(a.score) || 10 };
  }
  for (const st of v1.build?.savingThrows ?? []) {
    const name = String(st?.name ?? "").toLowerCase();
    for (const [it, id] of Object.entries(ABILITY_BY_IT)) {
      if (name.includes(it)) abilities[id] = { ...(abilities[id] ?? {}), saveProficient: true };
    }
  }
  out.abilities = abilities;

  // combat: attacks pass through; hp from session
  const r = v1.session?.resources ?? {};
  out.combat = {
    attacks: Array.isArray(v1.combat?.attacks) ? v1.combat.attacks : [],
    hp: { max: Number(r.maxHp) || 0, current: Number(r.currentHp) || 0, temp: Number(r.tempHp) || 0 },
  };

  // resources: slots dict + arrows → generic resources[]
  const resources: Json[] = [];
  for (const [key, slot] of Object.entries(r.slots ?? {})) {
    const total = Number((slot as Json)?.total) || 0;
    const used = Number((slot as Json)?.used) || 0;
    const lvlMatch = /lvl?(\d)/.exec(key);
    resources.push({
      id: slugify(key),
      label: `Slot ${key}`,
      category: "spellSlot",
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

  // Lossless catch-all: anything that didn't have a clean home is preserved as custom sections.
  const custom: Json[] = [];
  const listSection = (id: string, title: string, items: unknown) =>
    Array.isArray(items) && items.length > 0 ? custom.push({ id, title, layout: "list", items }) : 0;
  listSection("competenze-migrato", "Competenze (migrato)", v1.build?.proficiencies);
  listSection("checklist-migrato", "Checklist livello (migrato)", v1.features?.levelChecklist);
  listSection("note-migrato", "Note (migrato)", v1.reminders?.notes);
  listSection("uso-tavolo-migrato", "Uso al tavolo (migrato)", v1.reminders?.tablePlay);
  if (Array.isArray(v1.build?.skills) && v1.build.skills.length > 0) {
    custom.push({
      id: "abilita-migrato",
      title: "Abilità (migrato)",
      layout: "table",
      columns: ["Abilità", "Bonus"],
      items: v1.build.skills.map((s: Json) => ({ Abilità: s?.name ?? "", Bonus: s?.value ?? "" })),
    });
  }
  out.customSections = custom;

  // session: only ephemeral state survives here now
  out.session = { conditions: [], notes: "" };

  return out;
}
