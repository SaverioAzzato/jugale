import { create } from "zustand";

/** Tiny transient-notification store. Toasts auto-dismiss; errors linger a bit longer. */
export type ToastKind = "success" | "error" | "info";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    const ttl = kind === "error" ? 6000 : 3500;
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), ttl);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
