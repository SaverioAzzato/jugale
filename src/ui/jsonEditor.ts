/**
 * The CodeMirror 6 JSON editor for the raw-JSON view. Kept in its own module and loaded lazily
 * (dynamic import from RawJsonPage) so none of CodeMirror lands in the main bundle.
 *
 * Two diagnostic layers, both surfaced as inline squiggles AND reported to the page for the
 * mobile-friendly "Problems" panel:
 *  - **syntax** — `jsonParseLinter()` from @codemirror/lang-json (precise Lezer positions);
 *  - **schema / 5e rules** — our own `loadCharacter()` issues (the real Zod contract + rule checks),
 *    each carrying a dot `path` that we resolve to a text range through the JSON syntax tree.
 *
 * Theming is entirely via CSS variables (see themes.css), so it follows the app's theme switch.
 */
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  gutter,
  GutterMarker,
  type BlockInfo,
} from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { history, historyKeymap, defaultKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  foldAll,
  unfoldAll,
  foldedRanges,
  indentOnInput,
  syntaxHighlighting,
  syntaxTree,
  HighlightStyle,
} from "@codemirror/language";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintKeymap, forEachDiagnostic, type Diagnostic } from "@codemirror/lint";
import { search, searchKeymap, openSearchPanel } from "@codemirror/search";
import {
  autocompletion,
  startCompletion,
  acceptCompletion,
  nextSnippetField,
  prevSnippetField,
  snippet,
  type CompletionContext,
  type CompletionResult,
  type Completion,
} from "@codemirror/autocomplete";
import { tags as t } from "@lezer/highlight";
import type { SyntaxNode } from "@lezer/common";
import { loadCharacter } from "../schema";
import { uid } from "../model/factories";
import {
  CHARACTER_MODEL,
  scaffoldSnippet,
  containerSkeletonSnippet,
  keyEntrySnippet,
  elementEntrySnippet,
  valueOptionsAt,
  objectKeys,
  fieldNode,
  childForSegment,
  hasIdField,
  type SchemaNode,
} from "./schemaModel";

/** A diagnostic in the form the Problems panel needs (line number precomputed for display). */
export interface PanelDiagnostic {
  from: number;
  to: number;
  line: number;
  severity: "error" | "warning";
  message: string;
}

export interface JsonEditorHandle {
  destroy: () => void;
  /** Select + scroll a range into view (the Problems panel's tap-to-jump), then focus. */
  reveal: (from: number, to: number) => void;
  /** Open schema-aware suggestions at the cursor (the Suggest button; the universal mobile trigger). */
  triggerCompletion: () => void;
  /** Collapse every foldable section (the Collapse-all button). */
  foldAll: () => void;
  /** Expand every folded section (the Expand-all button). */
  unfoldAll: () => void;
  /** Open the find / find-and-replace panel (Ctrl/Cmd-F, and the Search button for mobile). */
  openSearch: () => void;
}

export interface JsonEditorOptions {
  doc: string;
  /** Fires on every document edit with the full text (the page debounces + commits valid JSON). */
  onDocChange: (text: string) => void;
  /** Fires whenever the diagnostics set changes (drives the Problems panel). */
  onDiagnostics: (diagnostics: PanelDiagnostic[]) => void;
}

/** JSON token colors, all pulled from theme tokens so the editor re-themes with the app. */
const highlightStyle = HighlightStyle.define([
  { tag: t.propertyName, color: "var(--json-key)" },
  { tag: [t.string, t.special(t.string)], color: "var(--json-string)" },
  { tag: t.number, color: "var(--json-number)" },
  { tag: [t.bool, t.null, t.keyword], color: "var(--json-keyword)" },
  { tag: [t.punctuation, t.separator, t.brace, t.squareBracket], color: "var(--json-punct)" },
]);

