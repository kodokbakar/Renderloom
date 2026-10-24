import type { CandidateTiming } from "../../domain/candidate";

export function formatTimingDuration(ms?: number | null): string {
  if (ms === undefined || ms === null || Number.isNaN(ms) || ms < 0) {
    return "—";
  }

  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }

  if (ms < 60000) {
    const s = ms / 1000;
    return `${s.toFixed(1)}s`;
  }

  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

export function getCandidateDuration(
  timing?: CandidateTiming,
): number | undefined {
  if (!timing) return undefined;
  if (typeof timing.durationMs === "number" && timing.durationMs >= 0) {
    return timing.durationMs;
  }

  const start = timing.generationStartedAt ?? timing.queuedAt;
  const end =
    timing.completedAt ?? timing.renderingEndedAt ?? timing.validationEndedAt;

  if (start && end) {
    const startMs = Date.parse(start);
    const endMs = Date.parse(end);
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs >= startMs) {
      return endMs - startMs;
    }
  }

  return undefined;
}

export function formatCandidateDuration(timing?: CandidateTiming): string {
  const duration = getCandidateDuration(timing);
  return formatTimingDuration(duration);
}
