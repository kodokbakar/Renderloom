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
});