const editorTheme = EditorView.theme({
  "&": { height: "100%", color: "var(--text)", backgroundColor: "transparent", fontSize: "13px" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)", lineHeight: "1.5" },
  ".cm-content": { caretColor: "var(--accent)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--accent-weak)",
  },
  ".cm-gutters": { backgroundColor: "var(--surface-2)", color: "var(--muted)", border: "none" },
  ".cm-activeLine": { backgroundColor: "var(--surface-2)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--surface-2)", color: "var(--text)" },
  ".cm-foldPlaceholder": { backgroundColor: "var(--accent-weak)", color: "var(--muted)", border: "none", padding: "0 4px" },
  ".cm-lint-marker": { width: "0.9em", height: "0.9em" },
  ".cm-tooltip": {
    backgroundColor: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
  },
  // Schema-aware autocomplete popup: themed, and roomy enough to tap on mobile. Put in the editor
  // theme (not index.css) so it reliably wins over CodeMirror's injected base theme.
  ".cm-tooltip.cm-tooltip-autocomplete": { border: "1px solid var(--border-strong)", boxShadow: "var(--shadow)" },
  ".cm-tooltip-autocomplete > ul": {
    maxHeight: "15em",
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "14px",
    padding: "9px 12px",
    lineHeight: "1.35",
    color: "var(--text)",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--accent-weak)", color: "var(--text)" },
  ".cm-completionDetail": { color: "var(--muted)", fontStyle: "normal", fontSize: "0.82em" },
  // Find / find-and-replace panel: themed to match the app and roomy enough to tap on mobile.
  ".cm-panels": { backgroundColor: "var(--surface-2)", color: "var(--text)", borderBottom: "1px solid var(--border)" },
  ".cm-panel.cm-search": { padding: "8px 10px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" },
  ".cm-panel.cm-search label": { fontSize: "12px", color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: "3px" },
  ".cm-textfield": {
    backgroundColor: "var(--surface)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "5px 8px",
    fontSize: "13px",
  },
  ".cm-button": {
    backgroundColor: "var(--surface)",
    backgroundImage: "none",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    padding: "5px 10px",
    fontSize: "12px",
    cursor: "pointer",
  },
  ".cm-button:hover": { borderColor: "var(--accent)" },
  ".cm-panel.cm-search [name=close]": {
    color: "var(--muted)",
    fontSize: "18px",
    cursor: "pointer",
    outlineOffset: "2px",
  },
});

/** A minimal structural view of a Lezer syntax node — avoids a direct @lezer/common import. */
interface SNode {
  name: string;
  from: number;
  to: number;
  firstChild: SNode | null;
  lastChild: SNode | null;
  nextSibling: SNode | null;
}

const VALUE_TYPES = new Set(["Object", "Array", "String", "Number", "True", "False", "Null"]);

function unquote(raw: string): string {
  try {
    return JSON.parse(raw) as string;
  } catch {
    return raw.replace(/^"|"$/g, "");
  }
}

/** The value node of a `Property` (its last child; the PropertyName is the first). */
function propertyValue(prop: SNode): SNode | null {
  const value = prop.lastChild;
  return value && value !== prop.firstChild ? value : null;
}

/** Direct value children of an Array/Object container (skips punctuation/error nodes). */
function valueChildren(node: SNode): SNode[] {
  const out: SNode[] = [];
  for (let c = node.firstChild; c; c = c.nextSibling) if (VALUE_TYPES.has(c.name)) out.push(c);
  return out;
}

/** Descend one path segment from a value node. Handles object keys, array indices, and
 *  `resources.<id>`-style lookups (a non-numeric segment into an array of objects with an `id`). */
function descend(node: SNode, seg: string, doc: string): SNode | null {
  if (node.name === "Object") {
    for (let p = node.firstChild; p; p = p.nextSibling) {
      if (p.name !== "Property" || !p.firstChild) continue;
      if (unquote(doc.slice(p.firstChild.from, p.firstChild.to)) === seg) return propertyValue(p);
    }
    return null;
  }
  if (node.name === "Array") {
    const items = valueChildren(node);
    const idx = Number(seg);
    if (Number.isInteger(idx) && idx >= 0 && idx < items.length) return items[idx];
    for (const it of items) {
      if (it.name !== "Object") continue;
      for (let p = it.firstChild; p; p = p.nextSibling) {
        if (p.name !== "Property" || !p.firstChild) continue;
        if (unquote(doc.slice(p.firstChild.from, p.firstChild.to)) !== "id") continue;
        const v = propertyValue(p);
        if (v && unquote(doc.slice(v.from, v.to)) === seg) return it;
      }
    }
    return null;
  }
  return null;
}

