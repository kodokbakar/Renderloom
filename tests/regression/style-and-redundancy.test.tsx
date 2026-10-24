import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { App } from "../../src/app/App";
import { NewSessionModal } from "../../src/components/NewSessionModal";
import { StudioControls } from "../../src/components/StudioControls";
import type {
  FullSession,
  Session,
  SessionSummary,
} from "../../src/domain/session";
import { composePrompt } from "../../src/prompts/composer";
import { StyleRegistry } from "../../src/styles/registry";

describe("Regression: style preset tech-minimal and redundant parameter bar", () => {
  const mockSession: Session = {
    id: "sess-test",
    name: "Test Session",
    slug: "test-session",
    providerId: "anthropic",
    modelId: "claude-3-5-sonnet",
    styleId: "minimal",
    dimensions: { width: 1024, height: 1024 },
    createdAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z",
  };

  const mockFullSession: FullSession = {
    session: mockSession,
    conversation: {
      sessionId: "sess-test",
      messages: [],
      updatedAt: "2026-10-24T00:00:00.000Z",
    },
    promptSnapshot: "Test prompt snapshot",
    generationConfig: {
      providerId: "anthropic",
      modelId: "claude-3-5-sonnet",
      styleId: "minimal",
      candidateCount: 1,
      width: 1024,
      height: 1024,
      outputFormat: "png",
      createdAt: "2026-10-24T00:00:00.000Z",
    },
    artifacts: {
      images: [],
      source: [],
      svg: [],
      assets: [],
    },
  };

  const mockSessions: SessionSummary[] = [
    {
      id: "sess-test",
      name: "Test Session",
      slug: "test-session",
      providerId: "anthropic",
      modelId: "claude-3-5-sonnet",
      styleId: "minimal",
      dimensions: { width: 1024, height: 1024 },
      candidateCount: 0,
      createdAt: "2026-10-24T00:00:00.000Z",
      updatedAt: "2026-10-24T00:00:00.000Z",
    },
  ];

  describe("Bug 1: tech-minimal style preset availability and validation", () => {
    test("StyleRegistry should resolve 'tech-minimal' preset", async () => {
      const registry = new StyleRegistry();
      // Fails because style-presets/tech-minimal.json does not exist
      const preset = await registry.getPreset("tech-minimal");
      expect(preset.id).toBe("tech-minimal");
    });

    test("composePrompt should succeed with styleId 'tech-minimal'", async () => {
      const registry = new StyleRegistry();
      // Fails with: Style preset 'tech-minimal' not found. Available styles: bauhaus, brutalist, editorial, minimal, swiss
      const composed = await composePrompt(
        {
          prompt: "Modern tech minimal illustration",
          styleId: "tech-minimal",
          candidateCount: 1,
          width: 1024,
          height: 1024,
        },
        { styleRegistry: registry },
      );
      expect(composed.metadata.styleId).toBe("tech-minimal");
    });

    test("NewSessionModal default styles must exist in backend StyleRegistry", async () => {
      const registry = new StyleRegistry();
      const availablePresets = new Set(
        (await registry.listPresets()).map((p) => p.id),
      );

      const html = renderToStaticMarkup(
        <NewSessionModal
          isOpen={true}
          onClose={() => {}}
          onCreate={async () => {}}
        />,
      );

      const styleSelectMatch = html.match(
        /data-testid="new-session-style-select"[^>]*>([\s\S]*?)<\/select>/,
      );
      expect(styleSelectMatch).toBeTruthy();
      const rawOptions = styleSelectMatch?.[1]
        ? Array.from(styleSelectMatch[1].matchAll(/<option value="([^"]+)"/g))
        : [];
      const options = rawOptions
        .map((m) => m[1])
        .filter((id): id is string => typeof id === "string");
      expect(options.length).toBeGreaterThan(0);
      for (const styleId of options) {
        expect(availablePresets.has(styleId)).toBe(true);
      }
    });

    test("StudioControls default styles must exist in backend StyleRegistry", async () => {
      const registry = new StyleRegistry();
      const availablePresets = new Set(
        (await registry.listPresets()).map((p) => p.id),
      );

      const html = renderToStaticMarkup(
        <StudioControls
          session={mockSession}
          isGenerating={false}
          onGenerate={async () => {}}
        />,
      );

      const styleSelectMatch = html.match(
        /data-testid="studio-style-select"[^>]*>([\s\S]*?)<\/select>/,
      );
      expect(styleSelectMatch).toBeTruthy();
      const rawOptions = styleSelectMatch?.[1]
        ? Array.from(styleSelectMatch[1].matchAll(/<option value="([^"]+)"/g))
        : [];
      const options = rawOptions
        .map((m) => m[1])
        .filter((id): id is string => typeof id === "string");
      expect(options.length).toBeGreaterThan(0);
      for (const styleId of options) {
        expect(availablePresets.has(styleId)).toBe(true);
      }
    });
  });

  describe("Bug 2: Redundant stacked parameter UI display in Studio view", () => {
    test("App in studio view should not render duplicate GenerationSettingsBar when StudioControls is present", () => {
      const html = renderToStaticMarkup(
        <App
          initialFullSession={mockFullSession}
          initialSessions={mockSessions}
          initialView="studio"
        />,
      );

      // StudioControls renders toolbar with provider, model, style preset, aspect ratio, candidate count
      expect(html).toContain("studio-controls");

      // GenerationSettingsBar duplicates the exact same parameters directly above StudioControls
      expect(html).not.toContain("generation-settings-bar");
    });
  });
});
