import { z } from "zod";
import {
  MAX_CANDIDATE_COUNT,
  MAX_DIMENSION,
  MAX_PIXELS,
  MAX_PROMPT_LENGTH,
  MIN_CANDIDATE_COUNT,
  MIN_DIMENSION,
} from "../domain/dimensions";
import { ValidationError } from "../domain/errors";
import type {
  ComposePromptRequest,
  CreateSessionRequest,
  GenerationRequest,
  ResolveDimensionsRequest,
} from "../domain/request";

export const AspectRatioEnum = z.enum(["1:1", "4:5", "3:2", "16:9", "custom"]);

export const GenerationRequestSchema = z
  .object({
    sessionId: z.string().min(1, "sessionId is required"),
    prompt: z
      .string()
      .min(1, "prompt is required")
      .max(
        MAX_PROMPT_LENGTH,
        `prompt cannot exceed ${MAX_PROMPT_LENGTH} characters`,
      ),
    styleId: z.string().min(1, "styleId is required"),
    candidateCount: z
      .number()
      .int()
      .min(
        MIN_CANDIDATE_COUNT,
        `candidateCount must be between ${MIN_CANDIDATE_COUNT} and ${MAX_CANDIDATE_COUNT}`,
      )
      .max(
        MAX_CANDIDATE_COUNT,
        `candidateCount must be between ${MIN_CANDIDATE_COUNT} and ${MAX_CANDIDATE_COUNT}`,
      ),
    width: z
      .number()
      .int()
      .min(MIN_DIMENSION, `width must be at least ${MIN_DIMENSION}`)
      .max(MAX_DIMENSION, `width cannot exceed ${MAX_DIMENSION}`),
    height: z
      .number()
      .int()
      .min(MIN_DIMENSION, `height must be at least ${MIN_DIMENSION}`)
      .max(MAX_DIMENSION, `height cannot exceed ${MAX_DIMENSION}`),
    aspectRatio: AspectRatioEnum.optional(),
    outputFormat: z.literal("png"),
    providerId: z.string().min(1, "providerId is required"),
    modelId: z.string().min(1, "modelId is required"),
    storyMode: z.boolean().optional(),
  })
  .refine((data) => data.width * data.height <= MAX_PIXELS, {
    message: `Total pixels (${MAX_PIXELS}) exceeded`,
  });

export const CreateSessionRequestSchema = z
  .object({
    name: z.string().min(1).max(100),
    providerId: z.string().min(1),
    modelId: z.string().min(1),
    styleId: z.string().min(1),
    width: z.number().int().min(MIN_DIMENSION).max(MAX_DIMENSION),
    height: z.number().int().min(MIN_DIMENSION).max(MAX_DIMENSION),
    aspectRatio: AspectRatioEnum.optional(),
    initialPrompt: z.string().max(MAX_PROMPT_LENGTH).optional(),
    storyMode: z.boolean().optional(),
  })
  .refine((data) => data.width * data.height <= MAX_PIXELS, {
    message: `Total pixels (${MAX_PIXELS}) exceeded`,
  });

export const RenameSessionRequestSchema = z.object({
  name: z.string().min(1, "name is required").max(100),
});

export const UpdateSessionRequestSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "name cannot be empty")
      .max(100, "name exceeds maximum length of 100 characters")
      .optional(),
    providerId: z
      .string()
      .trim()
      .min(1, "providerId cannot be empty")
      .optional(),
    modelId: z.string().trim().min(1, "modelId cannot be empty").optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.providerId !== undefined ||
      data.modelId !== undefined,
    {
      message:
        "At least one field (name, providerId, modelId) must be provided",
    },
  );

export type UpdateSessionRequest = z.infer<typeof UpdateSessionRequestSchema>;

export const ArtifactParamsSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["images", "source", "svg", "assets"]),
  filename: z.string().min(1),
});

export const SetKeyRequestSchema = z
  .object({
    providerId: z.string().min(1, "providerId is required"),
    apiKey: z.string().optional(),
    baseUrl: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const isCustom = data.providerId.toLowerCase() === "custom";
    if (!isCustom && (!data.apiKey || data.apiKey.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["apiKey"],
        message: "apiKey is required",
      });
    }
  });
export type SetKeyRequest = z.infer<typeof SetKeyRequestSchema>;

