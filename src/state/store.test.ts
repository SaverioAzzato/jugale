import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCharacter } from "./store";
import { useToast } from "../ui/useToast";
import type { StorageProvider } from "../storage/provider";
import { newResource, newSpellSection, newSpell } from "../model/factories";
import multiclass from "../../characters/example-multiclass/character.json";
import { useSettings } from "../ui/useSettings";
import type { CharacterVersion, VersionStore } from "../storage/versions";

const c = () => useCharacter.getState().character!;
const res = (id: string) => c().resources.find((r) => r.id === id)!;

describe("store — live play mutations", () => {
  beforeEach(() => useCharacter.getState().loadRaw(multiclass, "test"));

  it("damage drains temp HP first, then current, flooring at 0", () => {
    useCharacter.getState().setTempHp(5);
    useCharacter.getState().damage(8); // 5 temp + 3 current (42 → 39)
    expect(c().combat.hp.temp).toBe(0);
    expect(c().combat.hp.current).toBe(39);
    useCharacter.getState().damage(999);
    expect(c().combat.hp.current).toBe(0);
  });

  it("heal caps at max HP", () => {
    useCharacter.getState().damage(20);
    useCharacter.getState().heal(100);
    expect(c().combat.hp.current).toBe(c().combat.hp.max);
  });

  it("adjustResource clamps to [0, max]", () => {
    useCharacter.getState().adjustResource("channel-divinity", -5);
    expect(res("channel-divinity").current).toBe(0);
    useCharacter.getState().adjustResource("channel-divinity", 9);
    expect(res("channel-divinity").current).toBe(res("channel-divinity").max);
  });

  it("short rest restores only shortRest resources", () => {
    useCharacter.getState().adjustResource("channel-divinity", -1); // shortRest → 0
    useCharacter.getState().adjustResource("spell-slots-1", -2); // longRest, 4 → 2
    useCharacter.getState().shortRest();
    expect(res("channel-divinity").current).toBe(1);
    expect(res("spell-slots-1").current).toBe(2);
  });

  it("long rest restores rest-recoverable resources and full HP", () => {
    useCharacter.getState().damage(20);
    useCharacter.getState().adjustResource("spell-slots-1", -3);
    useCharacter.getState().longRest();
    expect(c().combat.hp.current).toBe(c().combat.hp.max);
    expect(res("spell-slots-1").current).toBe(4);
  });

  it("inventory quantity (by index) and currencies never go negative", () => {
    useCharacter.getState().setItemQuantity(0, 7);
    expect(c().inventory.items[0].quantity).toBe(7);
    useCharacter.getState().setCurrency("gp", -10);
    expect(c().inventory.currencies.gp).toBe(0);
  });

  it("allows only one suit of body armor equipped at a time", () => {
    useCharacter.getState().loadRaw(
      {
        meta: { name: "Armored" },
        inventory: {
          items: [
            { id: "chain", name: "Chain mail", equippable: true, equipped: true, ac: { base: 16 } },
            { id: "plate", name: "Plate", equippable: true, equipped: false, ac: { base: 18 } },
            { id: "shield", name: "Shield", equippable: true, equipped: false, ac: { bonus: 2 } },
          ],
        },
      },
      "test",
    );
    // Plate can't be equipped while the chain mail is worn.
    useCharacter.getState().toggleEquipped(1);
    expect(c().inventory.items[1].equipped).toBe(false);
    // A bonus-only shield is not body armor → still equippable.
    useCharacter.getState().toggleEquipped(2);
    expect(c().inventory.items[2].equipped).toBe(true);
    // Unequip the chain mail first, then the plate goes on.
    useCharacter.getState().toggleEquipped(0);
    useCharacter.getState().toggleEquipped(1);
    expect(c().inventory.items[1].equipped).toBe(true);
  });

  it("marks the character dirty after an edit", () => {
    expect(useCharacter.getState().dirty).toBe(false);
    useCharacter.getState().heal(1);
    expect(useCharacter.getState().dirty).toBe(true);
  });

  it("clears death saves when HP is regained from 0", () => {
    useCharacter.getState().damage(999); // drop to 0 (dying)
    useCharacter.getState().setDeathSave("successes", 2);
    useCharacter.getState().setDeathSave("failures", 1);
    expect(c().session.deathSaves).toMatchObject({ successes: 2, failures: 1 });
    useCharacter.getState().heal(5); // back above 0
    expect(c().session.deathSaves).toMatchObject({ successes: 0, failures: 0 });
  });

  it("leaves death saves alone while still at 0 HP", () => {
    useCharacter.getState().damage(999);
    useCharacter.getState().setDeathSave("failures", 2);
    useCharacter.getState().setTempHp(3); // temp HP, current still 0
    expect(c().session.deathSaves.failures).toBe(2);
  });
});

