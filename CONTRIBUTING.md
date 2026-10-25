# Contributing to Renderloom

Thank you for your interest in contributing to Renderloom! Renderloom is a local-first, code-first AI image design studio that turns natural-language prompts into editable JSX compositions, renders them through Satori and Resvg, and persists design iterations inside local sessions.

By contributing to Renderloom, you agree that your contributions will be licensed under the [GNU General Public License v3.0](LICENSE) (GPL-3.0-or-later).

Please review this document and our [Code of Conduct](CODE_OF_CONDUCT.md) before submitting issues or pull requests.

---

## Code of Conduct

All contributors and maintainers are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md). Please report any unacceptable behavior to [conduct@renderloom.dev](mailto:conduct@renderloom.dev).

---

## Getting Started

### Prerequisites

- **Bun**: >= 1.0 (Renderloom uses Bun as its runtime, package manager, and test runner).
- Modern web browser (Chrome, Chromium, Firefox, or Safari).

### Local Setup

1. Fork and clone the repository.
2. Install dependencies:
   ```bash
   bun install
   ```
3. Start the development server (runs with hot reloading):
   ```bash
   bun run dev
   ```
4. Build the client bundle:
   ```bash
   bun run build
   ```

---

## Developer Commands

Renderloom uses Bun scripts for standard development tasks:

| Command | Description |
|---|---|
| `bun run dev` | Starts the backend development server with file watching |
| `bun run build` | Compiles the frontend application using Vite |
| `bun run start` | Runs the production server |
| `bun test` | Runs the automated test suite with Bun's native test runner |
| `bun run lint` | Runs Biome to check lint rules and code formatting |
| `bun run format` | Runs Biome to automatically format code |
| `bun run typecheck` | Validates TypeScript types across the codebase (`tsc --noEmit`) |
| `bun run generate:sample` | Generates a sample session with pre-rendered assets for local testing |
| `bun run test:e2e` | Runs Playwright end-to-end tests |

---

## Architecture and Technical Principles

Renderloom is built on three core pillars: deterministic sandboxed rendering, zero disk leakage for credentials, and local-first session persistence.

### 1. AST Sandbox Constraints

To safely render AI-generated JSX without arbitrary code execution:
- **No `eval` or Execution:** Model-generated code is parsed into a syntax tree using TypeScript compiler API and interpreted directly into Satori VNodes. Dynamic JavaScript constructs, `eval`, `new Function`, `<script>`, `<iframe>`, event listeners (`onClick`, `onMouseOver`), dynamic imports, and spreads are strictly prohibited.
- **Element Allowlist:** Only approved safe display tags are accepted: `div`, `span`, `p`, `img`, `svg`, `path`, `rect`, and `circle`. Note that `<br>` tags are normalized to newline expressions `{"\n"}`.
- **Layout Model:** Satori supports flexbox layouts only (`display: flex`). Block and inline layouts or complex CSS grids are not supported.
- **Resource Caps:** Hard limits enforce system stability:
  - `MAX_AST_DEPTH = 64`
  - `MAX_AST_NODES = 2000`
  - `MAX_ASSET_BYTES = 5 MB`
  - `MAX_SVG_BYTES = 10 MB`
  - `MAX_RENDER_DURATION_MS = 30000 ms`
- Detailed rendering documentation is available in [docs/renderer-satori.md](docs/renderer-satori.md).

### 2. BYOK Security Model

Renderloom follows a Bring-Your-Own-Key (BYOK) architecture:
- **RAM-Only Key Storage:** API keys exist exclusively in process memory (`InMemoryKeyStore`). Never write API keys to disk, configuration files, local storage, or session folders.
- **Log Sanitization:** All server logs scrub Authorization headers, bearer tokens, and API key patterns (`sk-...`, `sk-ant-...`).
- **SSRF Defense:** Custom LLM base URLs are validated to block private network ranges, cloud metadata addresses (`169.254.169.254`), and path traversal attempts.
- Detailed provider documentation is available in [docs/providers.md](docs/providers.md).

### 3. Session Persistence and Immutability

- Sessions are saved locally in the `Outputs/` directory under URL-safe slugs.
- Generated JSX, SVGs, and PNGs are versioned and immutable once written (`v001`, `v002`).
- Atomic writes via temporary files prevent corrupted state on unexpected server shutdown.
- Detailed session persistence documentation is available in [docs/outputs-and-sessions.md](docs/outputs-and-sessions.md).

---

## Development Workflow

### Branching Convention

- Features: `feat/<feature-name>` or `feat/<issue-id>-<short-description>`
- Bug fixes: `fix/<bug-name>` or `fix/<issue-id>-<short-description>`
- Documentation: `docs/<topic>`

### Commit Message Guidelines

Renderloom follows Conventional Commits formatting:

```
<type>(<scope>): <summary>
```

Common types:
- `feat`: A new feature or capability
- `fix`: A bug fix
- `test`: Adding or updating tests
- `refactor`: Code restructuring without behavioral change
- `docs`: Documentation updates
- `chore`: Tooling, build, or configuration updates

Examples:
- `feat(renderer): support linearGradient elements in SVG`
- `fix(security): sanitize path traversal in asset loader`
- `docs(governance): add CONTRIBUTING and CODE_OF_CONDUCT`

### Pull Request Process

1. **Verify All Checks Locally:** Before opening a PR, ensure all gates pass:
   ```bash
   bun run typecheck
   bun run lint
   bun test
   bun run build
   ```
2. **Add Tests:** Every bug fix must include a regression test; every new feature must include automated test coverage.
3. **Keep PRs Focused:** Avoid bundling unrelated changes or drive-by refactorings.
4. **Link Issues:** Reference related issues in the PR description (e.g., `Closes #123`).

---

## Licensing

Renderloom is licensed under the **GNU General Public License v3.0** (`GPL-3.0-or-later`).
Third-party dependencies and fonts remain under their respective permissive licenses as documented in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

All contributions submitted to Renderloom are subject to the terms of the GNU General Public License v3.0.
