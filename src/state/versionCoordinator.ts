import { interpolate, type StringKey } from "../i18n/useI18n";
import {
  loadCharacter,
  type Character,
  type CharacterValidation,
  type Issue,
  type LoadResult,
} from "../schema";
import type { GalleryImage, StorageProvider } from "../storage/provider";
import type { CharacterVersion, VersionReason } from "../storage/versions";

interface VersionCoordinatorState {
  source: unknown | null;
  draft: unknown | null;
  validation: CharacterValidation | null;
  lastPersisted: unknown | null;
  character: Character | null;
  issues: Issue[];
  migrated: boolean;
  ok: boolean;
  sourceName: string;
  images: GalleryImage[];
  provider: StorageProvider | null;
  liveSync: boolean;
  dirty: boolean;
  saveError: string | null;
  readOnly: boolean;
  editMode: boolean;
  versionBusy: boolean;
}

interface VersionCoordinatorDependencies {
  t(key: StringKey): string;
  toast: { push(kind: "success" | "error" | "info", message: string, detail?: string): void };
  versionHistoryEnabled(): boolean;
}

interface VersionCoordinatorOptions {
  getState(): VersionCoordinatorState;
  setState(patch: Partial<VersionCoordinatorState>): void;
  flushPendingSave(): Promise<boolean>;
  dependencies: VersionCoordinatorDependencies;
}

const loadedFields = (result: LoadResult) => ({
  source: result.source,
  draft: result.draft,
  validation: result.validation,
  character: result.projection,
  issues: result.issues,
  migrated: result.migrated,
  ok: result.ok,
});

/** Owns snapshot creation and atomic whole-character replacement around persistence. */
export function createVersionCoordinator(options: VersionCoordinatorOptions) {
  const { getState, setState, flushPendingSave, dependencies } = options;

  const createVersion = async (
    reason: VersionReason = "checkpoint",
    title?: string,
  ): Promise<CharacterVersion | null> => {
    const initial = getState();
    if (
      initial.versionBusy ||
      initial.validation?.kind !== "valid" ||
      !initial.provider?.versions ||
      !initial.liveSync ||
      initial.readOnly
    ) return null;
    setState({ versionBusy: true });
    try {
      if (!(await flushPendingSave())) return null;
      const { provider, lastPersisted } = getState();
      if (!provider?.versions || lastPersisted == null) return null;
      const version = await provider.versions.create(lastPersisted, reason, title);
      dependencies.toast.push(
        "success",
        interpolate(dependencies.t("versions.saved"), { filename: version.filename }),
      );
      return version;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      dependencies.toast.push("error", dependencies.t("versions.saveFailed"), detail);
      return null;
    } finally {
      setState({ versionBusy: false });
    }
  };

  const replaceCharacter = async (
    raw: unknown,
    reason: "before-import" | "before-restore",
    snapshotOverride?: boolean,
  ): Promise<boolean> => {
    if (getState().versionBusy) return false;
    const next = loadCharacter(raw);
    if (next.validation.kind !== "valid") return false;
    setState({ versionBusy: true });
    try {
      if (!(await flushPendingSave())) return false;
      const { provider, character, lastPersisted, sourceName, images } = getState();
      if (!character) return false;

      if (!provider) {
        setState({
          ...loadedFields(next),
          lastPersisted: null,
          sourceName,
          images,
          dirty: true,
          editMode: false,
        });
        return true;
      }
      if (!getState().liveSync || getState().readOnly) {
        dependencies.toast.push("error", dependencies.t("versions.replaceUnavailable"));
        return false;
      }

      const versionStore = provider.versions;
      const shouldSnapshot = Boolean(versionStore && (
        snapshotOverride ?? (reason === "before-restore" || dependencies.versionHistoryEnabled())
      ));
      if (shouldSnapshot) {
        try {
          if (lastPersisted == null) return false;
          await versionStore?.create(lastPersisted, reason);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          dependencies.toast.push("error", dependencies.t("versions.replaceAborted"), detail);
          return false;
        }
      }

      try {
        await provider.write(next.validation.persistable);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        dependencies.toast.push("error", dependencies.t("versions.replaceFailed"), detail);
        if (getState().provider === provider) {
          setState({ saveError: detail, liveSync: false, readOnly: true });
        }
        return false;
      }

      setState({
        ...loadedFields(next),
        lastPersisted: next.validation.persistable.document,
        sourceName,
        images,
        dirty: false,
        saveError: null,
        editMode: false,
      });
      return true;
    } finally {
      setState({ versionBusy: false });
    }
  };

  return { createVersion, replaceCharacter };
}
