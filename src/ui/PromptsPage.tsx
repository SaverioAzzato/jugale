import { useState } from "react";
import { Panel } from "../render/primitives";
import { useT, useI18n } from "../i18n/useI18n";
import type { Locale } from "../i18n/useI18n";
import { useCharacter } from "../state/store";
import type { Character } from "../schema";
import {
  PROMPTS,
  composePrompt,
  composeCustom,
  composeHeader,
  defaultSegments,
  DEFAULT_GUIDES,
  type Guide,
  type PromptParams,
  type PromptSegments,
} from "../prompts/prompts";
import { usePromptSegments } from "./usePromptSegments";
import { characterJsonSchema } from "../schema/jsonSchema";
import { SCHEMA_CHANGELOG } from "../schema/changelog";
import { saveJsonAs, saveTextAs } from "../storage/exporter";
import { notifySaveOutcome } from "./saveToast";
import { useToast } from "./useToast";

/** Book icon button — opens the full Prompts page (App owns the open/close state). */
export function PromptsButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      className="btn btn-icon"
      aria-label={t("prompts.title")}
      data-overlay-trigger="prompts"
      onClick={onClick}
    >
      <svg viewBox="0 0 24 24" width="24" height="24" className="settings-icon" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M11.25 4.533A9.707 9.707 0 0 0 6 3a9.735 9.735 0 0 0-3.25.555.75.75 0 0 0-.5.707v14.25a.75.75 0 0 0 1 .707A8.237 8.237 0 0 1 6 18.75c1.995 0 3.823.707 5.25 1.886V4.533ZM12.75 20.636A8.214 8.214 0 0 1 18 18.75c.966 0 1.89.166 2.75.47a.75.75 0 0 0 1-.708V4.262a.75.75 0 0 0-.5-.707A9.735 9.735 0 0 0 18 3a9.707 9.707 0 0 0-5.25 1.533v16.103Z"
        />
      </svg>
    </button>
  );
}