describe("store — live sync failure falls back to read-only", () => {
  beforeEach(() => useCharacter.getState().loadRaw(multiclass, "test"));

  it("drops liveSync, flags readOnly, and toasts when a write fails", async () => {
    const failingProvider: StorageProvider = {
      kind: "file",
      read: async () => multiclass,
      write: async () => {
        throw new Error("boom");
      },
    };
    useCharacter.getState().connect(failingProvider, multiclass, "test-file");
    expect(useCharacter.getState().liveSync).toBe(true);
    expect(useCharacter.getState().readOnly).toBe(false);

    useCharacter.getState().heal(1); // any mutation schedules the debounced save
    await new Promise((r) => setTimeout(r, 300)); // past the 250ms debounce

    expect(useCharacter.getState().liveSync).toBe(false);
    expect(useCharacter.getState().readOnly).toBe(true);
    expect(useCharacter.getState().saveError).toBe("boom");
    expect(useToast.getState().toasts.some((t) => t.kind === "error")).toBe(true);
  });

  it("loadRaw flags readOnly immediately when the host has no live-write fallback", () => {
    useCharacter.getState().loadRaw(multiclass, "test-file", [], true);
    expect(useCharacter.getState().readOnly).toBe(true);
    expect(useCharacter.getState().liveSync).toBe(false);
    expect(useCharacter.getState().saveError).toBe(null); // known up front, not a failure
  });
});

describe("store — edit mode structural edits", () => {
  beforeEach(() => useCharacter.getState().loadRaw(multiclass, "test"));

  it("toggleEditMode flips edit mode and a fresh load resets it", () => {
    expect(useCharacter.getState().editMode).toBe(false);
    useCharacter.getState().toggleEditMode();
    expect(useCharacter.getState().editMode).toBe(true);
    useCharacter.getState().loadRaw(multiclass, "test"); // reopening always starts in play mode
    expect(useCharacter.getState().editMode).toBe(false);
  });

  it("editField sets any nested value and marks the character dirty", () => {
    useCharacter.getState().editField(["meta", "name"], "Renamed Hero");
    expect(useCharacter.getState().character!.meta.name).toBe("Renamed Hero");
    expect(useCharacter.getState().dirty).toBe(true);
  });

  it("editField writes into an array entry by index", () => {
    useCharacter.getState().editField(["classes", 0, "level"], 7);
    expect(useCharacter.getState().character!.classes[0].level).toBe(7);
  });

  it("addItem and removeItem grow and shrink an array", () => {
    const before = useCharacter.getState().character!.resources.length;
    useCharacter.getState().addItem(["resources"], newResource());
    expect(useCharacter.getState().character!.resources.length).toBe(before + 1);
    useCharacter.getState().removeItem(["resources"], before);
    expect(useCharacter.getState().character!.resources.length).toBe(before);
  });

  it("supports deeply-nested array add + edit (spell sections → entries)", () => {
    useCharacter.getState().editField(["spellSections"], []); // start clean
    useCharacter.getState().addItem(["spellSections"], newSpellSection());
    useCharacter.getState().addItem(["spellSections", 0, "entries"], newSpell());
    useCharacter.getState().editField(["spellSections", 0, "entries", 0, "name"], "Eldritch Blast");
    expect(useCharacter.getState().character!.spellSections[0].entries[0].name).toBe("Eldritch Blast");
  });

  it("revalidates issues live after an edit that breaks a rule", async () => {
    // Spend more than the max on the first resource → an overspent warning should surface.
    const id = useCharacter.getState().character!.resources[0].id;
    useCharacter.getState().editField(["resources", 0, "max"], 0);
    useCharacter.getState().editField(["resources", 0, "current"], 5);
    await new Promise((r) => setTimeout(r, 350)); // past the 300ms revalidate debounce
    expect(
      useCharacter.getState().issues.some((iss) => iss.code === "resourceOverspent" && iss.path.includes(id)),
    ).toBe(true);
  });
});

