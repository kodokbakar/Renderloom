import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertNoSecrets } from "../security/redact";

export async function atomicWriteFile(
  targetPath: string,
  content: string | Uint8Array,
): Promise<void> {
  const dir = path.dirname(targetPath);
  await mkdir(dir, { recursive: true });

  const filename = path.basename(targetPath);
  const tempPath = path.join(dir, `.${filename}.${randomUUID()}.tmp`);

  try {
    await writeFile(tempPath, content);
    await rename(tempPath, targetPath);
  } catch (err) {
    if (existsSync(tempPath)) {
      try {
        await unlink(tempPath);
      } catch {
        // Ignore secondary unlink failure
      }
    }
    throw err;
  }
}

export async function atomicWriteJson(
  targetPath: string,
  data: unknown,
): Promise<void> {
  assertNoSecrets(data, path.basename(targetPath));
  const serialized = JSON.stringify(data, null, 2);
  await atomicWriteFile(targetPath, serialized);
}

export async function cleanupOrphanedTempFiles(dir: string): Promise<number> {
  if (!existsSync(dir)) {
    return 0;
  }

  let cleaned = 0;
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });

  for (const entry of entries) {
    if (
      entry.isFile() &&
      entry.name.startsWith(".") &&
      entry.name.endsWith(".tmp")
    ) {
      const parentDir = entry.parentPath ?? dir;
      const fullPath = path.join(parentDir, entry.name);
      try {
        await unlink(fullPath);
        cleaned++;
      } catch {
        // Ignore unlinking failures on inaccessible temp files
      }
    }
  }

  return cleaned;
}
