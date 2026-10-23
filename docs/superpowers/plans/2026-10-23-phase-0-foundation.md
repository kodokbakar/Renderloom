# Phase 0 — Repository Foundation and Product Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a verified Bun + TypeScript project foundation, strict configuration, modular architecture, core data contracts, runtime API validation, starter frontend scaffold, and documentation according to Phase 0 of `ROADMAP.md`.

**Architecture:** Lightweight Bun-native application with modular domain boundaries (`domain`, `server`, `renderer`, `llm`, `prompts`, `sessions`, `jobs`, `security`, `shared`, `app`). The local server uses Bun's HTTP engine with schema-validated endpoints; the frontend uses Vite + React with TypeScript. No API keys or session data are required to boot.

**Tech Stack:** Bun >= 1.0, TypeScript (strict), React 18/19, Vite, Biome (`@biomejs/biome`), Zod, Bun Test.

**Spec:** `ROADMAP.md` (specifically Section 1.3, Section 2, Section 3, Section 4, and Phase 0).

---

## Global Constraints

- **Runtime & Package Manager:** Bun only (`bun install`, `bun test`, `bun run <script>`).
- **Language:** TypeScript with strict type checking enabled (`strict: true`, `noUncheckedIndexedAccess: true`).
- **No Credentials at Boot:** The application must boot and pass tests without external network access or API keys.
- **Persistence Boundary:** All user session output must live strictly under `Outputs/<session-name>/`; never write outside.
- **Git Worktree Isolation:** Follow `AGENTS.md` §3 and §4. Code edits must occur in dedicated feature worktrees (`feat/<ID>`), not directly on `master`.
- **Commit Format:** `<type>(<scope>): <summary> [<ID>]` (e.g. `feat(core): initialize project configuration [phase-0]`).

---

## Worktree Setup & Git Prerequisite

Because the repository currently has no commits, git worktrees cannot be branched until an initial commit exists on `master`.

- [ ] **Prerequisite Step 1: Create initial commit on `master`**
```bash
git add AGENTS.md ROADMAP.md
git commit -m "chore(repo): initialize repository with AGENTS.md and ROADMAP.md [phase-0]"
```

- [ ] **Prerequisite Step 2: Create feature worktree**
```bash
git worktree add -b feat/phase-0-foundation ../Renderloom-wt/phase-0-foundation master
cd ../Renderloom-wt/phase-0-foundation
```

All subsequent tasks execute inside the worktree directory `../Renderloom-wt/phase-0-foundation`.

---

## Task Decomposition

### Task 1: Repository Tooling & Environment Configuration

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `biome.json`
- Test: `tests/config.test.ts`

**Interfaces:**
- Consumes: None
- Produces: Bun project scripts (`bun test`, `bun run build`, `bun run lint`, `bun run typecheck`)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/config.test.ts
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

