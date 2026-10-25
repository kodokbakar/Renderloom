import { describe, expect, test } from "bun:test";
import {
  MAX_CANDIDATE_COUNT,
  MIN_CANDIDATE_COUNT,
} from "../../src/domain/dimensions";
import { ValidationError } from "../../src/domain/errors";
import { getStorySlideDefinition } from "../../src/domain/prompt";
import {
  buildStoryModeInstructions,
  composePrompt,
} from "../../src/prompts/composer";
import { buildOutputContractInstructions } from "../../src/prompts/contract";

describe("Story Mode Domain & Prompt Composition", () => {
  describe("getStorySlideDefinition", () => {
    test("single slide (N=1) resolves to Hook with self-contained narrative goal", () => {
      const slide = getStorySlideDefinition(1, 1);
      expect(slide.role).toBe("hook");
      expect(slide.roleName).toBe("Hook");
      expect(slide.index).toBe(1);
      expect(slide.totalSlides).toBe(1);
      expect(slide.narrativeGoal).toContain("primary subject");
    });

    test("two slides (N=2) resolve to Hook (1) and Payoff (2)", () => {
      const slide1 = getStorySlideDefinition(1, 2);
      expect(slide1.role).toBe("hook");
      expect(slide1.roleName).toBe("Hook");
      expect(slide1.index).toBe(1);

      const slide2 = getStorySlideDefinition(2, 2);
      expect(slide2.role).toBe("payoff");
      expect(slide2.roleName).toBe("Payoff");
      expect(slide2.index).toBe(2);
    });

    test("three slides (N=3) resolve to Hook -> Core -> Payoff", () => {
      const s1 = getStorySlideDefinition(1, 3);
      const s2 = getStorySlideDefinition(2, 3);
      const s3 = getStorySlideDefinition(3, 3);

      expect(s1.role).toBe("hook");
      expect(s2.role).toBe("core");
      expect(s3.role).toBe("payoff");
    });

    test("multi-slide progression (N=5) resolves to Hook -> Core x 3 -> Payoff", () => {
      const roles = [1, 2, 3, 4, 5].map(
        (i) => getStorySlideDefinition(i, 5).role,
      );
      expect(roles).toEqual(["hook", "core", "core", "core", "payoff"]);
    });

    test("four slides (N=4) progression has two Core slides with proper goals", () => {
      const s1 = getStorySlideDefinition(1, 4);
      const s2 = getStorySlideDefinition(2, 4);
      const s3 = getStorySlideDefinition(3, 4);
      const s4 = getStorySlideDefinition(4, 4);

      expect(s1.role).toBe("hook");
      expect(s2.role).toBe("core");
      expect(s2.narrativeGoal).toContain("slide 2 of 4");
      expect(s3.role).toBe("core");
      expect(s3.narrativeGoal).toContain("slide 3 of 4");
      expect(s4.role).toBe("payoff");
    });

    test("ten slides (N=10) boundary check", () => {
      const s1 = getStorySlideDefinition(1, 10);
      const s5 = getStorySlideDefinition(5, 10);
      const s10 = getStorySlideDefinition(10, 10);

      expect(s1.role).toBe("hook");
      expect(s5.role).toBe("core");
      expect(s10.role).toBe("payoff");

      const allRoles = Array.from(
        { length: 10 },
        (_, i) => getStorySlideDefinition(i + 1, 10).role,
      );
      expect(allRoles).toEqual([
        "hook",
        "core",
        "core",
        "core",
        "core",
        "core",
        "core",
        "core",
        "core",
        "payoff",
      ]);
    });

    test("clamps out-of-range index and totalSlides safely", () => {
      const clampedLow = getStorySlideDefinition(0, 0);
      expect(clampedLow.index).toBe(1);
      expect(clampedLow.totalSlides).toBe(1);

      const clampedNegative = getStorySlideDefinition(-5, -10);
      expect(clampedNegative.index).toBe(1);
      expect(clampedNegative.totalSlides).toBe(1);
      expect(clampedNegative.role).toBe("hook");

      const clampedHigh = getStorySlideDefinition(15, 4);
      expect(clampedHigh.index).toBe(4);
      expect(clampedHigh.totalSlides).toBe(4);
      expect(clampedHigh.role).toBe("payoff");
    });
  });

  describe("buildStoryModeInstructions & buildOutputContractInstructions", () => {
    test("buildStoryModeInstructions outputs distinct directives per role", () => {
      const hookInstr = buildStoryModeInstructions(
        getStorySlideDefinition(1, 3),
      );
      expect(hookInstr).toContain("NARRATIVE ARC INSTRUCTIONS");
      expect(hookInstr).toContain("HOOK");
      expect(hookInstr).toContain("Lead with high visual tension");

      const coreInstr = buildStoryModeInstructions(
        getStorySlideDefinition(2, 3),
      );
      expect(coreInstr).toContain("CORE");
      expect(coreInstr).toContain("Present detailed concepts");

      const payoffInstr = buildStoryModeInstructions(
        getStorySlideDefinition(3, 3),
      );
      expect(payoffInstr).toContain("PAYOFF");
      expect(payoffInstr).toContain("Provide resolution, impactful payoff");
    });

    test("buildOutputContractInstructions incorporates slide narrative role when provided", () => {
      const slideHook = getStorySlideDefinition(1, 4);
      const contractHook = buildOutputContractInstructions(1, slideHook);
      expect(contractHook).toContain("Slide 1 of 4 (Hook phase)");
      expect(contractHook).toContain(
        "explicitly reference the narrative role (hook)",
      );

      const slideCore = getStorySlideDefinition(2, 4);
      const contractCore = buildOutputContractInstructions(1, slideCore);
      expect(contractCore).toContain("Slide 2 of 4 (Core phase)");
      expect(contractCore).toContain(
        "explicitly reference the narrative role (core)",
      );

      const slidePayoff = getStorySlideDefinition(4, 4);
      const contractPayoff = buildOutputContractInstructions(1, slidePayoff);
      expect(contractPayoff).toContain("Slide 4 of 4 (Payoff phase)");
      expect(contractPayoff).toContain(
        "explicitly reference the narrative role (payoff)",
      );

      // Default without storySlide
      const contractDefault = buildOutputContractInstructions(3);
      expect(contractDefault).toContain(
        "Each candidate must represent a distinct visual exploration",
      );
    });
  });

  describe("composePrompt with Story Mode and Custom Count", () => {
    test("composes prompt with storyMode enabled and metadata populated", async () => {
      const slide = getStorySlideDefinition(2, 4);
      const composed = await composePrompt({
        prompt: "A dynamic tech product launch overview",
        styleId: "swiss",
        candidateCount: 4,
        storyMode: true,
        storySlide: slide,
      });

      expect(composed.metadata.storyMode).toBe(true);
      expect(composed.metadata.storySlide).toBeDefined();
      expect(composed.metadata.storySlide?.role).toBe("core");
      expect(composed.metadata.storySlide?.index).toBe(2);

      // System prompt injection
      expect(composed.systemPrompt).toContain(
        "STORY MODE: NARRATIVE ARC INSTRUCTIONS",
      );
      expect(composed.systemPrompt).toContain("CORE (core)");
      expect(composed.systemPrompt).toContain("Slide 2 of 4");

      // User prompt injection
      expect(composed.userPrompt).toContain(
        "Story Mode: Active (Core - Slide 2/4)",
      );
      expect(composed.userPrompt).toContain(
        "Slide Narrative Role: Core (core)",
      );
      expect(composed.userPrompt).toContain(
        "A dynamic tech product launch overview",
      );
    });

    test("defaults storySlide to Slide 1 (Hook) if not explicitly provided", async () => {
      const composed = await composePrompt({
        prompt: "Future of AI narrative",
        styleId: "editorial",
        candidateCount: 3,
        storyMode: true,
      });

      expect(composed.metadata.storyMode).toBe(true);
      expect(composed.metadata.storySlide?.role).toBe("hook");
      expect(composed.metadata.storySlide?.index).toBe(1);
      expect(composed.systemPrompt).toContain("HOOK");
    });

    test("accepts custom candidate count up to MAX_CANDIDATE_COUNT (10)", async () => {
      const composed = await composePrompt({
        prompt: "10-slide architectural retrospective",
        styleId: "minimal",
        candidateCount: 10,
      });

      expect(composed.metadata.candidateCount).toBe(10);
      expect(composed.userPrompt).toContain("Candidate Count: 10");
    });

    test("accepts boundary candidate counts in story mode (N=1 and N=10)", async () => {
      // N=1
      const comp1 = await composePrompt({
        prompt: "Single slide story",
        styleId: "swiss",
        candidateCount: 1,
        storyMode: true,
      });
      expect(comp1.metadata.candidateCount).toBe(1);
      expect(comp1.metadata.storySlide?.role).toBe("hook");
      expect(comp1.metadata.storySlide?.totalSlides).toBe(1);

      // N=10 Payoff slide
      const slide10 = getStorySlideDefinition(10, 10);
      const comp10 = await composePrompt({
        prompt: "10-slide architectural retrospective",
        styleId: "minimal",
        candidateCount: 10,
        storyMode: true,
        storySlide: slide10,
      });
      expect(comp10.metadata.candidateCount).toBe(10);
      expect(comp10.metadata.storySlide?.role).toBe("payoff");
      expect(comp10.systemPrompt).toContain("PAYOFF");
      expect(comp10.userPrompt).toContain(
        "Story Mode: Active (Payoff - Slide 10/10)",
      );
    });

    test("rejects candidate count below MIN_CANDIDATE_COUNT or above MAX_CANDIDATE_COUNT", async () => {
      expect(
        composePrompt({
          prompt: "Out of bounds count",
          styleId: "minimal",
          candidateCount: 0,
        }),
      ).rejects.toThrow(ValidationError);

      expect(
        composePrompt({
          prompt: "Out of bounds count",
          styleId: "minimal",
          candidateCount: -1,
        }),
      ).rejects.toThrow(ValidationError);

      expect(
        composePrompt({
          prompt: "Out of bounds count",
          styleId: "minimal",
          candidateCount: 11,
        }),
      ).rejects.toThrow(ValidationError);
    });
  });
});
