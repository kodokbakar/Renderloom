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