describe("store — setRawJson (raw JSON editor)", () => {
  beforeEach(() => useCharacter.getState().loadRaw(multiclass, "test"));

  it("replaces the character from raw JSON and marks it dirty", () => {
    useCharacter.getState().setRawJson({ ...multiclass, meta: { ...multiclass.meta, name: "Renamed" } });
    expect(c().meta.name).toBe("Renamed");
    expect(useCharacter.getState().dirty).toBe(true);
  });

  it("stays renderable from structurally-broken input (never throws) and reports errors", () => {
    useCharacter.getState().setRawJson({ meta: { name: "Half" }, classes: 5 });
    expect(c()).toBeTruthy();
    expect(c().meta.name).toBe("Half");
    expect(useCharacter.getState().issues.some((iss) => iss.severity === "error")).toBe(true);
  });

  it("preserves live-sync + provider — only the character changes", () => {
    const provider = { write: async () => {} } as unknown as StorageProvider;
    useCharacter.getState().connect(provider, multiclass, "live.json");
    useCharacter.getState().setRawJson({ ...multiclass, meta: { ...multiclass.meta, name: "Z" } });
    expect(useCharacter.getState().liveSync).toBe(true);
    expect(useCharacter.getState().provider).toBe(provider);
    expect(c().meta.name).toBe("Z");
  });
});

const checkpoint: CharacterVersion = {
  id: "character-20260727-153012-184-checkpoint.json",
  filename: "character-20260727-153012-184-checkpoint.json",
  createdAt: "2026-07-27T13:30:12.184Z",
  reason: "checkpoint",
};

function versionedProvider(overrides: Partial<StorageProvider> = {}, versionOverrides: Partial<VersionStore> = {}) {
  const versions = {
    create: vi.fn(async () => checkpoint),
    list: vi.fn(async () => []),
    read: vi.fn(async () => multiclass),
    delete: vi.fn(async () => {}),
    ...versionOverrides,
  } as VersionStore;
  const provider: StorageProvider = {
    kind: "file",
    read: vi.fn(async () => multiclass),
    write: vi.fn(async () => {}),
    versions,
    ...overrides,
  };
  return { provider, versions };
}