describe("Project Configuration", () => {
  test("essential configuration files exist", () => {
    expect(existsSync("package.json")).toBe(true);
    expect(existsSync("tsconfig.json")).toBe(true);
    expect(existsSync("biome.json")).toBe(true);
    expect(existsSync(".gitignore")).toBe(true);
  });

  test(".gitignore includes secret and output paths", () => {
    const gitignore = readFileSync(".gitignore", "utf-8");
    expect(gitignore).toContain("node_modules");
    expect(gitignore).toContain(".env");
    expect(gitignore).toContain("Outputs/");
    expect(gitignore).toContain("dist/");
  });

  test("package.json defines required scripts", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
    expect(pkg.scripts.test).toBe("bun test");
    expect(pkg.scripts.typecheck).toBeDefined();
    expect(pkg.scripts.lint).toBeDefined();
    expect(pkg.scripts.build).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/config.test.ts`  
Expected: FAIL with missing configuration files.

- [ ] **Step 3: Write minimal implementation**

Create `.gitignore`:
```gitignore
# Dependencies
node_modules/
bun.lockb
bun.lock

# Build Outputs
dist/
build/
.cache/

# Local Environment & Secrets
.env
.env.*
!.env.example

# Runtime & User Outputs
Outputs/
*.log

# Editor & System
.DS_Store
*.swp
```

Create `package.json`:
```json
{
  "name": "renderloom",
  "version": "0.1.0",
  "description": "Local-first, code-first AI image design studio",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun run --watch src/server/index.ts",
    "build": "vite build",
    "start": "bun run src/server/index.ts",
    "test": "bun test",
    "lint": "biome check src tests",
    "format": "biome format --write src tests",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@types/bun": "latest",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.3",
    "vite": "^6.2.0"
  }
}
```

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "types": ["bun-types"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

Create `biome.json`:
```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
```

Run dependency installation:
```bash
bun install
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/config.test.ts`  
Expected: PASS (all 3 assertions pass).

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json tsconfig.json biome.json bun.lock tests/config.test.ts
git commit -m "chore(config): add project tooling and configuration [phase-0]"
```

---

### Task 2: Project Documents & Default System Prompt

**Files:**
- Create: `LOG.md`
- Create: `README.md`
- Create: `prompt.txt`
- Test: `tests/docs.test.ts`

**Interfaces:**
- Consumes: None
- Produces: Project documentation and system base prompt (`prompt.txt`)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/docs.test.ts
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

describe("Baseline Documentation & Default Prompt", () => {
  test("documentation files exist and are populated", () => {
    expect(existsSync("LOG.md")).toBe(true);
    expect(existsSync("README.md")).toBe(true);
    expect(existsSync("prompt.txt")).toBe(true);

    const log = readFileSync("LOG.md", "utf-8");
    expect(log).toContain("# Renderloom Implementation Log");

    const readme = readFileSync("README.md", "utf-8");
    expect(readme).toContain("# Renderloom");
    expect(readme).toContain("bun install");

    const prompt = readFileSync("prompt.txt", "utf-8");
    expect(prompt.length).toBeGreaterThan(50);
    expect(prompt).toContain("JSX");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/docs.test.ts`  
Expected: FAIL (`LOG.md` or `prompt.txt` not found).

- [ ] **Step 3: Write minimal implementation**

Create `LOG.md`:
```markdown
# Renderloom Implementation Log

## Decisions and Deviations

### Phase 0: Repository Foundation and Product Contracts
- Initialized project with Bun, TypeScript (strict), Vite + React, and Biome.
- Documented data contracts for Session, Candidate, Version, and GenerationRequest.
- Separated local API and request validation boundaries from UI.
```

Create `README.md`:
```markdown
# Renderloom

Local-first, code-first AI image design studio.

## Prerequisites
- [Bun](https://bun.sh) (v1.0 or higher)

## Getting Started
```bash
# Install dependencies
bun install

# Run type check
bun run typecheck

# Run test suite
bun test

# Start development server
bun run dev
```

## Architecture
See `ROADMAP.md` for project architecture, phases, and design principles.
```

Create `prompt.txt`:
```text
You are an expert graphic designer and visual engineer producing clean, static JSX compositions for Satori rendering.
Output only valid JSX elements adhering strictly to supported inline styling:
- Root element must be a <div> with explicit width and height in pixels matching requested dimensions.
- Use flexbox layout only. Do not use grid or absolute positioning without explicit parent bounds.
- Use standard CSS color hex codes or rgb values.
- Do not use external scripts, functions, event listeners, or dynamic JavaScript logic.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/docs.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add LOG.md README.md prompt.txt tests/docs.test.ts
git commit -m "docs(core): add LOG.md, README.md, and default prompt.txt [phase-0]"
```

---

### Task 3: Versioned Domain Interfaces & Core Data Contracts

**Files:**
- Create: `src/domain/session.ts`
- Create: `src/domain/candidate.ts`
- Create: `src/domain/version.ts`
- Create: `src/domain/request.ts`
- Create: `src/domain/errors.ts`
- Create: `src/domain/index.ts`
- Test: `tests/domain/contracts.test.ts`

**Interfaces:**
- Consumes: None
- Produces: TypeScript domain types (`Session`, `Candidate`, `Version`, `GenerationRequest`, `CandidateState`, `RenderloomError`)

- [ ] **Step 1: Write the failing test**

```typescript
// tests/domain/contracts.test.ts
import { describe, expect, test } from "bun:test";
import type {
  Candidate,
  CandidateState,
  GenerationRequest,
  RenderloomError,
  Session,
  Version,
} from "../../src/domain";

describe("Domain Contracts", () => {
  test("candidate lifecycle states are valid", () => {
    const states: CandidateState[] = [
      "queued",
      "generating",
      "validating",
      "rendering",
      "completed",
      "failed",
      "cancelled",
    ];
    expect(states.length).toBe(7);
  });

  test("generation request type structure is sound", () => {
    const request: GenerationRequest = {
      sessionId: "sess-01",
      prompt: "minimalist poster",
      styleId: "bauhaus",
      candidateCount: 4,
      width: 1080,
      height: 1080,
      outputFormat: "png",
      providerId: "openai",
      modelId: "gpt-4o",
    };
    expect(request.candidateCount).toBe(4);
    expect(request.outputFormat).toBe("png");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/domain/contracts.test.ts`  
Expected: FAIL (module `../../src/domain` not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/session.ts`:
```typescript
export interface Session {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  providerId: string;
  modelId: string;
  styleId: string;
  dimensions: {
    width: number;
    height: number;
  };
}
```

Create `src/domain/candidate.ts`:
```typescript
export type CandidateState =
  | "queued"
  | "generating"
  | "validating"
  | "rendering"
  | "completed"
  | "failed"
  | "cancelled";

export interface Candidate {
  id: string;
  sessionId: string;
  index: number;
  state: CandidateState;
  currentVersionId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}
```

Create `src/domain/version.ts`:
```typescript
export interface Version {
  id: string;
  candidateId: string;
  versionNumber: number;
  parentVersionId?: string;
  promptSnapshot: string;
  jsxSourcePath: string;
  svgPath: string;
  pngPath: string;
  createdAt: string;
}
```

Create `src/domain/request.ts`:
```typescript
export interface GenerationRequest {
  sessionId: string;
  prompt: string;
  styleId: string;
  candidateCount: number;
  width: number;
  height: number;
  outputFormat: "png";
  providerId: string;
  modelId: string;
}

export interface CreateSessionRequest {
  name: string;
  providerId: string;
  modelId: string;
  styleId: string;
  width: number;
  height: number;
}
```

Create `src/domain/errors.ts`:
```typescript
export interface RenderloomError {
  code: string;
  message: string;
  details?: unknown;
}

export class ValidationError extends Error {
  readonly code = "VALIDATION_ERROR";
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = "ValidationError";
  }
}
```

Create `src/domain/index.ts`:
```typescript
export * from "./session";
export * from "./candidate";
export * from "./version";
export * from "./request";
export * from "./errors";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/domain/contracts.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/ tests/domain/contracts.test.ts
git commit -m "feat(domain): define versioned core data contracts and domain types [phase-0]"
```

---

### Task 4: Runtime Validation for API Requests

**Files:**
- Create: `src/server/validation.ts`
- Test: `tests/server/validation.test.ts`

**Interfaces:**
- Consumes: `src/domain/request.ts`, `src/domain/errors.ts`
- Produces: `validateGenerationRequest(input: unknown): GenerationRequest`, `validateCreateSessionRequest(input: unknown): CreateSessionRequest`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/server/validation.test.ts
import { describe, expect, test } from "bun:test";
import {
  validateCreateSessionRequest,
  validateGenerationRequest,
} from "../../src/server/validation";

describe("API Request Validation", () => {
  test("accepts valid generation request", () => {
    const valid = {
      sessionId: "session-1",
      prompt: "A poster",
      styleId: "bauhaus",
      candidateCount: 2,
      width: 1080,
      height: 1080,
      outputFormat: "png",
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
    };
    const res = validateGenerationRequest(valid);
    expect(res.sessionId).toBe("session-1");
  });

  test("rejects invalid dimensions or candidate counts", () => {
    const invalid = {
      sessionId: "session-1",
      prompt: "A poster",
      styleId: "bauhaus",
      candidateCount: 0, // must be >= 1
      width: -100, // must be > 0
      height: 1080,
      outputFormat: "png",
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
    };
    expect(() => validateGenerationRequest(invalid)).toThrow();
  });

  test("rejects unsupported output formats", () => {
    const invalid = {
      sessionId: "session-1",
      prompt: "A poster",
      styleId: "bauhaus",
      candidateCount: 1,
      width: 800,
      height: 600,
      outputFormat: "jpg",
      providerId: "anthropic",
      modelId: "claude-3-7-sonnet",
    };
    expect(() => validateGenerationRequest(invalid)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/server/validation.test.ts`  
Expected: FAIL (`src/server/validation` not found).

- [ ] **Step 3: Write minimal implementation**

Create `src/server/validation.ts`:
```typescript
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
});

export function validateGenerationRequest(input: unknown): GenerationRequest {
  const result = GenerationRequestSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Invalid generation request", result.error.format());
  }
  return result.data;
}

export function validateCreateSessionRequest(input: unknown): CreateSessionRequest {
  const result = CreateSessionRequestSchema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Invalid session creation request", result.error.format());
  }
  return result.data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/server/validation.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/validation.ts tests/server/validation.test.ts
git commit -m "feat(server): add runtime validation for API requests [phase-0]"
```

---

### Task 5: Modular Source Architecture & Local Bun HTTP Server

**Files:**
- Create: `src/server/server.ts`
- Create: `src/server/index.ts`
- Create placeholders for modular boundaries:
  - `src/renderer/index.ts`
  - `src/llm/index.ts`
  - `src/prompts/index.ts`
  - `src/sessions/index.ts`
  - `src/jobs/index.ts`
  - `src/security/index.ts`
  - `src/shared/index.ts`
- Test: `tests/server/api.test.ts`

**Interfaces:**
- Consumes: `src/server/validation.ts`, `src/domain/`
- Produces: `createServer(port?: number): Server`, entry point `src/server/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/server/api.test.ts
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createServer } from "../../src/server/server";

describe("Local Bun HTTP API", () => {
  const server = createServer(0);

  afterAll(() => {
    server.stop();
  });

  test("GET /api/health returns 200 OK without credentials", async () => {
    const res = await fetch(`http://localhost:${server.port}/api/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.name).toBe("renderloom");
  });

  test("POST /api/validate-generation validates request body", async () => {
    const res = await fetch(
      `http://localhost:${server.port}/api/validate-generation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "test",
          prompt: "test",
          styleId: "bauhaus",
          candidateCount: 2,
          width: 800,
          height: 600,
          outputFormat: "png",
          providerId: "openai",
          modelId: "gpt-4o",
        }),
      }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/server/api.test.ts`  
Expected: FAIL (`src/server/server` not found).

- [ ] **Step 3: Write minimal implementation**

Create module placeholder files:
- `src/renderer/index.ts`: `export const rendererModule = "renderer";`
- `src/llm/index.ts`: `export const llmModule = "llm";`
- `src/prompts/index.ts`: `export const promptsModule = "prompts";`
- `src/sessions/index.ts`: `export const sessionsModule = "sessions";`
- `src/jobs/index.ts`: `export const jobsModule = "jobs";`
- `src/security/index.ts`: `export const securityModule = "security";`
- `src/shared/index.ts`: `export const sharedModule = "shared";`

Create `src/server/server.ts`:
```typescript
import { validateGenerationRequest } from "./validation";

export function createServer(port = 3000) {
  return Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === "GET" && url.pathname === "/api/health") {
        return Response.json({
          status: "ok",
          name: "renderloom",
          version: "0.1.0",
        });
      }

      if (req.method === "POST" && url.pathname === "/api/validate-generation") {
        try {
          const body = await req.json();
          const valid = validateGenerationRequest(body);
          return Response.json({ valid: true, data: valid });
        } catch (err: any) {
          return Response.json(
            { valid: false, error: err.message, details: err.details },
            { status: 400 }
          );
        }
      }

      return new Response("Not Found", { status: 404 });
    },
  });
}
```

Create `src/server/index.ts`:
```typescript
import { createServer } from "./server";

const PORT = Number(process.env.PORT ?? 3000);
const server = createServer(PORT);
console.log(`Renderloom API listening on http://localhost:${server.port}`);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/server/api.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ tests/server/api.test.ts
git commit -m "feat(server): implement local Bun HTTP server and module scaffolding [phase-0]"
```

---

### Task 6: Initial React Frontend Scaffold

**Files:**
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `src/app/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/App.css`
- Test: `tests/app/frontend.test.ts`

**Interfaces:**
- Consumes: React, Vite
- Produces: Client entry point and production bundle via `bun run build`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/app/frontend.test.ts
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

describe("Frontend Scaffold", () => {
  test("Vite and React scaffold files exist", () => {
    expect(existsSync("index.html")).toBe(true);
    expect(existsSync("vite.config.ts")).toBe(true);
    expect(existsSync("src/app/main.tsx")).toBe(true);
    expect(existsSync("src/app/App.tsx")).toBe(true);
  });

  test("index.html points to client entry point", () => {
    const html = readFileSync("index.html", "utf-8");
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('src="/src/app/main.tsx"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/app/frontend.test.ts`  
Expected: FAIL (`index.html` not found).

- [ ] **Step 3: Write minimal implementation**

Create `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Renderloom</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/main.tsx"></script>
  </body>
</html>
```

Create `vite.config.ts`:
```typescript
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
  },
});
```

Create `src/app/App.css`:
```css
:root {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  color: #111;
  background-color: #f7f7f8;
  margin: 0;
  padding: 0;
}

.studio-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

header h1 {
  margin: 0 0 0.5rem 0;
}
```

Create `src/app/App.tsx`:
```tsx
import React from "react";
import "./App.css";

export function App() {
  return (
    <div className="studio-container">
      <header>
        <h1>Renderloom</h1>
        <p>Local-first, code-first AI image design studio</p>
      </header>
      <main>
        <section>
          <p>Phase 0: Base scaffold ready.</p>
        </section>
      </main>
    </div>
  );
}
```

Create `src/app/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/app/frontend.test.ts`  
Run build: `bun run build`  
Expected: PASS and `dist/` directory generated.

- [ ] **Step 5: Commit**

```bash
git add index.html vite.config.ts src/app/ tests/app/frontend.test.ts
git commit -m "feat(frontend): scaffold Vite React frontend application [phase-0]"
```

---

### Task 7: Full System Verification & Phase 0 Acceptance Signoff

**Files:**
- Modify: `ROADMAP.md:228-237` (check completed Phase 0 items)
- Modify: `LOG.md` (record completion of Phase 0)

- [ ] **Step 1: Run full test suite and quality checks**

```bash
bun test
bun run typecheck
bun run lint
bun run build
```
Expected: All tests pass, zero type errors, zero lint errors, build succeeds.

- [ ] **Step 2: Update ROADMAP.md and LOG.md**

Check Phase 0 tasks in `ROADMAP.md` and append decision log in `LOG.md`.

- [ ] **Step 3: Commit**

```bash
git add ROADMAP.md LOG.md
git commit -m "docs(roadmap): mark Phase 0 completed and record log [phase-0]"
```

---

## Plan Review Checklist
- [x] Every Phase 0 requirement in `ROADMAP.md` mapped to an explicit task.
- [x] Zero placeholders (full code and commands provided).
- [x] Strict conformance to `AGENTS.md` worktree isolation and commit rules.
- [x] All commands runnable under Bun >= 1.0.
