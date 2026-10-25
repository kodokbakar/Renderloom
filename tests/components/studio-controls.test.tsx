import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StudioControls } from "../../src/components/StudioControls";
import type { Session } from "../../src/domain/session";

describe("StudioControls", () => {
  const mockSession: Session = {
    id: "sess-brand",
    name: "Studio Brand",
    slug: "studio-brand",
    providerId: "anthropic",
    modelId: "claude-3-5-sonnet",
    styleId: "tech-minimal",
    dimensions: { width: 1024, height: 1024 },
    createdAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z",
  };

  test("renders parameter toolbar, aspect ratio pills, count pills, prompt textarea, and generate button", () => {
    const html = renderToStaticMarkup(
      <StudioControls
        session={mockSession}
        isGenerating={false}
        onGenerate={async () => {}}
      />,
    );

    expect(html).toContain('data-testid="studio-provider-select"');
    expect(html).toContain('data-testid="studio-model-select"');
    expect(html).toContain('data-testid="studio-style-select"');
    expect(html).toContain('data-testid="style-swatches"');
    expect(html).toContain('data-testid="studio-ratio-1:1"');
    expect(html).toContain('data-testid="studio-ratio-16:9"');
    expect(html).toContain('data-testid="candidate-count-1"');
    expect(html).toContain('data-testid="candidate-count-4"');
    expect(html).toContain('data-testid="candidate-count-custom"');
    expect(html).toContain('data-testid="studio-story-mode-toggle"');
    expect(html).toContain('data-testid="studio-prompt-input"');
    expect(html).toContain('data-testid="prompt-char-count"');
    expect(html).toContain('data-testid="generate-btn"');
    expect(html).toContain("Generate ✦");
  });

  test("disables controls and displays Generating... when isGenerating is true", () => {
    const html = renderToStaticMarkup(
      <StudioControls
        session={mockSession}
        isGenerating={true}
        onGenerate={async () => {}}
      />,
    );

    expect(html).toContain("Generating...");
    expect(html).toContain("disabled");
  });
  test("renders custom model text input when session uses Custom provider", () => {
    const customSession: Session = {
      ...mockSession,
      providerId: "custom",
      modelId: "llama3",
    };

    const html = renderToStaticMarkup(
      <StudioControls
        session={customSession}
        isGenerating={false}
        onGenerate={async () => {}}
      />,
    );

    expect(html).toContain('data-testid="studio-custom-model-input"');
    expect(html).toContain('list="studio-custom-models"');
    expect(html).not.toContain('data-testid="studio-model-select"');
  });

  test("renders custom model text input populated with custom model ID and datalist options", () => {
    const customSession: Session = {
      ...mockSession,
      providerId: "custom",
      modelId: "qwen2.5-coder:32b",
    };

    const html = renderToStaticMarkup(
      <StudioControls
        session={customSession}
        isGenerating={false}
        onGenerate={async () => {}}
      />,
    );

    expect(html).toContain('data-testid="studio-custom-model-input"');
    expect(html).toContain('value="qwen2.5-coder:32b"');
    expect(html).toContain('list="studio-custom-models"');
    expect(html).toContain('<option value="llama3"');
    expect(html).toContain('<option value="qwen2.5-coder"');
  });

  test("renders custom count input when candidateCount > 4 in generationConfig", () => {
    const html = renderToStaticMarkup(
      <StudioControls
        session={mockSession}
        generationConfig={{
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet",
          styleId: "tech-minimal",
          candidateCount: 8,
          width: 1024,
          height: 1024,
          outputFormat: "png",
          createdAt: "2026-10-24T00:00:00.000Z",
        }}
        isGenerating={false}
        onGenerate={async () => {}}
      />,
    );

    expect(html).toContain('data-testid="candidate-count-custom"');
    expect(html).toContain('data-testid="studio-custom-count-input"');
    expect(html).toContain('value="8"');
    expect(html).toContain('min="1"');
    expect(html).toContain('max="10"');
  });

  test("renders narrative arc badge when storyMode is active", () => {
    const html = renderToStaticMarkup(
      <StudioControls
        session={mockSession}
        generationConfig={{
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet",
          styleId: "tech-minimal",
          candidateCount: 3,
          width: 1024,
          height: 1024,
          outputFormat: "png",
          createdAt: "2026-10-24T00:00:00.000Z",
          storyMode: true,
        }}
        isGenerating={false}
        onGenerate={async () => {}}
      />,
    );

    expect(html).toContain('data-testid="studio-story-mode-toggle"');
    expect(html).toContain('data-testid="narrative-arc-badge"');
    expect(html).toContain("Hook");
    expect(html).toContain("Core");
    expect(html).toContain("Payoff");
    expect(html).toContain("→");
  });

  test("narrative arc badge adapts correctly for count of 2 and count of 6", () => {
    const html2 = renderToStaticMarkup(
      <StudioControls
        session={mockSession}
        generationConfig={{
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet",
          styleId: "tech-minimal",
          candidateCount: 2,
          width: 1024,
          height: 1024,
          outputFormat: "png",
          createdAt: "2026-10-24T00:00:00.000Z",
          storyMode: true,
        }}
        isGenerating={false}
        onGenerate={async () => {}}
      />,
    );

    expect(html2).toContain("Hook");
    expect(html2).not.toContain('class="arc-step core"');
    expect(html2).toContain("Payoff");

    const html6 = renderToStaticMarkup(
      <StudioControls
        session={mockSession}
        generationConfig={{
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet",
          styleId: "tech-minimal",
          candidateCount: 6,
          width: 1024,
          height: 1024,
          outputFormat: "png",
          createdAt: "2026-10-24T00:00:00.000Z",
          storyMode: true,
        }}
        isGenerating={false}
        onGenerate={async () => {}}
      />,
    );

    expect(html6).toContain("Hook");
    expect(html6).toContain('class="arc-step core"');
    expect(html6).toContain("Core ×4");
    expect(html6).toContain("Payoff");
  });

  test("narrative arc badge with count of 1 renders only Hook and no arrows or other phases", () => {
    const html1 = renderToStaticMarkup(
      <StudioControls
        session={mockSession}
        generationConfig={{
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet",
          styleId: "tech-minimal",
          candidateCount: 1,
          width: 1024,
          height: 1024,
          outputFormat: "png",
          createdAt: "2026-10-24T00:00:00.000Z",
          storyMode: true,
        }}
        isGenerating={false}
        onGenerate={async () => {}}
      />,
    );

    expect(html1).toContain('data-testid="narrative-arc-badge"');
    expect(html1).toContain("Hook");
    expect(html1).not.toContain("→");
    expect(html1).not.toContain('class="arc-step core"');
    expect(html1).not.toContain('class="arc-step payoff"');
  });

  test("narrative arc badge with count of 5 and 10 displays correct core multiplier", () => {
    const html5 = renderToStaticMarkup(
      <StudioControls
        session={mockSession}
        generationConfig={{
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet",
          styleId: "tech-minimal",
          candidateCount: 5,
          width: 1024,
          height: 1024,
          outputFormat: "png",
          createdAt: "2026-10-24T00:00:00.000Z",
          storyMode: true,
        }}
        isGenerating={false}
        onGenerate={async () => {}}
      />,
    );
    expect(html5).toContain("Core ×3");

    const html10 = renderToStaticMarkup(
      <StudioControls
        session={mockSession}
        generationConfig={{
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet",
          styleId: "tech-minimal",
          candidateCount: 10,
          width: 1024,
          height: 1024,
          outputFormat: "png",
          createdAt: "2026-10-24T00:00:00.000Z",
          storyMode: true,
        }}
        isGenerating={false}
        onGenerate={async () => {}}
      />,
    );
    expect(html10).toContain("Core ×8");
    expect(html10).toContain("Hook");
    expect(html10).toContain("Payoff");
  });

  test("story mode toggle is inactive and badge is omitted when storyMode is false", () => {
    const html = renderToStaticMarkup(
      <StudioControls
        session={mockSession}
        generationConfig={{
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet",
          styleId: "tech-minimal",
          candidateCount: 4,
          width: 1024,
          height: 1024,
          outputFormat: "png",
          createdAt: "2026-10-24T00:00:00.000Z",
          storyMode: false,
        }}
        isGenerating={false}
        onGenerate={async () => {}}
      />,
    );

    expect(html).toContain('data-testid="studio-story-mode-toggle"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).not.toContain('data-testid="narrative-arc-badge"');
  });

  test("disables custom count input and story mode toggle during active generation", () => {
    const html = renderToStaticMarkup(
      <StudioControls
        session={mockSession}
        generationConfig={{
          providerId: "anthropic",
          modelId: "claude-3-5-sonnet",
          styleId: "tech-minimal",
          candidateCount: 7,
          width: 1024,
          height: 1024,
          outputFormat: "png",
          createdAt: "2026-10-24T00:00:00.000Z",
          storyMode: true,
        }}
        isGenerating={true}
        onGenerate={async () => {}}
      />,
    );

    expect(html).toContain('data-testid="studio-custom-count-input"');
    expect(html).toContain('data-testid="studio-story-mode-toggle"');
    // Both custom count input and story mode toggle have disabled attribute
    expect(html).toMatch(
      /data-testid="studio-custom-count-input"[^>]*disabled/,
    );
    expect(html).toMatch(/data-testid="studio-story-mode-toggle"[^>]*disabled/);
  });
});