describe("store — character versions and safe replacement", () => {
  beforeEach(() => {
    useCharacter.getState().loadRaw(multiclass, "test");
    useSettings.getState().setVersionHistory(false);
    useToast.setState({ toasts: [] });
  });

  it("flushes the latest debounced state before creating a manual checkpoint", async () => {
    const { provider, versions } = versionedProvider();
    useCharacter.getState().connect(provider, multiclass, "folder");
    useCharacter.getState().damage(1);

    const result = await useCharacter.getState().createVersion();

    expect(result).toEqual(checkpoint);
    expect(provider.write).toHaveBeenCalledTimes(1);
    const persisted = vi.mocked(provider.write).mock.calls[0][0] as typeof multiclass;
    expect(persisted.combat.hp.current).toBe(multiclass.combat.hp.current - 1);
    expect(versions.create).toHaveBeenCalledWith(useCharacter.getState().character, "checkpoint", undefined);
    expect(useToast.getState().toasts.at(-1)).toMatchObject({
      kind: "success",
      message: `Version saved: ${checkpoint.filename}`,
    });
  });

  it("does not create history from the toggle, live mutations or ordinary live sync", async () => {
    const { provider, versions } = versionedProvider();
    useCharacter.getState().connect(provider, multiclass, "folder");
    useSettings.getState().setVersionHistory(true);
    useCharacter.getState().damage(1);
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(provider.write).toHaveBeenCalledTimes(1);
    expect(versions.create).not.toHaveBeenCalled();
  });

  it("does not emit a false success and ignores a double tap while creation is active", async () => {
    let finish!: (version: CharacterVersion) => void;
    const pending = new Promise<CharacterVersion>((resolve) => { finish = resolve; });
    const create = vi.fn(() => pending);
    const { provider } = versionedProvider({}, { create });
    useCharacter.getState().connect(provider, multiclass, "folder");

    const first = useCharacter.getState().createVersion();
    const second = await useCharacter.getState().createVersion();
    expect(second).toBeNull();
    await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(useToast.getState().toasts).toHaveLength(0);

    finish(checkpoint);
    await expect(first).resolves.toEqual(checkpoint);
    expect(useToast.getState().toasts).toHaveLength(1);
  });

  it("does not snapshot an unpersisted state when flushing the canonical file fails", async () => {
    const write = vi.fn(async () => { throw new Error("canonical denied"); });
    const { provider, versions } = versionedProvider({ write });
    useCharacter.getState().connect(provider, multiclass, "folder");
    useCharacter.getState().damage(1);

    await expect(useCharacter.getState().createVersion()).resolves.toBeNull();
    expect(versions.create).not.toHaveBeenCalled();
    expect(useCharacter.getState()).toMatchObject({ liveSync: false, readOnly: true, dirty: true });
  });

  it("aborts replacement without writing when the safety snapshot fails", async () => {
    useSettings.getState().setVersionHistory(true);
    const create = vi.fn(async () => { throw new Error("history denied"); });
    const { provider } = versionedProvider({}, { create });
    useCharacter.getState().connect(provider, multiclass, "folder");

    const replaced = await useCharacter.getState().replaceCharacter(
      { ...multiclass, meta: { ...multiclass.meta, name: "Incoming" } },
      "before-import",
    );

    expect(replaced).toBe(false);
    expect(provider.write).not.toHaveBeenCalled();
    expect(c().meta.name).toBe(multiclass.meta.name);
    expect(useToast.getState().toasts.at(-1)).toMatchObject({ kind: "error", detail: "history denied" });
  });

  it("replaces without an automatic snapshot when version history is off", async () => {
    const { provider, versions } = versionedProvider();
    useCharacter.getState().connect(provider, multiclass, "folder");

    const replaced = await useCharacter.getState().replaceCharacter(
      { ...multiclass, meta: { ...multiclass.meta, name: "Incoming" } },
      "before-import",
    );

    expect(replaced).toBe(true);
    expect(versions.create).not.toHaveBeenCalled();
    expect(provider.write).toHaveBeenCalledTimes(1);
  });

  it("snapshots, writes and reloads a replacement while preserving provider and images", async () => {
    useSettings.getState().setVersionHistory(true);
    const beforeImport = { ...checkpoint, reason: "before-import" as const };
    const { provider, versions } = versionedProvider({}, { create: vi.fn(async () => beforeImport) });
    const images = [{ name: "images/01.png", url: "data:image/png;base64,AA==" }];
    useCharacter.getState().connect(provider, multiclass, "folder", images);
    const incoming = { ...multiclass, meta: { ...multiclass.meta, name: "Incoming" } };

    await expect(useCharacter.getState().replaceCharacter(incoming, "before-import")).resolves.toBe(true);

    expect(versions.create).toHaveBeenCalledWith(
      expect.objectContaining({ meta: expect.objectContaining({ name: multiclass.meta.name }) }),
      "before-import",
    );
    expect(provider.write).toHaveBeenCalledWith(
      expect.objectContaining({ meta: expect.objectContaining({ name: incoming.meta.name }) }),
    );
    expect(c().meta.name).toBe("Incoming");
    expect(useCharacter.getState()).toMatchObject({ provider, images, dirty: false, liveSync: true });
  });

  it("keeps the old in-memory character and switches to read-only if replacement write fails", async () => {
    useSettings.getState().setVersionHistory(true);
    const write = vi.fn(async () => { throw new Error("disk full"); });
    const { provider } = versionedProvider({ write });
    useCharacter.getState().connect(provider, multiclass, "folder");

    const replaced = await useCharacter.getState().replaceCharacter(
      { ...multiclass, meta: { ...multiclass.meta, name: "Incoming" } },
      "before-import",
    );

    expect(replaced).toBe(false);
    expect(c().meta.name).toBe(multiclass.meta.name);
    expect(useCharacter.getState()).toMatchObject({ readOnly: true, liveSync: false, saveError: "disk full" });
  });
});
