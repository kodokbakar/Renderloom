# Renderloom Implementation Log

## Decisions and Deviations

### Phase 0: Repository Foundation and Product Contracts
- Initialized project with Bun, TypeScript (strict), Vite + React, and Biome.
- Documented data contracts for Session, Candidate, Version, and GenerationRequest.
- Separated local API and request validation boundaries from UI.
- Phase 0 full system verification completed: `bun test` (18 passing tests across 6 files), `bun run typecheck` (zero TypeScript errors), `bun run lint` (zero Biome lint/format errors), and `bun run build` (Vite build successful).
- Phase 0 acceptance criteria satisfied and signed off.

### Phase 1: Rendering Proof of Concept
- Installed and pinned `satori` (0.63.2) and `@resvg/resvg-js` (2.6.2).
- Added SIL OFL-licensed `Roboto-Regular.ttf` font and license text under `src/renderer/fonts/`, with an in-memory cached loader `src/renderer/fonts.ts`.
- Extended domain error model in `src/domain/errors.ts` with `RenderError` and error codes: `UNSUPPORTED_SYNTAX`, `DANGEROUS_CODE_DETECTED`, `UNTRUSTED_REMOTE_ASSET`, `RENDER_FAILED`.
- Implemented SSRF and directory traversal guard in `src/renderer/assets.ts`: permits data:image URLs and safe local paths within baseDir; blocks remote protocols (`http:`, `https:`, `//`, `ftp:`, `javascript:`, `file:`) and `..` path traversals.
- Implemented restricted JSX AST validator in `src/renderer/validator.ts` using TypeScript compiler API: enforces root container `<div>`, allowlist of safe elements (`div`, `span`, `p`, `img`, `svg`, `path`, `rect`, `circle`), literal-only styles, and rejects executable constructs (`eval`, functions, imports, event handlers, spreads, dynamic expressions, script/style/iframe tags).
- Implemented trusted AST-to-VNode interpreter in `src/renderer/interpreter.ts`: recursive AST traversal to Satori-compatible VNode tree with zero `eval`, `new Function`, or code execution.
- Implemented PNG header parser and dimension validator in `src/renderer/png.ts`: validates 8-byte PNG magic signature and IHDR width/height at bytes 16–23 against requested dimensions.
- Orchestrated full rendering pipeline in `src/renderer/render.ts`: validate -> interpret -> Satori SVG layout -> Resvg PNG rasterization -> dimension validation.
- Added static JSX fixture `tests/fixtures/sample-card.jsx` and rendered artifacts `sample-card.svg` and `sample-card.png`.
- Added test suites across `tests/renderer/` (validator, interpreter, assets, render): 75 passing tests (100% pass rate).
- Verified: `bun test` (75 passing tests), `bun run typecheck` (0 errors), `bun run lint` (0 errors), `bun run build` (clean Vite build).

### Phase 2: Local Sessions and Filesystem Persistence
- Defined versioned session domain contracts (`Session`, `SessionSummary`, `FullSession`, `Conversation`, `GenerationConfig`, `SESSION_SCHEMA_VERSION = 1`) and `SessionError` error hierarchy (`SESSION_NOT_FOUND`, `SESSION_ALREADY_EXISTS`, `INVALID_PATH`, `INVALID_SESSION_NAME`, `CORRUPT_SESSION`, `ARTIFACT_NOT_FOUND`, `IMMUTABLE_ARTIFACT`).
- Implemented secret redaction utilities in `src/security/redact.ts`: regex scanners detecting OpenAI, Anthropic, Google AI, and Bearer credentials; recursive object sanitizer; `assertNoSecrets` guard preventing secrets from reaching disk.
- Implemented slug generation and sanitization in `src/sessions/slug.ts`: converts arbitrary names to lowercase ASCII slugs, handles hostile/empty inputs with safe defaults, resolves collisions via incremental/hash suffixes.
- Implemented path security guards in `src/sessions/paths.ts`: blocks directory traversal (`..`, `\0`, slashes), checks canonical boundaries and symlink escapes against `Outputs/` root.
- Implemented atomic writes in `src/sessions/atomic.ts`: writes via temporary `.<name>.<uuid>.tmp` files with atomic rename and cleanup on failure; temp file orphan sweep.
- Implemented `SessionService` in `src/sessions/service.ts`: session CRUD, reopen, safe deletion, artifact management across `images/`, `source/`, `svg/`, and `assets/`, immutable version protection, and corrupt metadata isolation in `listSessions()`.
- Implemented Bun HTTP API routes in `src/server/routes/sessions.ts` and `src/server/server.ts`: session listing, creation, reopen, rename, deletion, and controlled artifact streaming with MIME headers (`image/png`, `image/svg+xml`, `text/plain`).
- Added end-to-end integration and security test suites across `tests/sessions/` and `tests/server/`.

