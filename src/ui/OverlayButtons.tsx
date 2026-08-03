import { useT } from "../i18n/useI18n";
import { BookIcon } from "./AppIcons";

export function HelpButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      className="btn btn-icon help-button"
      title={label ?? t("help.title")}
      aria-label={label ?? t("help.title")}
      data-overlay-trigger="help"
      onClick={onClick}
    >
      ?
    </button>
  );
}

export function PromptsButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      className="btn btn-icon"
      aria-label={label ?? t("prompts.title")}
      data-overlay-trigger="prompts"
      onClick={onClick}
    >
      <BookIcon />
    </button>
  );
}

export function SettingsButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      className="btn btn-icon"
      aria-label={t("settings.title")}
      data-overlay-trigger="settings"
      onClick={onClick}
    >
      <svg
        viewBox="0 0 24 24"
        width="24"
        height="24"
        className="settings-icon"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5ZM9.75 2.25h4.5a.75.75 0 0 1 .73.58l.5 2.1a8.06 8.06 0 0 1 1.62.94l2.06-.76a.75.75 0 0 1 .9.33l2.1 3.64a.75.75 0 0 1-.16.95l-1.7 1.4a8.1 8.1 0 0 1 0 1.94l1.7 1.4a.75.75 0 0 1 .16.95l-2.1 3.64a.75.75 0 0 1-.9.33l-2.06-.76a8.06 8.06 0 0 1-1.62.94l-.5 2.1a.75.75 0 0 1-.73.58h-4.5a.75.75 0 0 1-.73-.58l-.5-2.1a8.06 8.06 0 0 1-1.62-.94l-2.06.76a.75.75 0 0 1-.9-.33l-2.1-3.64a.75.75 0 0 1 .16-.95l1.7-1.4a8.1 8.1 0 0 1 0-1.94l-1.7-1.4a.75.75 0 0 1-.16-.95l2.1-3.64a.75.75 0 0 1 .9-.33l2.06.76a8.06 8.06 0 0 1 1.62-.94l.5-2.1a.75.75 0 0 1 .73-.58Z"
        />
      </svg>
    </button>
  );
}
