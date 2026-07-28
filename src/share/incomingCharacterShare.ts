import { addPluginListener, invoke, type PluginListener } from "@tauri-apps/api/core";
import { isAndroid } from "../storage/androidProvider";

export type IncomingShareError =
  | "unsupported-type"
  | "multiple-files"
  | "missing-file"
  | "too-large"
  | "empty-file"
  | "invalid-utf8"
  | "invalid-json"
  | "unreadable";

export type IncomingSharePayload =
  | { status: "empty" }
  | { status: "error"; error: IncomingShareError }
  | {
      status: "character";
      id: string;
      name: string;
      mime: string;
      contents: string;
    };

function isIncomingSharePayload(value: unknown): value is IncomingSharePayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  if (payload.status === "empty") return true;
  if (payload.status === "error") return typeof payload.error === "string";
  return payload.status === "character"
    && typeof payload.id === "string"
    && typeof payload.name === "string"
    && typeof payload.mime === "string"
    && typeof payload.contents === "string";
}

export async function takePendingCharacterShare(): Promise<IncomingSharePayload> {
  if (!isAndroid()) return { status: "empty" };
  const payload = await invoke<unknown>("plugin:android-share|take_pending_share");
  return isIncomingSharePayload(payload) ? payload : { status: "error", error: "unreadable" };
}

export async function listenForCharacterShares(
  handler: (payload: IncomingSharePayload) => void,
): Promise<PluginListener | null> {
  if (!isAndroid()) return null;
  return addPluginListener<unknown>("android-share", "character-share", (payload) => {
    handler(isIncomingSharePayload(payload) ? payload : { status: "error", error: "unreadable" });
  });
}
