import { useToast } from "./useToast";

/** Stacked transient notifications, bottom-right above the status bar. Click to dismiss. */
export function Toasts() {
  const toasts = useToast((s) => s.toasts);
  const dismiss = useToast((s) => s.dismiss);
  if (toasts.length === 0) return null;
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} type="button" className={`toast toast-${t.kind}`} onClick={() => dismiss(t.id)}>
          <span className="toast-message">{t.message}</span>
          {t.detail && <span className="toast-detail">{t.detail}</span>}
        </button>
      ))}
    </div>
  );
}
