/** Application composition root for the pure character-store factory. */
import { makeRng } from "./model/formula";
import { saveJsonAs } from "./storage/exporter";
import { createCharacterStore } from "./state/store";
import { translate, useI18n } from "./i18n/useI18n";
import { useDice } from "./ui/useDice";
import { notifySaveOutcome } from "./ui/saveToast";
import { useSettings } from "./ui/useSettings";
import { useToast } from "./ui/useToast";

export const useCharacter = createCharacterStore({
  now: () => Date.now(),
  makeRng,
  schedule: (callback, delayMs) => setTimeout(callback, delayMs),
  cancelScheduled: (handle) => clearTimeout(handle),
  t: (key) => translate(useI18n.getState().locale, key),
  toast: { push: (...args) => useToast.getState().push(...args) },
  presentDice: (faces) => useDice.getState().present(faces),
  versionHistoryEnabled: () => useSettings.getState().versionHistory,
  exportDocument: async (data, defaultName) => notifySaveOutcome(await saveJsonAs(data, defaultName)),
});

export type { CharacterState, CharacterStoreDependencies, CoreCharacterEdit } from "./state/store";
