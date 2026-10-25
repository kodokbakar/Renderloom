import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_BASE_PROMPT = `You are an expert graphic designer and visual engineer producing clean, static JSX compositions for Satori rendering.
Output only valid JSX elements adhering strictly to supported inline styling:
- Root element must be a <div> with explicit width and height in pixels matching requested dimensions, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative', overflow: 'hidden'.
- Use flexbox layout only (display: 'flex'). Center layouts using alignItems: 'center' and justifyContent: 'center' avoiding arbitrary absolute pixel offsets.
- Always use boxSizing: 'border-box' on containers to prevent padding from expanding containers beyond canvas size.
- Prevent multi-line text and paragraph overflow using wordBreak: 'break-word' and containment bounds.
- Use standard CSS color hex codes or rgb values.
- Do not use external scripts, functions, event listeners, or dynamic JavaScript logic.`;

export function resolveBasePromptPath(customPath?: string): string {
  if (customPath) {
    return path.resolve(customPath);
  }
  const cwdPrompt = path.resolve(process.cwd(), "prompt.txt");
  if (existsSync(cwdPrompt)) {
    return cwdPrompt;
  }
  const moduleRelativePrompt = path.resolve(__dirname, "../../prompt.txt");
  if (existsSync(moduleRelativePrompt)) {
    return moduleRelativePrompt;
  }
  return cwdPrompt;
}

export async function loadBasePrompt(customPath?: string): Promise<string> {
  const filePath = resolveBasePromptPath(customPath);
  if (existsSync(filePath)) {
    try {
      const content = await readFile(filePath, "utf-8");
      return content.trim();
    } catch {
      return DEFAULT_BASE_PROMPT;
    }
  }
  return DEFAULT_BASE_PROMPT;
}

export async function snapshotPrompt(customPath?: string): Promise<string> {
  return await loadBasePrompt(customPath);
}