export const TestConnectionRequestSchema = z.object({
  providerId: z.string().min(1, "providerId is required"),
  modelId: z.string().min(1, "modelId is required"),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});
export type TestConnectionRequest = z.infer<typeof TestConnectionRequestSchema>;
export const ReviseCandidateRequestSchema = z.object({
  prompt: z.string().trim().min(1, "prompt is required").max(MAX_PROMPT_LENGTH),
  parentVersionId: z.string().optional(),
  providerId: z.string().optional(),
  modelId: z.string().optional(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
});
export type ReviseCandidateRequest = z.infer<
  typeof ReviseCandidateRequestSchema
>;

export const ResolveDimensionsSchema = z
  .object({
    aspectRatio: AspectRatioEnum.optional(),
    width: z.number().int().min(MIN_DIMENSION).max(MAX_DIMENSION).optional(),
    height: z.number().int().min(MIN_DIMENSION).max(MAX_DIMENSION).optional(),
  })
  .refine(
    (data) => {
      if (data.width && data.height) {
        return data.width * data.height <= MAX_PIXELS;
      }
      return true;
    },
    { message: `Total pixels cannot exceed ${MAX_PIXELS}` },
  );

export const ComposePromptSchema = z
  .object({
    prompt: z
      .string()
      .min(1, "prompt is required")
      .max(
        MAX_PROMPT_LENGTH,
        `prompt cannot exceed ${MAX_PROMPT_LENGTH} characters`,
      ),
    styleId: z.string().min(1, "styleId is required"),
    candidateCount: z
      .number()
      .int()
      .min(MIN_CANDIDATE_COUNT)
      .max(MAX_CANDIDATE_COUNT)
      .optional(),
    aspectRatio: AspectRatioEnum.optional(),
    width: z.number().int().min(MIN_DIMENSION).max(MAX_DIMENSION).optional(),
    height: z.number().int().min(MIN_DIMENSION).max(MAX_DIMENSION).optional(),
    storyMode: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.width && data.height) {
        return data.width * data.height <= MAX_PIXELS;
      }
      return true;
    },
    { message: `Total pixels cannot exceed ${MAX_PIXELS}` },
  );

export function validateGenerationRequest(input: unknown): GenerationRequest {
  const result = GenerationRequestSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      "Invalid generation request",
      result.error.format(),
    );
  }
  return result.data;
}

export function validateCreateSessionRequest(
  input: unknown,
): CreateSessionRequest {
  const result = CreateSessionRequestSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      "Invalid session creation request",
      result.error.format(),
    );
  }
  return result.data;
}

export function validateRenameSessionRequest(input: unknown): { name: string } {
  const result = RenameSessionRequestSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      "Invalid session rename request",
      result.error.format(),
    );
  }
  return result.data;
}

export function validateUpdateSessionRequest(
  input: unknown,
): UpdateSessionRequest {
  const result = UpdateSessionRequestSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      "Invalid session update request",
      result.error.format(),
    );
  }
  return result.data;
}

export function validateSetKeyRequest(input: unknown): SetKeyRequest {
  const result = SetKeyRequestSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Invalid set key request", result.error.format());
  }
  return result.data;
}

export function validateTestConnectionRequest(
  input: unknown,
): TestConnectionRequest {
  const result = TestConnectionRequestSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      "Invalid test connection request",
      result.error.format(),
    );
  }
  return result.data;
}

export function validateResolveDimensionsRequest(
  input: unknown,
): ResolveDimensionsRequest {
  const result = ResolveDimensionsSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join(", ");
    throw new ValidationError(
      `Invalid dimensions resolution request: ${issues}`,
      result.error.format(),
    );
  }
  return result.data;
}

export function validateComposePromptRequest(
  input: unknown,
): ComposePromptRequest {
  const result = ComposePromptSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join(", ");
    throw new ValidationError(
      `Invalid prompt compose request: ${issues}`,
      result.error.format(),
    );
  }
  return result.data;
}

export function validateReviseCandidateRequest(
  input: unknown,
): ReviseCandidateRequest {
  const result = ReviseCandidateRequestSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.map((i) => i.message).join(", ");
    throw new ValidationError(
      `Invalid revise candidate request: ${issues}`,
      result.error.format(),
    );
  }
  return result.data;
}
