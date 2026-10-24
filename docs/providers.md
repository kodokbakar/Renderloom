# LLM Providers and BYOK Architecture

Renderloom operates on a **Bring Your Own Key (BYOK)** model. You provide API keys directly to the local application runtime; no cloud intermediary or proxy sits between your machine and the upstream AI providers.

---

## Supported Providers

Renderloom currently ships with built-in adapters for two primary LLM providers:

| Provider | ID | Default Model | Supported Preset Models | Custom Base URL? |
|----------|----|---------------|-------------------------|-------------------|
| **OpenAI** | `openai` | `gpt-4o` | `gpt-4o`, `gpt-4o-mini`, `o3-mini` | Yes (with security validation) |
| **Anthropic** | `anthropic` | `claude-3-5-sonnet-20241022` | `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`, `claude-3-opus-20240229` | No (fixed `https://api.anthropic.com/v1`) |

---

## Model Selection and Custom Model IDs

In addition to built-in presets, Renderloom allows you to type any valid custom model ID into the model input.
- **OpenAI:** Any chat completion compatible model ID (e.g. fine-tuned models, preview models, or models hosted on OpenAI-compatible proxies).
- **Anthropic:** Any Claude Messages API compatible model ID.

---

## In-Memory Key Lifecycle and Security

Renderloom enforces zero persistence for API credentials:

1. **Strictly RAM-Only:** Keys configured via the settings modal are stored in an in-memory keystore (`InMemoryKeyStore`) inside the active Bun server process.
2. **Never Written to Disk:** API keys are never written to `Outputs/`, `session.json`, `conversation.json`, or any local files.
3. **Redacted in Logs:** Server and frontend logs scrub credentials, Authorization headers, and key fragments (`sk-...`, `sk-ant-...`) automatically.
4. **Transient Lifetime:** Terminating or restarting the Renderloom Bun process immediately clears all configured keys from memory.
5. **Forget Key API:** You can explicitly purge a key from memory at any time:
   - Via UI: Click the trash/delete icon next to the configured provider in Settings.
   - Via HTTP API: Send `DELETE /api/llm/keys/:providerId`.

---

## Connection Testing

Before generating images, you can verify your key and model connectivity:

- **API Endpoint:** `POST /api/llm/test-connection`
- **Payload:**
  ```json
  {
    "providerId": "openai",
    "modelId": "gpt-4o",
    "apiKey": "sk-...",
    "baseUrl": "https://api.openai.com/v1"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "latencyMs": 312,
    "modelId": "gpt-4o"
  }
  ```

---

## Custom Base URLs (OpenAI Compatible)

When using OpenAI or OpenAI-compatible proxies (such as vLLM, Ollama, or LiteLLM), you can configure a custom base URL.

### Security and SSRF Protections
Renderloom validates all custom base URLs using `validateBaseUrl`:
- **Allowed Schemes:** `http:` and `https:` only.
- **Embedded Credentials Blocked:** URLs containing user/password (e.g. `https://user:pass@host`) are rejected.
- **Cloud Metadata Blocked:** Access to AWS/GCP/Azure link-local metadata services (`169.254.169.254`, `metadata.google.internal`, etc.) is permanently prohibited.
- **Path Traversal Blocked:** Any `..` segments or encoded traversal attempts (`%2e%2e`) are rejected.
- **Normalization:** Trailing slashes are stripped cleanly to prevent double-slash path resolution issues.

---

## Known Provider Differences and Limitations

1. **Structured JSX Extraction:** Models occasionally wrap JSX output in markdown code fences (```jsx ... ```). Renderloom automatically extracts and normalizes the inner JSX tree.
2. **Rate Limits & Context Windows:**
   - OpenAI `gpt-4o`: 128k context window.
   - Anthropic `claude-3-5-sonnet-20241022`: 200k context window.
3. **System Prompts:** OpenAI models receive instructions in `system` role messages; Anthropic models receive them via the dedicated top-level `system` parameter in the Messages API.