### Phase 3: LLM Provider and BYOK Configuration
- Defined provider contracts in `src/domain/provider.ts` (`ProviderAdapter`, `ProviderMeta`, `ProviderModel`, `ConnectionTestResult`, `LLMGenerationRequest`, `LLMGenerationResponse`) and extended error model with `ProviderError` and `ProviderErrorCode` (`UNAUTHORIZED`, `INSUFFICIENT_QUOTA`, `RATE_LIMITED`, `MODEL_NOT_FOUND`, `TIMEOUT`, `NETWORK_ERROR`, `INVALID_REQUEST`, `PROVIDER_ERROR`).
- Implemented API key masking in `src/security/mask.ts`: formats OpenAI (`sk-...xxxx`) and Anthropic (`sk-ant-...xxxx`) prefixes while concealing sensitive body.
- Implemented base URL security validator in `src/security/url.ts`: protocol enforcement (`http:`, `https:` only), embedded credentials rejection, path traversal rejection, cloud metadata blocking (`169.254.169.254`, `metadata.google.internal`, `100.100.100.200`, `fd00:ec2::254`), and local loopback support for local LLM engines when explicitly enabled.
- Implemented transient `InMemoryKeyStore` in `src/llm/keystore.ts`: holds BYOK credentials strictly in memory during application runtime with zero filesystem persistence or disk writes; `getStatus()` exposes masked indicator and never reveals raw keys.
- Implemented normalized error mapper in `src/llm/errors.ts`: maps HTTP 401, 402, 404, 429, 5xx, timeouts, and network connection faults to structured `ProviderError` with recursive secret redaction preventing credential reflection.
- Implemented native Bun fetch client wrapper in `src/llm/adapters/base.ts` with configurable timeout and abort signaling.
- Implemented `OpenAIAdapter` in `src/llm/adapters/openai.ts` supporting standard OpenAI endpoints and custom OpenAI-compatible servers (Ollama, vLLM).
- Implemented `AnthropicAdapter` in `src/llm/adapters/anthropic.ts` supporting Anthropic Messages API with header injection and custom base URL rejection.
- Implemented `ProviderRegistry` in `src/llm/registry.ts` managing adapter discovery and lifecycle.
- Implemented Bun HTTP routes in `src/server/routes/llm.ts` and wired into `src/server/server.ts`:
  - `GET /api/llm/providers`: returns registered providers and configuration status (masked keys only).
  - `POST /api/llm/keys`: stores BYOK key in transient memory.
  - `DELETE /api/llm/keys/:providerId`: purges key from memory (forget key action).
  - `GET /api/llm/keys/status`: returns status of configured providers.
  - `POST /api/llm/test-connection`: tests provider connectivity and credentials without generating images or persisting data.
- Added unit and integration test suites:
  - `tests/security/url-validator.test.ts` (SSRF, cloud metadata, traversal, credentials, protocol).
  - `tests/security/mask.test.ts` (OpenAI, Anthropic, short keys, edge cases).
  - `tests/llm/keystore.test.ts` (CRUD, status, case-insensitivity, isolation).
  - `tests/llm/error-mapping.test.ts` (status code mapping, timeouts, network faults, secret scrubbing).
  - `tests/llm/openai-adapter.test.ts` (connection test, generation, custom baseUrl).
  - `tests/llm/anthropic-adapter.test.ts` (connection test, generation, header injection, custom baseUrl rejection).
  - `tests/server/llm-api.test.ts` (full HTTP API integration test).
  - `tests/llm/sentinel-leak.test.ts` (sentinel fake key proof: zero leak across error messages, JSON responses, and `Outputs/` directory).
- Verified: `bun test` (235 passing tests across 28 files), `bun run typecheck` (0 errors), `bun run lint` (0 errors), `bun run build` (clean Vite build).

