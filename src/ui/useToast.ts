import { create } from "zustand";
import { useSettings } from "./useSettings";

/** Tiny transient-notification store. Toasts auto-dismiss; errors linger a bit longer. */
export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Optional smaller second line (e.g. dice rolls). */
  detail?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, message: string, detail?: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message, detail) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message, detail }] }));
    const seconds = useSettings.getState().toastSeconds;
    if (seconds > 0) {
      // Errors always linger at least 10s so they aren't missed.
      const ttl = Math.max(seconds, kind === "error" ? 10 : 0) * 1000;
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ttl);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
