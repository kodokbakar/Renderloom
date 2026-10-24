import React from "react";
import type { CandidateState } from "../domain/candidate";
import {
  AlertCircleIcon,
  BanIcon,
  CheckIcon,
  ClockIcon,
  RefreshCwIcon,
} from "./icons";

export interface StatusBadgeProps {
  state: CandidateState;
  className?: string;
  showIcon?: boolean;
}

const STATE_CONFIG: Record<
  CandidateState,
  { label: string; className: string }
> = {
  queued: { label: "Queued", className: "badge-queued" },
  generating: { label: "Generating", className: "badge-generating" },
  validating: { label: "Validating", className: "badge-validating" },
  rendering: { label: "Rendering", className: "badge-rendering" },
  completed: { label: "Completed", className: "badge-completed" },
  failed: { label: "Failed", className: "badge-failed" },
  cancelled: { label: "Cancelled", className: "badge-cancelled" },
};

export function StatusBadge({
  state,
  className = "",
  showIcon = true,
}: StatusBadgeProps) {
  const config = STATE_CONFIG[state] ?? {
    label: state,
    className: "badge-unknown",
  };

  const renderIcon = () => {
    if (!showIcon) return null;
    switch (state) {
      case "queued":
        return <ClockIcon size={12} className="badge-icon" />;
      case "generating":
      case "validating":
      case "rendering":
        return <RefreshCwIcon size={12} className="badge-icon spin" />;
      case "completed":
        return <CheckIcon size={12} className="badge-icon" />;
      case "failed":
        return <AlertCircleIcon size={12} className="badge-icon" />;
      case "cancelled":
        return <BanIcon size={12} className="badge-icon" />;
      default:
        return null;
    }
  };

  return (
    <span
      className={`status-badge ${config.className} ${className}`.trim()}
      data-state={state}
      aria-label={`Status: ${config.label}`}
    >
      {renderIcon()}
      <span className="badge-text">{config.label}</span>
    </span>
  );
}