### Phase 4: Prompt Composer and Style Presets
- Defined versioned style domain contracts (`StylePreset`, `StylePresetSummary`, `VisualSample`, `StylePalette`, `TypographyGuidance`, `LayoutGuidance`, `STYLE_SCHEMA_VERSION = 1`) in `src/domain/style.ts`.
- Defined dimension domain contracts and resource limit constants in `src/domain/dimensions.ts` (`MIN_DIMENSION = 64`, `MAX_DIMENSION = 4096`, `MAX_PIXELS = 4_194_304`, `MIN_CANDIDATE_COUNT = 1`, `MAX_CANDIDATE_COUNT = 4`, `MAX_PROMPT_LENGTH = 4000`, `MAX_ASSET_COUNT = 10`, aspect ratio presets `1:1`, `4:5`, `3:2`, `16:9`, `custom`).
- Defined prompt contracts in `src/domain/prompt.ts` (`CandidateOutputContract`, `GenerationOutputEnvelope`, `ComposedPrompt`, `ComposePromptOptions`).
- Implemented Zod schema validation in `src/styles/schema.ts` (`StylePresetSchema`, `StylePaletteSchema`, `TypographySchema`, `LayoutSchema`, `VisualSampleSchema`, `validateStylePreset`).
- Created 5 built-in style presets in `style-presets/`:
  - `bauhaus.json`: Primary colors, functional geometry, asymmetric balance, sans-serif typography.
  - `swiss.json`: Objective clarity, mathematical grid, generous white space, crimson accent.
  - `minimal.json`: Subtractive clarity, refined monochrome palette, expansive breathing room.
  - `editorial.json`: Warm parchment tone, literary serif typography, pull quotes, bylines.
  - `brutalist.json`: Stark black/white boundaries, heavy borders, monospace font, solid offset drop shadows.
- Implemented `StyleRegistry` in `src/styles/registry.ts`: loads, caches, and validates style presets from filesystem; formats concrete, actionable LLM instructions.
- Implemented aspect-ratio resolution and dimension bounds validation in `src/styles/dimensions.ts`.
- Implemented immutable technical system constraints in `src/prompts/technical-constraints.ts`: root container inline sizing, strict Satori flexbox layout allowlist, prohibited tags and dynamic JavaScript guards, local-first asset rules, and explicit non-override directive.
- Implemented base prompt loader and snapshotting in `src/prompts/loader.ts` and updated `SessionService` in `src/sessions/service.ts` to capture effective prompt snapshots per session.
- Implemented structured output contract and parser in `src/prompts/contract.ts`: enforces JSON candidate envelope with `candidateIndex`, `label`, `rationale`, and `jsx`; parses direct JSON and markdown-fenced outputs.
- Implemented `composePrompt` in `src/prompts/composer.ts`: combines base prompt, technical rules, style preset rules, output envelope, and user instructions with prompt injection resistance.
- Implemented Bun HTTP API routes and wired into `src/server/server.ts`:
  - `GET /api/styles`: list style preset summaries.
  - `GET /api/styles/:id`: retrieve full style preset details (404 on missing).
  - `POST /api/dimensions/resolve`: resolve aspect ratio to exact pixel dimensions with bounds validation.
  - `GET /api/prompts/default`: retrieve default base system prompt.
  - `POST /api/prompts/compose`: compose complete system and user prompts with style and dimension rules.
  - `POST /api/validate-generation`: updated with style registry and resource bounds checks.
- Added comprehensive unit and integration test suites:
  - `tests/styles/schema.test.ts` (preset validation, hex rules, version checks).
  - `tests/styles/registry.test.ts` (preset discovery, formatted instructions, error handling).
  - `tests/styles/dimensions.test.ts` (preset resolution, custom dimensions, 4MP and bounds checks).
  - `tests/prompts/technical-constraints.test.ts` (Satori flexbox rules, tag allowlists, security guards).
  - `tests/prompts/loader.test.ts` (prompt loader, missing fallbacks, snapshot immutability).
  - `tests/prompts/contract.test.ts` (JSON parsing, markdown fences, multi-candidate normalization).
  - `tests/prompts/composer.test.ts` (full prompt composition, injection resistance, Satori AST validator fixture pipeline).
  - `tests/server/styles-prompts-api.test.ts` (HTTP endpoints, 400 on bounds, 404 on missing styles).
- Verified: `bun test` (314 passing tests across 36 files), `bun run typecheck` (0 errors), `bun run lint` (0 errors), `bun run build` (clean Vite build).

