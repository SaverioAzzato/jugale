/**
 * Generic, immutable path-based edits for the character object — the write engine
 * behind Edit mode. Unlike `setByPath` in formula.ts (numbers only, arrays addressed
 * by entry `id`), these handle any value type and address arrays by **index**, so the
 * UI can edit text/booleans/enums and add or remove list entries.
 *
 * A path is an array of keys/indices, e.g. ["combat", "hp", "max"] or
 * ["resources", 2, "label"]. Intermediate nodes are assumed to exist (the schema
 * gives every section a default); a missing object node is created on the way down.
 */

export type Path = (string | number)[];

/** Read the value at a path, or `undefined` if any step is missing. */
export function getIn(obj: unknown, path: Path): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null) return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

/** Immutably set `value` at `path`, cloning only the nodes along the way. */
export function setIn<T>(obj: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [key, ...rest] = path;

  if (Array.isArray(obj)) {
    const idx = Number(key);
    const copy = obj.slice();
    copy[idx] = rest.length === 0 ? value : setIn(copy[idx], rest, value);
    return copy as unknown as T;
  }

  const node = (obj ?? {}) as Record<string | number, unknown>;
  return {
    ...node,
    [key]: rest.length === 0 ? value : setIn(node[key], rest, value),
  } as unknown as T;
}

/** Immutably insert `item` into the array at `path` (defaults to appending). */
export function insertAt<T>(obj: T, path: Path, item: unknown, index?: number): T {
  const arr = (getIn(obj, path) as unknown[]) ?? [];
  const copy = arr.slice();
  copy.splice(index ?? copy.length, 0, item);
  return setIn(obj, path, copy);
}

/** Immutably remove the entry at `index` from the array at `path`. */
export function removeAt<T>(obj: T, path: Path, index: number): T {
  const arr = (getIn(obj, path) as unknown[]) ?? [];
  return setIn(
    obj,
    path,
    arr.filter((_, i) => i !== index),
  );
}
