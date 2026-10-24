# Renderloom

**Local-first, code-first AI image design studio.**

Renderloom turns natural language design briefs into high-resolution graphics through clean, deterministic, editable JSX code. Instead of opaque pixel diffusion, Renderloom combines modern Large Language Models (LLMs) with [Satori](https://github.com/vercel/satori) and [Resvg](https://github.com/thx/resvg-js) to produce crisp vector SVGs and raster PNGs backed by inspectable source code.

---

## Key Features

- **Code-First Visual Design:** Generates standards-compliant JSX layouts that render cleanly to SVG and PNG. Every visual element has inspectable source code.
- **Bring Your Own Key (BYOK):** Multi-provider support for OpenAI and Anthropic. API keys are stored strictly in RAM (`InMemoryKeyStore`) and never touch disk or session output.
- **Curated Style Presets:** Built-in design frameworks for Bauhaus, Swiss International, Brutalism, Editorial, and Minimalist aesthetics.
- **In-Session Revisions & Version History:** Request visual changes on any candidate. Each revision creates an immutable version (`v001`, `v002`) with branching and non-destructive restores.
- **Local-First Session Persistence:** Sessions, candidate artifacts, conversation logs, and snapshots are stored locally under `Outputs/<session-slug>/` using atomic filesystem operations.
- **Robust Security Sandbox:** AST depth and node limits, dangerous HTML element blacklisting, SSRF protection for custom endpoints, and automatic secret redaction across logs and error messages.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│               Renderloom Studio (Browser)              │
│       React 19 + Vite Workspace UI (Desktop Dark)      │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP API (REST / Event-driven)
┌───────────────────────────▼────────────────────────────┐
│                 Bun HTTP Backend Server                 │
├───────────────────────────┬────────────────────────────┤
│   LLM Service (BYOK)      │   Job & Batch Coordinator  │
│   - OpenAI Adapter        │   - Worker Queue           │
│   - Anthropic Adapter     │   - Non-blocking Execution │
│   - In-Memory KeyStore    │   - Error Isolation        │
├───────────────────────────┼────────────────────────────┤
│   Prompt & Style Engine   │   Session Persistence      │
│   - Base Prompt Loader    │   - Atomic Writes (.tmp)   │
│   - Style Presets (.json) │   - Path Traversal Defense │
│   - Revision Composer     │   - Outputs/<slug>/ Layout │
├───────────────────────────┴────────────────────────────┤
│                  Satori & Resvg Pipeline               │
│   JSX ──► AST Validator ──► Satori (SVG) ──► Resvg (PNG) │
└────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- [Bun](https://bun.sh) (v1.0 or higher)
- Modern web browser (Chrome, Edge, Firefox, or Safari)
- API key for OpenAI (`gpt-4o`, `gpt-4o-mini`, `o3-mini`) or Anthropic (`claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229`)

---

## Quickstart

### 1. Install Dependencies
```bash
bun install
```

### 2. Start the Development Server
```bash
bun run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. The backend API runs on port 3000 and is proxied through Vite.

### 3. Generate a Sample Session (Optional)
To immediately populate your local workspace with a demo Bauhaus design session:
```bash
bun run generate:sample
```

---

## Developer Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server with live reload |
| `bun test` | Run entire automated test suite |
| `bun run typecheck` | Run TypeScript compiler checks (`tsc --noEmit`) |
| `bun run lint` | Run Biome lint checks |
| `bun run format` | Auto-format source code using Biome |
| `bun run build` | Build production frontend bundle |
| `bun run generate:sample` | Generate standalone sample session fixture |

---

## Demo Workflow

1. **Configure Provider Key:** Click the gear icon in the workspace header to open Settings. Select your provider (OpenAI or Anthropic), input your API key, and test connectivity.
2. **Setup Session:** Select your desired style preset (e.g. *Bauhaus*), output dimensions (e.g. *1200x1200*), and candidate count.
3. **Generate:** Type your design brief (e.g. *"Exhibition poster for a modern architecture conference"*) and click **Generate**.
4. **Inspect Candidates:** Review rendered PNG cards in the gallery. Open any candidate to view the full resolution preview, inspect vector SVG, or examine generated JSX source code.
5. **Revise Non-Destructively:** Type feedback in the revision bar (e.g. *"Increase the weight of the headline and change the primary accent to crimson"*). Renderloom branches a new version (`v002`) while preserving `v001`.
6. **Reopen Anytime:** Close or restart the server. Your sessions remain intact in `Outputs/` and reload instantly upon workspace launch.

---

## Security Model

- **No Disk Storage for Secrets:** API keys exist only in process RAM. No key is ever saved to `Outputs/`, local databases, browser cookies, or configuration files.
- **Log Sanitization:** All server log lines are structured JSON with automated credential scrubbing for Authorization headers, `sk-...` keys, and token payloads.
- **Deterministic Rendering Sandbox:** Generated JSX is validated against an element allowlist (`div`, `span`, `p`, `img`, `svg`, `path`, `rect`, `circle`). Dynamic code execution (`eval`, `<script>`, event listeners, dynamic imports) is strictly rejected.
- **Resource Caps:** Hard bounds prevent resource exhaustion (`MAX_AST_DEPTH = 64`, `MAX_AST_NODES = 2000`, `MAX_ASSET_BYTES = 5MB`, `MAX_SVG_BYTES = 10MB`, `MAX_RENDER_DURATION_MS = 30000ms`).
- **Network Isolation:** Arbitrary remote image loading in JSX is blocked. Custom LLM base URLs are protected against cloud metadata endpoints and SSRF.

---

## Technical Documentation

Detailed guides are available in the [`docs/`](docs/) directory:

- [LLM Providers & BYOK Architecture](docs/providers.md)
- [Satori & Resvg JSX Rendering Engine](docs/renderer-satori.md)
- [Prompts & Style Presets Guide](docs/prompts-and-styles.md)
- [Outputs & Session Persistence](docs/outputs-and-sessions.md)

---

## License

Renderloom is licensed under the [MIT License](LICENSE).  
Third-party dependency and bundled font licenses are documented in [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
