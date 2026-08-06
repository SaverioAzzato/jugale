import { expect, test, type Page } from "@playwright/test";

const CHARACTER = {
  schemaVersion: "2.2.0",
  meta: { name: "E2E Hero", ruleset: ["SRD 5.1"] },
  combat: { hp: { max: 10, current: 10, temp: 0, hitDiceRemaining: 1 }, speed: { walk: 30 } },
  resources: [{ id: "focus", label: "Focus", category: "points", max: 3, current: 3, resetOn: "longRest" }],
  unknownRoot: { retained: true },
};

async function installFakeFileSystem(page: Page) {
  await page.addInitScript((initial) => {
    if (localStorage.getItem("e2e.character") === null) {
      localStorage.setItem("e2e.character", JSON.stringify(initial));
      localStorage.setItem("e2e.writes", "0");
      localStorage.removeItem("e2e.failWrites");
      localStorage.removeItem("e2e.export");
      localStorage.removeItem("e2e.newCharacter");
      localStorage.removeItem("e2e.importTarget");
      localStorage.removeItem("e2e.history");
    }

    const history = () => JSON.parse(localStorage.getItem("e2e.history") || "{}") as Record<string, string>;
    const saveHistory = (files: Record<string, string>) => localStorage.setItem("e2e.history", JSON.stringify(files));
    const writable = (commit: (text: string) => void) => ({
      write: async (value: string) => commit(String(value)),
      close: async () => {},
    });
    const characterHandle = {
      kind: "file",
      name: "character.json",
      getFile: async () => new File([localStorage.getItem("e2e.character") || "{}"], "character.json", { type: "application/json" }),
      createWritable: async () => {
        if (localStorage.getItem("e2e.failWrites") === "true") throw new Error("simulated write failure");
        return writable((text) => {
          localStorage.setItem("e2e.character", text);
          localStorage.setItem("e2e.writes", String(Number(localStorage.getItem("e2e.writes") || "0") + 1));
        });
      },
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
    };
    const historyHandle = {
      kind: "directory",
      name: "history",
      getFileHandle: async (name: string, options?: { create?: boolean }) => {
        const files = history();
        if (!(name in files) && !options?.create) throw new Error("missing");
        if (!(name in files)) { files[name] = ""; saveHistory(files); }
        return {
          kind: "file",
          name,
          getFile: async () => new File([history()[name] || ""], name, { type: "application/json" }),
          createWritable: async () => writable((text) => { const next = history(); next[name] = text; saveHistory(next); }),
        };
      },
      getDirectoryHandle: async () => { throw new Error("missing"); },
      entries: async function* () {
        for (const name of Object.keys(history())) yield [name, { kind: "file", name }];
      },
      removeEntry: async (name: string) => { const files = history(); delete files[name]; saveHistory(files); },
    };
    const rootHandle = {
      kind: "directory",
      name: "e2e-hero",
      getFileHandle: async (name: string) => {
        if (name !== "character.json") throw new Error("missing");
        return characterHandle;
      },
      getDirectoryHandle: async (name: string, options?: { create?: boolean }) => {
        if (name === "history" && (options?.create || Object.keys(history()).length > 0)) return historyHandle;
        throw new Error("missing");
      },
      entries: async function* () { yield ["character.json", characterHandle]; },
      removeEntry: async () => {},
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
    };
    const importedCharacterHandle = {
      kind: "file",
      name: "character.json",
      getFile: async () => new File([localStorage.getItem("e2e.newCharacter") || "{}"], "character.json", { type: "application/json" }),
      createWritable: async () => writable((text) => localStorage.setItem("e2e.newCharacter", text)),
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
    };
    const emptyRootHandle = {
      kind: "directory",
      name: "imported-hero",
      getFileHandle: async (name: string, options?: { create?: boolean }) => {
        if (name !== "character.json" || (!options?.create && localStorage.getItem("e2e.newCharacter") === null)) throw new Error("missing");
        return importedCharacterHandle;
      },
      getDirectoryHandle: rootHandle.getDirectoryHandle,
      entries: async function* () {
        if (localStorage.getItem("e2e.newCharacter") !== null) yield ["character.json", importedCharacterHandle];
      },
      removeEntry: async () => localStorage.removeItem("e2e.newCharacter"),
      queryPermission: async () => "granted",
      requestPermission: async () => "granted",
    };
    const exportHandle = {
      kind: "file",
      name: "e2e-export.json",
      getFile: async () => new File([localStorage.getItem("e2e.export") || "{}"], "e2e-export.json", { type: "application/json" }),
      createWritable: async () => writable((text) => localStorage.setItem("e2e.export", text)),
    };
    Object.assign(window, {
      showOpenFilePicker: async () => [characterHandle],
      showDirectoryPicker: async () => localStorage.getItem("e2e.importTarget") === "empty" ? emptyRootHandle : rootHandle,
      showSaveFilePicker: async () => exportHandle,
    });
  }, CHARACTER);
}

async function openFile(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open JSON" }).click();
  await expect(page.getByText("E2E Hero", { exact: true })).toBeVisible();
}

async function openFolder(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open folder" }).click();
  await expect(page.getByText("E2E Hero", { exact: true })).toBeVisible();
}

async function toolbarAction(page: Page, name: string) {
  const direct = page.getByRole("button", { name, exact: true });
  if (await direct.isVisible().catch(() => false)) return direct;
  await page.getByRole("button", { name: "More actions" }).click();
  return page.getByRole("menuitem", { name, exact: true });
}

