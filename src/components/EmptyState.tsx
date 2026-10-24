import type React from "react";
import { AlertCircleIcon, ImageIcon, RefreshCwIcon } from "./icons";

export type EmptyStateType =
  | "new-session"
  | "generating"
  | "no-success"
  | "unavailable-artifact";

export interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  message?: string;
  action?: React.ReactNode;
  className?: string;
}

const DEFAULT_CONFIG: Record<
  EmptyStateType,
  { defaultTitle: string; defaultMessage: string }
> = {
  "new-session": {
    defaultTitle: "No candidates yet",
    defaultMessage:
      "Start a new generation by providing a prompt above to create candidates.",
  },
  generating: {
    defaultTitle: "Generating candidates",
    defaultMessage:
      "Please wait while candidates are being generated, validated, and rendered.",
  },
  "no-success": {
    defaultTitle: "No successful candidates",
    defaultMessage:
      "All candidate jobs in this batch failed or were cancelled. Inspect the errors or retry.",
  },
  "unavailable-artifact": {
    defaultTitle: "Artifact unavailable",
    defaultMessage:
      "The requested image, source code, or SVG artifact could not be located.",
  },
};

export function EmptyState({
  type,
  title,
  message,
  action,
  className = "",
}: EmptyStateProps) {
  const config = DEFAULT_CONFIG[type];
  const finalTitle = title || config.defaultTitle;
  const finalMessage = message || config.defaultMessage;

  const renderIcon = () => {
    switch (type) {
      case "generating":
        return <RefreshCwIcon size={36} className="empty-icon spin" />;
      case "no-success":
        return <AlertCircleIcon size={36} className="empty-icon alert" />;
      default:
        return <ImageIcon size={36} className="empty-icon placeholder" />;
    }
  };

  return (
    <section
      className={`empty-state empty-state-${type} ${className}`.trim()}
      data-empty-type={type}
      aria-label={finalTitle}
    >
      <div className="empty-state-icon-wrapper">{renderIcon()}</div>
      <h3 className="empty-state-title">{finalTitle}</h3>
      <p className="empty-state-message">{finalMessage}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </section>
  );
}