/** Resolve a dot-path (as produced by `loadCharacter().issues[].path`) to a text range. Best
 *  effort: on an unresolvable segment, returns the range of the deepest node reached, so the
 *  squiggle lands on the right section even when the exact leaf can't be found. */
function resolvePathRange(root: SNode, path: string, doc: string): { from: number; to: number } | null {
  let node: SNode | null = root;
  if (!node) return null;
  let last = node;
  if (path) {
    for (const seg of path.split(".")) {
      const next = descend(node, seg, doc);
      if (!next) return { from: last.from, to: last.to };
      node = next;
      last = next;
    }
  }
  return { from: node.from, to: node.to };
}

/** Schema + 5e-rule diagnostics for a JSON string, from our own load pipeline. Pure (builds a
 *  throwaway parse state), so it's unit-testable without an editor view. Returns [] on unparseable
 *  JSON — the syntax linter reports that. Each issue's dot `path` is resolved to a text range. */
export function schemaDiagnosticsForText(text: string): Diagnostic[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }
  const state = EditorState.create({ doc: text, extensions: [json()] });
  const root = syntaxTree(state).topNode.firstChild as unknown as SNode | null;
  return loadCharacter(parsed).issues.map((issue) => {
    const range = (root && resolvePathRange(root, issue.path, text)) || { from: 0, to: 0 };
    return {
      from: range.from,
      to: Math.max(range.to, range.from + 1),
      severity: issue.severity,
      message: issue.message,
      source: issue.code,
    };
  });
}

/** A severity marker shown in the gutter (left of the code, by the line number), the same column
 *  as ordinary problem markers. Non-interactive — for a folded section it's an aggregate, so there's
 *  no per-marker message; you open the section to see the specific diagnostics. */
class SeverityMarker extends GutterMarker {
  constructor(readonly severity: "error" | "warning") {
    super();
  }
  eq(other: SeverityMarker) {
    return other.severity === this.severity;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = `rawjson-sev-marker is-${this.severity}`;
    el.setAttribute("aria-hidden", "true");
    return el;
  }
}
const SEVERITY_MARKERS = { error: new SeverityMarker("error"), warning: new SeverityMarker("warning") } as const;

/** The worst severity to attribute to a visible line: any diagnostic that starts on the line, PLUS
 *  — when a fold starts on this line — every diagnostic hidden inside that folded range (recursively,
 *  since the range encloses all nested sections/lists). So a collapsed section still shows a red/
 *  yellow marker on its (visible) header line even though the offending lines are hidden. */
function lineSeverity(state: EditorState, line: BlockInfo): "error" | "warning" | null {
  let severity: "error" | "warning" | null = null;
  const bump = (s: "error" | "warning") => {
    if (s === "error") severity = "error";
    else if (severity !== "error") severity = "warning";
  };
  forEachDiagnostic(state, (d, from) => {
    if (from >= line.from && from <= line.to) bump(d.severity === "error" ? "error" : "warning");
  });
  if (severity === "error") return "error";
  const cursor = foldedRanges(state).iter();
  while (cursor.value) {
    if (state.doc.lineAt(cursor.from).from === line.from) {
      const f = cursor.from;
      const t = cursor.to;
      forEachDiagnostic(state, (d, from, to) => {
        if (to > f && from < t) bump(d.severity === "error" ? "error" : "warning");
      });
    }
    cursor.next();
  }
  return severity;
}

/** One unified severity gutter: ordinary per-line markers AND collapsed-section aggregates, so both
 *  live in the same column next to the line number. Recomputed on doc/fold/lint changes. */
const severityGutter = gutter({
  class: "rawjson-sev-gutter",
  lineMarker: (view, line) => {
    const sev = lineSeverity(view.state, line);
    return sev ? SEVERITY_MARKERS[sev] : null;
  },
  lineMarkerChange: (update) => update.docChanged || update.transactions.some((tr) => tr.effects.length > 0),
  initialSpacer: () => SEVERITY_MARKERS.error,
});

// ---- schema-aware autocompletion -----------------------------------------------------------------
// Drives four flows from schemaModel.ts: empty doc → whole scaffold; empty section → skeleton; inside
// an object → remaining keys; inside an array → a new element. Plus enum/boolean/null value hints at a
// value slot. Commas are inserted where needed so the result stays valid JSON.

