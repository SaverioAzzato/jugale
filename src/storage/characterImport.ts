import { isAndroid, pickCharacterImportTargetAndroid } from "./androidProvider";
import {
  pickCharacterImportTargetWeb,
  type CharacterImportTarget,
} from "./provider";
import { isTauri, pickCharacterImportTargetTauri } from "./tauriProvider";

/** Pick a character-folder import destination using the current host's native folder access. */
export async function pickCharacterImportTarget(): Promise<CharacterImportTarget | null> {
  if (isAndroid()) return pickCharacterImportTargetAndroid();
  if (isTauri()) return pickCharacterImportTargetTauri();
  return pickCharacterImportTargetWeb();
}