### Phase 5: Generation Orchestration and Partial Success
- Extended domain contracts in `src/domain/candidate.ts`, `src/domain/session.ts`, `src/domain/provider.ts`, and `src/domain/dimensions.ts`:
  - Candidate lifecycle states (`queued`, `generating`, `validating`, `rendering`, `completed`, `failed`, `cancelled`), `CandidateTiming`, and `CandidateArtifacts`.
  - `BatchSummary`, `activeBatchId`, and `lastBatchStatus` metadata on `Session`.
  - Resource ceiling constants: `MAX_RESPONSE_SIZE = 1MB`, `MAX_SOURCE_LENGTH = 128KB`.
  - Optional `signal?: AbortSignal` on `LLMGenerationRequest`.
- Wired in-flight fetch cancellation via `AbortSignal.any` in `src/llm/adapters/base.ts`, `openai.ts`, and `anthropic.ts`.
- Implemented bounded concurrency worker queue in `src/jobs/queue.ts` supporting configurable concurrency limit (default 2), cancellation of queued jobs, and idle tracking.
- Implemented transient retry classifier and exponential backoff in `src/jobs/retry.ts`: classifies 429, timeouts, network faults, and 5xx as retryable; permanent validation, renderer, and authorization failures rejected immediately; sleep with abort support.
- Implemented structured candidate response parser and size enforcer in `src/jobs/parser.ts`: checks 1MB response size limit before JSON parsing, parses direct or envelope formats, rejects ambiguous source keys (`code`, `component`, `html`), checks 128KB source length, and validates JSX tag opening.
- Implemented single candidate lifecycle job executor in `src/jobs/executor.ts`: tracks stage transitions and timings, runs Satori SVG layout and Resvg PNG rasterization with decodability/dimension check, writes artifacts immediately to disk, and records candidate in session metadata.
- Extended `SessionService` in `src/sessions/service.ts`: added `saveCandidate`, `recordBatchSummary`, `getCandidates`, and serialized session write lock preventing concurrent read-modify-write races.
- Implemented batch `GenerationCoordinator` in `src/jobs/coordinator.ts`: coordinates multi-candidate batches, ensures failure isolation (partial success), supports queued and in-flight cancellation, per-candidate retries without affecting completed candidates, and event emission.
- Implemented Bun HTTP API routes in `src/server/routes/jobs.ts` and wired into `src/server/server.ts`:
  - `POST /api/generations`: start generation batch (202 Accepted).
  - `GET /api/generations/:batchId`: query batch status, candidate progress, and summary.
  - `POST /api/generations/:batchId/cancel`: cancel batch.
  - `POST /api/generations/:batchId/candidates/:candidateId/cancel`: cancel individual candidate.
  - `POST /api/generations/:batchId/candidates/:candidateId/retry`: retry specific failed/cancelled candidate.
  - `GET /api/generations/:batchId/events`: live SSE stream (`text/event-stream`).
  - `GET /api/sessions/:id/candidates`: retrieve session candidate records.
- Added unit and integration test suites:
  - `tests/jobs/queue.test.ts` (concurrency limit, FIFO, cancellation, idle).
  - `tests/jobs/retry.test.ts` (transient vs permanent classification, backoff calculation, abortable sleep).
  - `tests/jobs/parser.test.ts` (1MB response limit, 128KB source limit, direct vs envelope, ambiguous key rejection).
  - `tests/jobs/executor.test.ts` (end-to-end lifecycle, timings, disk persistence, transient retry, abort).
  - `tests/sessions/candidate-persistence.test.ts` (session candidate updates, batch summary persistence).
  - `tests/jobs/coordinator.test.ts` (multi-candidate batch, partial success isolation, retry, batch abort, events).
  - `tests/server/jobs-api.test.ts` (HTTP start, query, cancel, retry, and SSE streaming).
- Verified: `bun test` (364 passing tests across 43 files), `bun run typecheck` (0 errors), `bun run lint` (0 errors), `bun run build` (clean Vite build).