/** Property/value child nodes of a container (skips punctuation and error nodes). */
function containerChildren(container: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  for (let c = container.firstChild; c; c = c.nextSibling) {
    if (c.name === "Property" || VALUE_TYPES.has(c.name)) out.push(c);
  }
  return out;
}

/** The dot/index path from the document root to a container node, for schema lookup. */
function pathOfNode(node: SyntaxNode, doc: EditorState["doc"]): (string | number)[] {
  const path: (string | number)[] = [];
  let cur: SyntaxNode | null = node;
  while (cur && cur.name !== "JsonText") {
    const parent: SyntaxNode | null = cur.parent;
    if (!parent) break;
    if (parent.name === "Property") {
      const keyNode = parent.firstChild;
      if (keyNode) path.unshift(unquote(doc.sliceString(keyNode.from, keyNode.to)));
      cur = parent.parent;
    } else if (parent.name === "Array") {
      let idx = 0;
      for (let c = parent.firstChild; c; c = c.nextSibling) {
        if (c === cur) break;
        if (VALUE_TYPES.has(c.name)) idx++;
      }
      path.unshift(idx);
      cur = parent;
    } else {
      cur = parent;
    }
  }
  return path;
}

/** Walk the schema model to the node at a path (null when the path leaves known territory). */
function schemaNodeAtPath(path: (string | number)[]): SchemaNode | null {
  let node: SchemaNode | null = CHARACTER_MODEL;
  for (const seg of path) {
    if (!node) return null;
    node = childForSegment(node, seg);
  }
  return node;
}

/** Climb to the nearest enclosing Object/Array container. */
function enclosingContainer(node: SyntaxNode): SyntaxNode | null {
  for (let n: SyntaxNode | null = node; n; n = n.parent) {
    if (n.name === "Object" || n.name === "Array") return n;
  }
  return null;
}

/** Insert `template` at [from,to], adding a leading comma after the previous sibling and/or a trailing
 *  comma before the next sibling when the container needs them, then run it as a snippet. */
function insertEntry(view: EditorView, from: number, to: number, template: string, container: SyntaxNode): void {
  const doc = view.state.doc;
  const children = containerChildren(container);
  let prev: SyntaxNode | null = null;
  let next: SyntaxNode | null = null;
  for (const c of children) {
    if (c.to <= from) prev = c;
    else if (c.from >= to && !next) next = c;
  }
  let f = from;
  let tEnd = to;
  if (prev && !doc.sliceString(prev.to, from).includes(",")) {
    view.dispatch({ changes: { from: prev.to, insert: "," } });
    f += 1;
    tEnd += 1;
  }
  const trailing = next && !doc.sliceString(to, next.from).includes(",") ? "," : "";
  snippet(template + trailing)(view, null as unknown as Completion, f, tEnd);
}

/** Replace a container node's `{}`/`[]` with a full skeleton (CodeMirror re-indents to match). */
function replaceContainer(view: EditorView, container: SyntaxNode, template: string): void {
  snippet(template)(view, null as unknown as Completion, container.from, container.to);
}

/** Short type hint shown to the right of a key completion. */
function typeHint(node: SchemaNode): string {
  switch (node.type) {
    case "object":
      return "{ }";
    case "array":
      return "[ ]";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "null":
      return "null";
    case "nullable":
      return node.inner.type === "string" && node.inner.enum ? "enum?" : `${typeHint(node.inner)}?`;
    case "string":
      return node.enum ? "enum" : "string";
  }
}

/** Completions for a value slot: enum members / booleans / null, plus a structural skeleton for
 *  object/array-valued fields. `from`===`to` means the value is missing (insert); otherwise a string
 *  value is being edited (replace it). */
