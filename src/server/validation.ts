import { z } from "zod";
import { ValidationError } from "../domain/errors";
import type {
  CreateSessionRequest,
  GenerationRequest,
} from "../domain/request";

export const GenerationRequestSchema = z.object({
  sessionId: z.string().min(1, "sessionId is required"),
  prompt: z.string().min(1, "prompt is required"),
  styleId: z.string().min(1, "styleId is required"),
  candidateCount: z.number().int().min(1).max(10),
  width: z.number().int().min(64).max(4096),
  height: z.number().int().min(64).max(4096),
  outputFormat: z.literal("png"),
  providerId: z.string().min(1, "providerId is required"),
  modelId: z.string().min(1, "modelId is required"),
});

export const CreateSessionRequestSchema = z.object({
  name: z.string().min(1).max(100),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  styleId: z.string().min(1),
  width: z.number().int().min(64).max(4096),
  height: z.number().int().min(64).max(4096),
  initialPrompt: z.string().optional(),
});

export const RenameSessionRequestSchema = z.object({
  name: z.string().min(1, "name is required").max(100),
});

export const ArtifactParamsSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["images", "source", "svg", "assets"]),
  filename: z.string().min(1),
});

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
