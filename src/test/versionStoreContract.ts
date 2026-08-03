import { expect } from "vitest";
import type { VersionStore } from "../storage/versions";

/** Identical behavioral contract reused by every host adapter suite. */
export async function expectVersionStoreContract(store: VersionStore, millisecond: number): Promise<void> {
  const document = { meta: { name: `Contract ${millisecond}` }, extension: { kept: true } };
  const created = await store.create(
    document,
    "checkpoint",
    " Contract title ",
    new Date(2030, 0, 2, 3, 4, 5, millisecond),
  );
  expect(created.title).toBe("Contract title");
  expect((await store.list()).some((version) => version.filename === created.filename)).toBe(true);
  expect(await store.read(created)).toEqual(document);
  await store.delete(created);
  expect((await store.list()).some((version) => version.filename === created.filename)).toBe(false);
}