/** Lucide "pencil". */
function PencilIcon() {
  return (
    <svg
      className="inline-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

/** Lucide "refresh-cw". */
function ResetIcon() {
  return (
    <svg
      className="inline-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 12.5l5 5 11-11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Lucide "x" — clears the custom instruction. */
function ClearIcon() {
  return (
    <svg className="inline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/** navigator.clipboard needs a secure context/permission; fall back to a hidden textarea + execCommand. */
async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the execCommand fallback below
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

/** Pre-fill the guides field from a loaded character's meta.ruleset (string or { name, url }). */
function guidesFromCharacter(character: Character | null): Guide[] {
  const raw = character?.meta?.ruleset;
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_GUIDES;
  return raw.map((g) =>
    typeof g === "string" ? { name: g } : { name: g.name ?? "", url: typeof g.url === "string" ? g.url : undefined },
  );
}

/** A copy-to-clipboard icon button that toasts on success. `withBase` tells the user the copied text
 *  already carries the base prompt (true for everything except the standalone Migrate prompt). */
function CopyButton({ text, withBase = true }: { text: string; withBase?: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  async function copy() {
    const ok = await copyToClipboard(text);
    if (!ok) {
      useToast.getState().push("error", t("prompts.copyFailed"));
      return;
    }
    useToast.getState().push("success", t(withBase ? "prompts.copiedWithBase" : "prompts.copied"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      className="btn btn-icon prompt-copy-btn"
      onClick={copy}
      aria-label={t("prompts.copy")}
      title={t("prompts.copy")}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

function PromptBlock({ title, text, withBase = true }: { title: string; text: string; withBase?: boolean }) {
  return (
    <div className="prompt-block">
      <div className="prompt-block-head">
        <h3>{title}</h3>
        <CopyButton text={text} withBase={withBase} />
      </div>
      <pre className="prompt-text">{text}</pre>
    </div>
  );
}

/** A user-authored task, composed exactly like Create/Level up/Validate: base + task instruction. */
function CustomSection({
  custom,
  setCustom,
  copyText,
}: {
  custom: string;
  setCustom: (v: string) => void;
  copyText: string;
}) {
  const t = useT();
  return (
    <div className="prompt-block">
      <div className="prompt-block-head">
        <h3>{t("prompts.custom")}</h3>
        <div className="prompt-block-tools">
          <button
            type="button"
            className="btn btn-icon"
            onClick={() => setCustom("")}
            disabled={!custom}
            aria-label={t("prompts.clearCustom")}
            title={t("prompts.clearCustom")}
          >
            <ClearIcon />
          </button>
          <CopyButton text={copyText} withBase />
        </div>
      </div>
      <textarea
        className="prompt-edit-area prompt-custom-area"
        aria-label={t("prompts.custom")}
        value={custom}
        placeholder={t("prompts.customPlaceholder")}
        onChange={(e) => setCustom(e.target.value)}
      />
    </div>
  );
}

/** The editable building blocks (base intro/contract + each task body); the sources/focus header stays generated. */
function SegmentEditors({
  draft,
  setDraft,
  params,
  locale,
}: {
  draft: PromptSegments;
  setDraft: (updater: (d: PromptSegments) => PromptSegments) => void;
  params: PromptParams;
  locale: Locale;
}) {
  const t = useT();
  const taskIds = ["create", "level-up", "validate", "migrate"] as const;

  return (
    <>
      <div className="prompt-block">
        <h3 className="prompt-edit-label" id="prompt-edit-label-base-intro">
          {t("prompts.editBaseIntro")}
        </h3>
        <textarea
          className="prompt-edit-area"
          aria-labelledby="prompt-edit-label-base-intro"
          value={draft.baseIntro}
          onChange={(e) => setDraft((d) => ({ ...d, baseIntro: e.target.value }))}
        />

        <p className="prompt-locked-note">{t("prompts.lockedHeader")}</p>
        <pre className="prompt-text prompt-locked">{composeHeader(params, locale)}</pre>

        <h3 className="prompt-edit-label" id="prompt-edit-label-base-contract">
          {t("prompts.editBaseContract")}
        </h3>
        <textarea
          className="prompt-edit-area"
          aria-labelledby="prompt-edit-label-base-contract"
          value={draft.baseContract}
          onChange={(e) => setDraft((d) => ({ ...d, baseContract: e.target.value }))}
        />
      </div>

      {taskIds.map((id) => {
        const def = PROMPTS.find((p) => p.id === id)!;
        const labelId = `prompt-edit-label-task-${id}`;
        return (
          <div className="prompt-block" key={id}>
            <h3 className="prompt-edit-label" id={labelId}>
              {t(def.titleKey)}{" "}
              <span className="muted">
                — {t(id === "migrate" ? "prompts.editTaskHintStandalone" : "prompts.editTaskHint")}
              </span>
            </h3>
            <textarea
              className="prompt-edit-area"
              aria-labelledby={labelId}
              value={draft.tasks[id]}
              onChange={(e) => setDraft((d) => ({ ...d, tasks: { ...d.tasks, [id]: e.target.value } }))}
            />
          </div>
        );
      })}
    </>
  );
}

/** The migration workflow is a separate top-level panel because it uses a standalone prompt. */
function MigrateSection({ params, segments, locale }: { params: PromptParams; segments: PromptSegments; locale: Locale }) {
  const t = useT();
  const migrate = PROMPTS.find((p) => p.id === "migrate")!;
  return (
    <Panel title={t("prompts.sectionMigrateTitle")}>
      <p className="prompts-intro">{t("prompts.sectionMigrateIntro")}</p>
      <div className="prompts-actions">
        <button
          type="button"
          className="btn"
          onClick={async () => notifySaveOutcome(await saveTextAs(SCHEMA_CHANGELOG, "schema-changelog.md"))}
        >
          {t("prompts.downloadChangelog")}
        </button>
      </div>
      <PromptBlock title={t(migrate.titleKey)} text={composePrompt(migrate.id, params, segments, locale)} withBase={false} />
    </Panel>
  );
}

export function PromptsPage() {
  const t = useT();
  const locale = useI18n((s) => s.locale);
  const character = useCharacter((s) => s.character);
  const saved = usePromptSegments((s) => s.saved);
  const customized = usePromptSegments((s) => s.customized);
  const saveSegments = usePromptSegments((s) => s.save);
  const resetSegments = usePromptSegments((s) => s.reset);
  const custom = usePromptSegments((s) => s.custom);
  const setCustom = usePromptSegments((s) => s.setCustom);
  // Customized → the user's frozen set; otherwise the shipped defaults for the current UI language.
  const segments = customized && saved ? saved : defaultSegments(locale);

  const [guides, setGuides] = useState<Guide[]>(() => guidesFromCharacter(character));
  const [className, setClassName] = useState(() => character?.classes?.[0]?.name ?? "");
  const [race, setRace] = useState(() => character?.identity?.race ?? "");

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PromptSegments>(segments);

  const params: PromptParams = { guides, className, race };

  function startEdit() {
    setDraft(segments);
    setEditing(true);
  }
  function save() {
    saveSegments(draft);
    setEditing(false);
  }
  function reset() {
    if (!customized) return;
    if (!window.confirm(t("prompts.confirmReset"))) return;
    resetSegments();
    setEditing(false);
  }

  function updateGuide(i: number, patch: Partial<Guide>) {
    setGuides((gs) => gs.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }
  function addGuide() {
    setGuides((gs) => [...gs, { name: "" }]);
  }
  function removeGuide(i: number) {
    setGuides((gs) => gs.filter((_, idx) => idx !== i));
  }

  return (
    <div className="settings-page prompts-page">
      <Panel title={t("prompts.sectionBuildTitle")}>
        <p className="prompts-banner" role="note">
          {t("prompts.banner")}
        </p>
        <p className="prompts-intro">{t("prompts.intro")}</p>

        <div className="prompts-params">
          <h3 className="prompts-params-title">{t("prompts.params")}</h3>

          <label className="prompts-field-label">{t("prompts.guides")}</label>
          {guides.map((g, i) => (
            <div className="prompts-guide-row" key={i}>
              <input
                className="prompts-input"
                value={g.name}
                placeholder={t("prompts.guideName")}
                aria-label={t("prompts.guideName")}
                onChange={(e) => updateGuide(i, { name: e.target.value })}
              />
              <input
                className="prompts-input"
                value={g.url ?? ""}
                placeholder={t("prompts.guideUrl")}
                aria-label={t("prompts.guideUrl")}
                onChange={(e) => updateGuide(i, { url: e.target.value })}
              />
              <button
                type="button"
                className="btn prompts-guide-remove"
                aria-label={t("prompts.removeGuide")}
                onClick={() => removeGuide(i)}
              >
                ×
              </button>
            </div>
          ))}
          <button type="button" className="btn" onClick={addGuide}>
            {t("prompts.addGuide")}
          </button>

          <div className="prompts-focus">
            <label className="prompts-focus-field">
              <span>{t("prompts.focusClass")}</span>
              <input className="prompts-input" value={className} onChange={(e) => setClassName(e.target.value)} />
            </label>
            <label className="prompts-focus-field">
              <span>{t("prompts.focusRace")}</span>
              <input className="prompts-input" value={race} onChange={(e) => setRace(e.target.value)} />
            </label>
          </div>
          <p className="prompts-focus-hint muted">{t("prompts.focusHint")}</p>
        </div>

        <div className="prompts-actions">
          {editing ? (
            <>
              <button type="button" className="btn btn-primary" onClick={save}>
                {t("prompts.save")}
              </button>
              <button type="button" className="btn" onClick={() => setEditing(false)}>
                {t("prompts.cancel")}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn prompts-action-btn" onClick={startEdit}>
                <PencilIcon />
                {t("prompts.edit")}
              </button>
              <button
                type="button"
                className="btn prompts-action-btn"
                onClick={reset}
                disabled={!customized}
                title={customized ? undefined : t("prompts.resetNone")}
              >
                <ResetIcon />
                {t("prompts.reset")}
              </button>
            </>
          )}
          <button
            type="button"
            className="btn"
            onClick={async () => notifySaveOutcome(await saveJsonAs(characterJsonSchema, "character.schema.json"))}
          >
            {t("prompts.downloadSchema")}
          </button>
        </div>

        {editing ? (
          <SegmentEditors draft={draft} setDraft={setDraft} params={params} locale={locale} />
        ) : (
          <>
            {PROMPTS.filter((p) => p.id !== "migrate").map((p) => (
              <PromptBlock key={p.id} title={t(p.titleKey)} text={composePrompt(p.id, params, segments, locale)} />
            ))}
            <CustomSection custom={custom} setCustom={setCustom} copyText={composeCustom(params, segments, locale, custom)} />
          </>
        )}
      </Panel>
      {!editing && <MigrateSection params={params} segments={segments} locale={locale} />}
    </div>
  );
}