### Phase 6: Review Workspace
- Implemented core utilities and security guards in `src/components/utils/`:
  - `artifact-url.ts`: `buildArtifactUrl` validates session boundaries, rejects path traversal and null bytes, restricts types to `images`, `source`, `svg`, `assets`, and builds `/api/sessions/:id/artifacts/:type/:filename`.
  - `sanitize-error.ts`: `sanitizeErrorMessage` redacts OpenAI (`sk-...`), Anthropic (`sk-ant-...`), Bearer tokens, query/header credentials, and local absolute filesystem paths while preserving actionable AST validation, dimension mismatch, and provider error messages.
  - `format-timing.ts`: `formatTimingDuration` and `formatCandidateDuration` format milliseconds into human-readable durations (`450ms`, `1.5s`, `2m 10s`).
  - `syntax-tokenizer.ts`: Zero-dependency tokenizer `tokenizeJsxOrSvg` and `tokenizeLines` for syntax-highlighting JSX and SVG elements, attributes, strings, comments, numbers, and keywords.
- Built status badges, candidate cards, and gallery in `src/components/`:
  - `icons.tsx`: Lightweight inline SVG icons (`ImageIcon`, `CodeIcon`, `DownloadIcon`, `CopyIcon`, `CheckIcon`, `RefreshCwIcon`, `AlertCircleIcon`, `XIcon`, `ChevronLeftIcon`, `ChevronRightIcon`, `ClockIcon`, `BanIcon`).
  - `StatusBadge.tsx`: Badges for all 7 lifecycle states (`queued`, `generating`, `validating`, `rendering`, `completed`, `failed`, `cancelled`).
  - `CandidateCard.tsx`: Candidate thumbnail for completed candidates, duration badge, sanitized failure snippet, status badge, inspect overlay, and retry action.
  - `EmptyState.tsx`: Semantic empty states for `new-session`, `generating`, `no-success`, and `unavailable-artifact`.
  - `CandidateGallery.tsx`: Responsive candidate grid, selection state, and batch warning notice for failed runs.
- Built preview panel, metadata viewer, source inspection, and downloads in `src/components/`:
  - `ImagePreview.tsx`: Full-resolution image preview container with aspect ratio preservation and unavailable artifact fallback.
  - `MetadataViewer.tsx`: Version ID, candidate ID, label, rationale, model, style, dimensions, and granular phase timings breakdown.
  - `SourceViewer.tsx`: Syntax-highlighted read-only JSX and SVG source viewer with line numbers and copy-to-clipboard button.
  - `DownloadActions.tsx`: Scoped PNG, SVG, and JSX download actions resolving to session artifact endpoints.
  - `ErrorCard.tsx`: Sanitized actionable error card with error code badge and retry candidate action.
  - `PreviewModal.tsx`: Dialog coordinating large image preview, JSX source tab, SVG source tab, metadata sidebar, downloads, and keyboard navigation (`Escape`, `ArrowLeft`, `ArrowRight`).
- Built workspace header, settings bar, and batch progress in `src/components/`:
  - `WorkspaceHeader.tsx`: Brand title, session name, slug badge, session switcher dropdown, and collapsible prompt drawer.
  - `GenerationSettingsBar.tsx`: Settings chips for provider, model, style, dimensions, and candidate count.
  - `BatchProgressIndicator.tsx`: Active batch progress bar with completion percentage, status breakdown, and batch cancel action.
- Integrated Studio Workspace App and styling in `src/app/`:
  - `App.tsx`: Full workspace state coordination (sessions list, active session, candidate gallery, selection, non-blocking asynchronous JSX/SVG artifact fetching, desktop keyboard navigation, and cancel/retry actions).
  - `App.css`: Modern desktop-responsive CSS layout with dark theme, card grid, modal overlay, syntax highlighting colors, and transitions.
  - `vite.config.ts`: Added `/api` proxy forwarding requests to `http://localhost:3000`.
- Added unit and integration test suites:
  - `tests/components/artifact-url.test.ts`
  - `tests/components/sanitize-error.test.ts`
  - `tests/components/syntax-tokenizer.test.ts`
  - `tests/components/status-badge.test.tsx`
  - `tests/components/candidate-card.test.tsx`
  - `tests/components/candidate-gallery.test.tsx`
  - `tests/components/metadata-viewer.test.tsx`
  - `tests/components/download-actions.test.tsx`
  - `tests/components/preview-modal.test.tsx`
  - `tests/components/workspace-header.test.tsx`
  - `tests/app/app-integration.test.tsx`
- Verified: `bun test` (429 passing tests across 54 files), `bun run typecheck` (0 errors), `bun run lint` (0 errors), `bun run build` (clean Vite production build).