test.beforeEach(async ({ page }) => installFakeFileSystem(page));

test("opens, edits HP and a resource, persists, and reloads", async ({ page }) => {
  await openFile(page);
  await page.getByRole("button", { name: "Damage" }).click();
  await page.getByRole("group", { name: "Focus" }).getByRole("button", { name: "Decrease" }).click();
  await expect(page.locator(".hp-current")).toHaveText("9");
  await expect(page.getByText("2/3", { exact: false })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Number(localStorage.getItem("e2e.writes")))).toBeGreaterThan(0);

  await page.reload();
  await page.getByRole("button", { name: "Open JSON" }).click();
  await expect(page.locator(".hp-current")).toHaveText("9");
  await expect(page.getByText("2/3", { exact: false })).toBeVisible();
});

test("downloads one prompt bundle with schema and the open character", async ({ page }) => {
  await openFile(page);
  await page.getByRole("button", { name: "GPT prompts" }).click();
  await expect(page.locator(".prompts-page")).toBeVisible();

  await page.getByRole("button", { name: "Download bundle" }).nth(2).click();

  await expect.poll(() => page.evaluate(() => localStorage.getItem("e2e.export"))).not.toBeNull();
  const bundle = await page.evaluate(() => localStorage.getItem("e2e.export") || "");
  expect(bundle).toContain("===== PROMPT =====");
  expect(bundle).toContain("===== character.schema.json =====");
  expect(bundle).toContain("===== character.json =====");
  expect(bundle).toContain('"name": "E2E Hero"');
});

test("previews and creates an imported character in an empty folder", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("e2e.importTarget", "empty"));
  await (await toolbarAction(page, "Import character JSON")).click();
  const dialog = page.getByRole("dialog", { name: "Import character" });
  await expect(dialog).toContainText("E2E Hero");
  await dialog.getByRole("button", { name: "Choose character folder" }).click();
  await dialog.getByRole("button", { name: "Create in imported-hero" }).click();

  await expect(page.getByText("E2E Hero", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("e2e.newCharacter") || "{}").meta?.name)).toBe("E2E Hero");
  await expect(await toolbarAction(page, "Save version")).toBeVisible();
});

test("previews an import, snapshots the open character and applies the update", async ({ page }) => {
  await openFolder(page);
  await page.evaluate((updated) => localStorage.setItem("e2e.character", JSON.stringify(updated)), {
    ...CHARACTER,
    meta: { ...CHARACTER.meta, name: "Imported Hero" },
  });

  await (await toolbarAction(page, "Import character JSON")).click();
  const dialog = page.getByRole("dialog", { name: "Import character" });
  await expect(dialog).toContainText("Imported Hero");
  await expect(dialog).toContainText("saved to Versions");
  await dialog.getByRole("button", { name: "Apply to E2E Hero" }).click();

  await expect(page.getByText("Imported Hero", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const files = JSON.parse(localStorage.getItem("e2e.history") || "{}") as Record<string, string>;
    const snapshots = Object.entries(files).filter(([name]) => name.endsWith("before-import.json"));
    return snapshots.some(([, raw]) => JSON.parse(raw).meta?.name === "E2E Hero");
  })).toBe(true);
});

test("keeps schema-invalid raw JSON out of storage, then saves the correction", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "The critical mobile edit path is covered separately.");
  await openFile(page);
  await page.getByRole("button", { name: "Raw JSON editor" }).click();
  const editor = page.locator(".cm-content");
  await expect(editor).toBeVisible();
  const invalid = { ...CHARACTER, combat: { ...CHARACTER.combat, hp: { ...CHARACTER.combat.hp, current: "invalid" } } };
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(JSON.stringify(invalid, null, 2));
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => Number(localStorage.getItem("e2e.writes")))).toBe(0);

  const corrected = { ...CHARACTER, meta: { ...CHARACTER.meta, name: "Corrected Hero" } };
  await editor.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(JSON.stringify(corrected, null, 2));
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Back" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("e2e.character") || "{}").meta?.name)).toBe("Corrected Hero");
});

test("switches to read-only after a write failure and exports the recovery copy", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Desktop exercises the recovery picker; mobile uses its native export adapter.");
  await openFile(page);
  await page.evaluate(() => localStorage.setItem("e2e.failWrites", "true"));
  await page.getByRole("button", { name: "Damage" }).click();
  await expect(page.getByText("Read-only", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Export to save" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("e2e.export") || "{}").combat?.hp?.current)).toBe(9);
});

test("creates and restores a folder version", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chromium", "Version mechanics are host-independent; desktop keeps this flow concise.");
  await openFolder(page);
  await page.getByRole("button", { name: "Damage" }).click();
  await expect.poll(() => page.evaluate(() => Number(localStorage.getItem("e2e.writes")))).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Save version" }).click();
  const saveDialog = page.getByRole("dialog", { name: "Save version" });
  await saveDialog.getByRole("textbox").fill("Before second hit");
  await saveDialog.getByRole("button", { name: "Save version" }).click();
  await expect.poll(() => page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("e2e.history") || "{}")).length)).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Damage" }).click();
  await expect(page.locator(".hp-current")).toHaveText("8");
  await page.getByRole("button", { name: "View versions" }).click();
  await expect(page.getByText("Before second hit", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Restore this version" }).click();
  await page.getByRole("dialog", { name: "Restore this version" }).getByRole("button", { name: "No" }).click();
  await expect(page.locator(".hp-current")).toHaveText("9");
});
