# Satori & Resvg JSX Rendering Engine

Renderloom uses a code-first, deterministic rendering pipeline. Natural language requests are converted into static JSX, rendered into vector SVG using [Vercel Satori](https://github.com/vercel/satori), and rasterized into high-resolution PNG using [Resvg](https://github.com/thx/resvg-js).

---

## Rendering Pipeline

```
LLM Output (JSX string)
         │
         ▼
AST Validation (validateJsx) ───► Syntax, Tag Allowlist, AST Caps & Prototype Defense
         │
         ▼
VNode Interpretation (interpretJsx) ───► Static Virtual DOM Tree
         │
         ▼
Satori SVG Generation ───► Responsive Vector Layout & SVG Output
         │
         ▼
Resvg Rasterization ───► Deterministic High-Res PNG Buffer
```

---

## Supported JSX Elements

Renderloom restricts JSX elements to a secure, deterministic subset supported by Satori:

| Tag | Category | Notes |
|-----|----------|-------|
| `div` | Layout container | Primary flex container; root element must be a `<div>`. |
| `span` | Inline text | Inline text runs and badges. |
| `p` | Block text | Paragraph blocks and descriptive copy. |
| `img` | Image | Embedded visual assets (data URLs or approved local session assets). |
| `svg` | Vector | Inline SVG vector wrapper. |
| `path` | Vector shape | Vector outlines, paths, and icons. |
| `rect` | Vector shape | Geometric rectangles and borders. |
| `circle` | Vector shape | Geometric circular accents and badges. |

### Blocked Dangerous Tags
The following tags are strictly rejected during AST validation to prevent code execution and security vulnerabilities:
`script`, `style`, `iframe`, `object`, `embed`, `frame`, `frameset`, `link`, `meta`, `base`.

---

## Layout and Styling Rules

1. **Flexbox Only:** Satori uses a flexbox layout engine. CSS Grid and float properties (`float: left`, `clear: both`) are not supported.
2. **Root Element Requirements:** The outermost element must be a `<div style={{ display: 'flex', width: ..., height: ... }}>` matching the requested canvas dimensions in pixels.
3. **Inline Styles:** Styles must be provided as inline style objects (`style={{ ... }}`). External stylesheets and `<style>` blocks are prohibited.
4. **Colors:** Use standard hex strings (`#D02020`), RGB strings (`rgb(17, 17, 17)`), or named CSS colors.
5. **No Dynamic Execution:** Function calls, loops, event handlers (`onClick`, `onMouseEnter`), hooks, and external imports are rejected. JSX is interpreted as static pure data.

---

## Resource Bounds and Safety Limits

To guarantee stability and prevent Denial of Service (DoS) attacks, Renderloom enforces hard bounds during validation and rendering:

| Limit | Value | Description |
|-------|-------|-------------|
| `MAX_AST_DEPTH` | `64` | Maximum nested element depth in the JSX AST. |
| `MAX_AST_NODES` | `2,000` | Maximum total AST nodes in a single JSX document. |
| `MAX_ASSET_BYTES` | `5 MB` (`5,242,880 B`) | Maximum file or decoded data URL asset payload size. |
| `MAX_SVG_BYTES` | `10 MB` (`10,485,760 B`) | Maximum output size for intermediate SVG string. |
| `MAX_RENDER_DURATION_MS` | `30,000 ms` | Maximum timeout for Satori layout and Resvg rasterization. |

### Prototype Pollution Protection
The JSX AST parser rejects any object keys or attribute names matching `__proto__`, `constructor`, or `prototype`.

---

## Assets and Images

- **Data URLs:** Inline base64 data URLs (`data:image/png;base64,...`, `data:image/jpeg;base64,...`, `data:image/webp;base64,...`, `data:image/svg+xml;base64,...`) are permitted up to 5 MB.
- **Local Assets:** Relative asset references within the session directory (`assets/...`) are permitted after path containment checks.
- **Arbitrary Remote URLs:** External HTTP/HTTPS image URLs in generated JSX are blocked by default to prevent SSRF and external asset leakage.

---

## Typography and Bundled Fonts

Satori requires explicit font binary data to calculate glyph bounding boxes and render text.
- Renderloom bundles **Roboto Regular** (`src/renderer/fonts/Roboto-Regular.ttf`) licensed under the SIL Open Font License 1.1.
- Default font configurations are automatically loaded by `getDefaultFontConfig()` without requiring external internet access.