function valueCompletions(field: SchemaNode | null, from: number, to: number): CompletionResult | null {
  if (!field) return null;
  const options: Completion[] = valueOptionsAt(field).map((o) => ({ label: o.label, type: "enum", apply: o.insert }));
  if (from === to) {
    const base = field.type === "nullable" ? field.inner : field;
    if (base.type === "object") {
      options.push({
        label: "{ … }",
        type: "type",
        apply: (view, _c, aFrom, aTo) => snippet(containerSkeletonSnippet(base))(view, _c, aFrom, aTo),
      });
    } else if (base.type === "array") {
      const idOpts = hasIdField(base.item) ? { idValue: uid() } : {};
      options.push({
        label: "[ … ]",
        type: "type",
        apply: (view, _c, aFrom, aTo) => snippet(containerSkeletonSnippet(base, idOpts))(view, _c, aFrom, aTo),
      });
    }
  }
  return options.length ? { from, to, options, filter: false } : null;
}

/** Completions for a key position inside an object. */
function keyCompletions(context: CompletionContext, container: SyntaxNode): CompletionResult | null {
  const { state, pos } = context;
  const doc = state.doc;
  const objNode = schemaNodeAtPath(pathOfNode(container, doc));
  if (!objNode || objNode.type !== "object") return null;

  const present = new Set(
    containerChildren(container)
      .filter((c) => c.name === "Property" && c.firstChild)
      .map((c) => unquote(doc.sliceString(c.firstChild!.from, c.firstChild!.to))),
  );

  // Empty object → offer the whole section skeleton (replaces the `{}`).
  if (present.size === 0) {
    return {
      from: pos,
      options: [
        {
          label: "{ … }",
          detail: "section",
          type: "type",
          apply: (view) => replaceContainer(view, container, containerSkeletonSnippet(objNode)),
        },
      ],
      filter: false,
    };
  }

  // Adding a key: figure out the typed prefix (and whether an opening quote is already there).
  const word = context.matchBefore(/"?[\w-]*/);
  let from = pos;
  let quoted = false;
  if (word && word.from !== word.to) {
    from = word.from;
    if (doc.sliceString(word.from, word.from + 1) === '"') {
      quoted = true;
      from = word.from + 1;
    }
  }

  const options: Completion[] = [];
  for (const key of objectKeys(objNode)) {
    if (present.has(key)) continue;
    const child = fieldNode(objNode, key)!;
    let entry = keyEntrySnippet(child, key); // `"key": value`
    if (quoted) entry = entry.slice(1); // an opening quote already sits before `from`
    options.push({
      label: key,
      detail: typeHint(child),
      type: "property",
      apply: (view, _c, aFrom, aTo) => insertEntry(view, aFrom, aTo, entry, container),
    });
  }
  return options.length ? { from, options, validFor: /^[\w-]*$/ } : null;
}

/** Completions for an array position: skeleton (empty) or a new element (non-empty). */
function elementCompletions(context: CompletionContext, container: SyntaxNode): CompletionResult | null {
  const { state, pos } = context;
  const arrNode = schemaNodeAtPath(pathOfNode(container, state.doc));
  if (!arrNode || arrNode.type !== "array") return null;
  const item = arrNode.item;
  const idOpts = hasIdField(item) ? () => ({ idValue: uid() }) : () => ({});

  if (containerChildren(container).length === 0) {
    return {
      from: pos,
      options: [
        {
          label: "[ … ]",
          detail: "1 element",
          type: "type",
          apply: (view) => replaceContainer(view, container, containerSkeletonSnippet(arrNode, idOpts())),
        },
      ],
      filter: false,
    };
  }
  return {
    from: pos,
    options: [
      {
        label: "new element",
        type: "type",
        apply: (view, _c, aFrom, aTo) => insertEntry(view, aFrom, aTo, elementEntrySnippet(item, idOpts()), container),
      },
    ],
    filter: false,
  };
}

/** The single completion source: routes the cursor context to keys / elements / values / scaffold. */
function jsonCompletions(context: CompletionContext): CompletionResult | null {
  const { state, pos } = context;
  const doc = state.doc;

  // 1) Empty document → the whole character scaffold.
  if (doc.toString().trim() === "") {
    return {
      from: 0,
      to: doc.length,
      options: [
        {
          label: "{ character scaffold }",
          type: "type",
          apply: (view, _c, from, to) => snippet(scaffoldSnippet())(view, _c, from, to),
        },
      ],
      filter: false,
    };
  }

  const tree = syntaxTree(state);
  const node = tree.resolveInner(pos, -1);

  // 2) Editing a property key.
  if (node.name === "PropertyName") {
    const obj = node.parent?.parent;
    return obj ? keyCompletions(context, obj) : null;
  }

  // 3) Editing a string that is a property value → enum hints.
  if (node.name === "String" && node.parent?.name === "Property" && node.parent.firstChild !== node) {
    const prop = node.parent;
    const keyNode = prop.firstChild;
    const objContainer = prop.parent;
    if (keyNode && objContainer) {
      const key = unquote(doc.sliceString(keyNode.from, keyNode.to));
      const objNode = schemaNodeAtPath(pathOfNode(objContainer, doc));
      return valueCompletions(objNode ? childForSegment(objNode, key) : null, node.from, node.to);
    }
  }

  // 4) A value slot: the last non-whitespace char before the cursor is a colon.
  const trimmed = doc.sliceString(0, pos).replace(/\s+$/, "");
  if (trimmed.endsWith(":")) {
    const colonPos = trimmed.length - 1; // trimmed is a prefix of the doc, so index === doc position
    const prop = climbTo(tree.resolveInner(colonPos, -1), "Property");
    const keyNode = prop?.firstChild;
    const objContainer = prop?.parent;
    if (keyNode && objContainer) {
      const key = unquote(doc.sliceString(keyNode.from, keyNode.to));
      const objNode = schemaNodeAtPath(pathOfNode(objContainer, doc));
      return valueCompletions(objNode ? childForSegment(objNode, key) : null, pos, pos);
    }
  }

  // 5) Inside a container → keys (object) or elements (array).
  const container = enclosingContainer(node);
  if (!container) return null;
  return container.name === "Object" ? keyCompletions(context, container) : elementCompletions(context, container);
}

/** Climb to the nearest ancestor (inclusive) with the given node name. */
function climbTo(node: SyntaxNode, name: string): SyntaxNode | null {
  for (let n: SyntaxNode | null = node; n; n = n.parent) if (n.name === name) return n;
  return null;
}

export function createJsonEditor(parent: HTMLElement, opts: JsonEditorOptions): JsonEditorHandle {
  const reportDiagnostics = (view: EditorView) => {
    const out: PanelDiagnostic[] = [];
    forEachDiagnostic(view.state, (d, from, to) => {
      out.push({
        from,
        to,
        line: view.state.doc.lineAt(from).number,
        severity: d.severity === "error" ? "error" : "warning",
        message: d.message,
      });
    });
    opts.onDiagnostics(out);
  };

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: opts.doc,
      extensions: [
        lineNumbers(),
        severityGutter,
        highlightActiveLine(),
        highlightActiveLineGutter(),
        foldGutter(),
        history(),
        indentOnInput(),
        bracketMatching(),
        EditorView.lineWrapping,
        json(),
        syntaxHighlighting(highlightStyle),
        autocompletion({ activateOnTyping: true, override: [jsonCompletions], icons: false, maxRenderedOptions: 30 }),
        search({ top: true }),
        linter(jsonParseLinter()),
        linter((view) => schemaDiagnosticsForText(view.state.doc.toString()), { delay: 400 }),
        // Tab first accepts an open completion, then steps between snippet fields, and only then
        // indents — so completion/snippet navigation always wins over indentWithTab below.
        Prec.highest(
          keymap.of([
            { key: "Tab", run: acceptCompletion },
            { key: "Tab", run: nextSnippetField },
            { key: "Shift-Tab", run: prevSnippetField },
          ]),
        ),
        keymap.of([...defaultKeymap, ...historyKeymap, ...foldKeymap, ...searchKeymap, ...lintKeymap, indentWithTab]),
        editorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) opts.onDocChange(update.state.doc.toString());
          // Diagnostics arrive as their own transactions (after the linter delay); re-report on any.
          reportDiagnostics(update.view);
        }),
      ],
    }),
  });

  return {
    destroy: () => view.destroy(),
    reveal: (from, to) => {
      view.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true });
      view.focus();
    },
    triggerCompletion: () => {
      view.focus();
      startCompletion(view);
    },
    foldAll: () => foldAll(view),
    unfoldAll: () => unfoldAll(view),
    openSearch: () => {
      view.focus();
      openSearchPanel(view);
    },
  };
}
