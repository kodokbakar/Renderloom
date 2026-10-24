import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ApiKeyModal,
  type EnrichedProviderMeta,
} from "../../src/components/ApiKeyModal";

describe("ApiKeyModal", () => {
  const mockProviders: EnrichedProviderMeta[] = [
    {
      id: "anthropic",
      name: "Anthropic",
      supportsCustomBaseUrl: true,
      defaultModelId: "claude-3-5-sonnet",
      models: [{ id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet" }],
      status: {
        configured: true,
        maskedKey: "sk-ant-...49f1",
      },
    },
    {
      id: "openai",
      name: "OpenAI",
      supportsCustomBaseUrl: false,
      defaultModelId: "gpt-4o",
      models: [{ id: "gpt-4o", name: "GPT-4o" }],
      status: {
        configured: false,
      },
    },
  ];

  test("renders closed modal as null", () => {
    const html = renderToStaticMarkup(
      <ApiKeyModal
        isOpen={false}
        onClose={() => {}}
        initialProviders={mockProviders}
      />,
    );
    expect(html).toBe("");
  });

  test("renders open modal with provider cards and configured status", () => {
    const html = renderToStaticMarkup(
      <ApiKeyModal
        isOpen={true}
        onClose={() => {}}
        initialProviders={mockProviders}
      />,
    );

    expect(html).toContain("API Key Management");
    expect(html).toContain("Anthropic");
    expect(html).toContain("Active (sk-ant-...49f1)");
    expect(html).toContain("OpenAI");
    expect(html).toContain("Not Configured");
    expect(html).toContain('data-testid="test-btn-anthropic"');
    expect(html).toContain('data-testid="save-btn-anthropic"');
    expect(html).toContain('data-testid="remove-btn-anthropic"');
    // OpenAI not configured, remove button should not be rendered
    expect(html).not.toContain('data-testid="remove-btn-openai"');
    // Custom base URL input only on supported provider
    expect(html).toContain('data-testid="baseurl-input-anthropic"');
    expect(html).not.toContain('data-testid="baseurl-input-openai"');
  });

  test("renders close button and done button controls", () => {
    const html = renderToStaticMarkup(
      <ApiKeyModal
        isOpen={true}
        onClose={() => {}}
        initialProviders={mockProviders}
      />,
    );

    expect(html).toContain('data-testid="api-key-close-btn"');
    expect(html).toContain('data-testid="api-key-modal-done"');
  });
});
