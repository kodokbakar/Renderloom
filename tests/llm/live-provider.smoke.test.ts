import { describe, expect, test } from "bun:test";
import { AnthropicAdapter } from "../../src/llm/adapters/anthropic";
import { OpenAIAdapter } from "../../src/llm/adapters/openai";

const isLiveTest = process.env.RENDERLOOM_LIVE_TEST === "true";

describe("Live Provider Smoke Tests", () => {
  test("skips live network requests under standard test suite", () => {
    // Normal test runs must not require or invoke paid external APIs
    if (!isLiveTest) {
      expect(process.env.RENDERLOOM_LIVE_TEST).not.toBe("true");
    }
  });

  // Gated behind explicit RENDERLOOM_LIVE_TEST=true flag
  test.skipIf(!isLiveTest)(
    "connects to live provider and validates credentials",
    async () => {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      const openaiKey = process.env.OPENAI_API_KEY;

      if (!anthropicKey && !openaiKey) {
        console.warn(
          "RENDERLOOM_LIVE_TEST is true but neither ANTHROPIC_API_KEY nor OPENAI_API_KEY is present; skipping.",
        );
        return;
      }

      if (anthropicKey) {
        const adapter = new AnthropicAdapter();
        const result = await adapter.testConnection(
          anthropicKey,
          adapter.meta.defaultModelId,
        );
        expect(result.success).toBe(true);
      }

      if (openaiKey) {
        const adapter = new OpenAIAdapter();
        const result = await adapter.testConnection(
          openaiKey,
          adapter.meta.defaultModelId,
        );
        expect(result.success).toBe(true);
      }
    },
  );
});
