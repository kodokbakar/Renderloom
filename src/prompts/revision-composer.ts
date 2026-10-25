import {
  type AspectRatioPreset,
  MAX_PROMPT_LENGTH,
  type ResolvedDimensions,
} from "../domain/dimensions";
import { ValidationError } from "../domain/errors";
import type { ConversationMessage } from "../domain/session";
import { resolveDimensions } from "../styles/dimensions";
import { StyleRegistry } from "../styles/registry";
import { buildOutputContractInstructions } from "./contract";
import { loadBasePrompt } from "./loader";
import { buildTechnicalConstraints } from "./technical-constraints";

export interface ComposeRevisionPromptOptions {
  candidateId: string;
  currentJsx: string;
  revisionPrompt: string;
  styleId: string;
  width?: number;
  height?: number;
  aspectRatio?: AspectRatioPreset;
  parentVersionId?: string;
  conversationMessages?: ConversationMessage[];
  basePromptOverride?: string;
  customBasePromptPath?: string;
}

export interface PromptRevisionComposerDependencies {
  styleRegistry?: StyleRegistry;
}

export interface ComposedRevisionPrompt {
  systemPrompt: string;
  userPrompt: string;
  effectivePrompt: string;
  metadata: {
    candidateId: string;
    parentVersionId?: string;
    styleId: string;
    dimensions: ResolvedDimensions;
  };
}

export async function composeRevisionPrompt(
  options: ComposeRevisionPromptOptions,
  dependencies: PromptRevisionComposerDependencies = {},
): Promise<ComposedRevisionPrompt> {
  if (!options || typeof options !== "object") {
    throw new ValidationError("composeRevisionPrompt requires options object");
  }

  const candidateId = options.candidateId?.trim();
  if (!candidateId) {
    throw new ValidationError("candidateId is required");
  }

  const trimmedJsx = options.currentJsx?.trim();
  if (!trimmedJsx) {
    throw new ValidationError("currentJsx cannot be empty");
  }

  const trimmedPrompt = options.revisionPrompt?.trim();
  if (!trimmedPrompt) {
    throw new ValidationError("Revision prompt cannot be empty");
  }

  if (trimmedPrompt.length > MAX_PROMPT_LENGTH) {
    throw new ValidationError(
      `Revision prompt length (${trimmedPrompt.length}) exceeds maximum allowed of ${MAX_PROMPT_LENGTH} characters`,
    );
  }

  if (!options.styleId || typeof options.styleId !== "string") {
    throw new ValidationError("styleId is required");
  }

  const dimensions = resolveDimensions({
    aspectRatio: options.aspectRatio,
    width: options.width,
    height: options.height,
  });

  const registry = dependencies.styleRegistry ?? new StyleRegistry();
  const stylePreset = await registry.getPreset(options.styleId);
  const styleInstructions = await registry.formatStyleInstructions(
    options.styleId,
  );

  const basePrompt =
    options.basePromptOverride ??
    (await loadBasePrompt(options.customBasePromptPath));

  const technicalConstraints = buildTechnicalConstraints(dimensions);
  // Revisions always target a single candidate envelope
  const outputContract = buildOutputContractInstructions(1);

  const systemPrompt = [
    basePrompt,
    technicalConstraints,
    styleInstructions,
    outputContract,
  ].join("\n\n---\n\n");

  // Keep conversation context bounded (at most 4 most recent messages relevant to this candidate or general)
  let conversationBlock = "";
  if (options.conversationMessages && options.conversationMessages.length > 0) {
    const relevant = options.conversationMessages
      .filter((m) => !m.candidateId || m.candidateId === candidateId)
      .slice(-4);

    if (relevant.length > 0) {
      const formatted = relevant
        .map((m) => {
          const roleLabel =
            m.role === "user"
              ? "User"
              : m.role === "assistant"
                ? "Assistant"
                : "System";
          const snippet =
            m.content.length > 300
              ? `${m.content.slice(0, 300)}...`
              : m.content;
          return `${roleLabel}: ${snippet}`;
        })
        .join("\n");
      conversationBlock = `### RELEVANT CONVERSATION CONTEXT:\n${formatted}`;
    }
  }

  const userPromptParts = [
    "### USER REVISION REQUEST",
    `Target Dimensions: ${dimensions.width}px x ${dimensions.height}px (${dimensions.aspectRatio})`,
    `Requested Style: ${stylePreset.name} (${stylePreset.id})`,
    `Target Candidate: ${candidateId}${options.parentVersionId ? ` (Parent Version: ${options.parentVersionId})` : ""}`,
    "",
    "### CURRENT CANDIDATE JSX:",
    "```jsx",
    trimmedJsx,
    "```",
  ];

  if (conversationBlock) {
    userPromptParts.push("", conversationBlock);
  }

  userPromptParts.push(
    "",
    "### REVISION DIRECTIVE HIERARCHY (Apply in strict priority order):",
    "Level 1: Content & Text Replacement",
    "- Execute all requested text replacements, copy updates, title edits, labels, and content changes accurately and completely.",
    "- Ensure updated text fits cleanly into container dimensions without clipping or unformatted overflow.",
    "",
    "Level 2: Structural & Layout Restructuring",
    "- Restructure containers, flex directions, alignments, section order, or visual hierarchy when requested by the revision.",
    "- Preserve explicit flex container properties (display: 'flex', flexDirection, alignItems, justifyContent, gap, padding).",
    "",
    "Level 3: Styling & Aesthetic Adjustments",
    "- Apply requested modifications to color palette, backgrounds, typography sizing, font weights, borders, or decorative accents.",
    `- Maintain consistency with the active style preset (${stylePreset.name}) and all technical constraints.`,
    "",
    "Level 4: Preservation of Unmodified Elements",
    "- Strictly preserve all existing layout structures, elements, styling, and text copy that are NOT targeted by the revision request.",
    "- Do NOT arbitrarily redesign, drop, or rewrite working sections of the current JSX unless directly required by higher-level directives.",
    "",
    "### REVISION INSTRUCTIONS:",
    "Modify the current JSX above according to the following user directive while adhering to the 4-level hierarchy, technical constraints, styling rules, and dimensions:",
    trimmedPrompt,
  );

  const userPrompt = userPromptParts.join("\n");
  const effectivePrompt = `${systemPrompt}\n\n===\n\n${userPrompt}`;

  return {
    systemPrompt,
    userPrompt,
    effectivePrompt,
    metadata: {
      candidateId,
      parentVersionId: options.parentVersionId,
      styleId: options.styleId,
      dimensions,
    },
  };
}
