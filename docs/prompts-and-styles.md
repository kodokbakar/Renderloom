# Prompts and Style Presets

Renderloom guides LLM generation through structured prompt composition, base system prompts, and reusable style presets.

---

## Base Prompt Customization

At the root of the Renderloom project is `prompt.txt`. This file defines the core system instructions provided to all LLM providers:

```text
You are an expert graphic designer and visual engineer producing clean, static JSX compositions for Satori rendering.
Output only valid JSX elements adhering strictly to supported inline styling:
- Root element must be a <div> with explicit width and height in pixels matching requested dimensions.
- Use flexbox layout only. Do not use grid or absolute positioning without explicit parent bounds.
- Use standard CSS color hex codes or rgb values.
- Do not use external scripts, functions, event listeners, or dynamic JavaScript logic.
```

### Snapshotting for Determinism
Whenever a session is created, the active `prompt.txt` is captured into `Outputs/<session-slug>/prompt.snapshot.txt`. If `prompt.txt` is modified later, existing sessions retain their historical prompt snapshot, ensuring that candidate revisions and reproducer builds remain consistent over time.

---

## Technical Constraints and Output Contract

Renderloom injects mandatory technical constraints into every generation request:
1. **Single JSX Tree:** The model must emit exactly one root JSX element (`<div>...</div>`).
2. **No Extra Explanation:** The model is instructed to output only JSX inside markdown fences (````jsx ... ````) without introductory greetings or markdown commentary.
3. **Strict Syntax:** Prohibits unsupported HTML tags, dynamic JavaScript expressions, hooks, and external asset links.

---

## Style Presets

Style presets live in the `style-presets/` directory as JSON files. They define design rules, color palettes, typographic hierarchies, and layout structures for specific visual movements.

Renderloom ships with built-in presets:
- `bauhaus.json`: Modernist primary colors, geometric forms, asymmetric balance.
- `brutalist.json`: High-contrast borders, raw utilitarian typography, monospace accents.
- `swiss.json`: Grid alignment, neutral grotesque typography, asymmetric white space.
- `minimal.json`: Subdued monochromatic palettes, ample breathing room, restrained typography.
- `editorial.json`: Magazine-style headlines, structured columns, elegant typographic hierarchy.

---

## Style Preset Schema

Each preset adheres to the following JSON schema:

```json
{
  "schemaVersion": 1,
  "id": "my-style",
  "name": "My Style Name",
  "description": "Short summary of the aesthetic.",
  "designPrinciples": [
    "Core guideline 1",
    "Core guideline 2"
  ],
  "palette": {
    "background": "#FFFFFF",
    "foreground": "#111111",
    "primary": "#0055FF",
    "secondary": "#555555",
    "accent": "#FF3300",
    "muted": "#888888",
    "border": "#000000"
  },
  "typography": {
    "fontFamily": "sans-serif",
    "headingWeight": 800,
    "bodyWeight": 400,
    "scale": ["48px", "32px", "20px", "14px"],
    "guidelines": [
      "Typographic hierarchy instructions..."
    ]
  },
  "layout": {
    "structure": "Description of layout arrangement",
    "spacing": "Spacing standards (e.g. 24px - 48px)",
    "alignment": "Alignment rules",
    "rules": [
      "Rule 1",
      "Rule 2"
    ]
  },
  "allowedEffects": [
    "solid borders",
    "sharp drop shadows"
  ],
  "patternsToAvoid": [
    "Multi-stop gradients",
    "Decorative serif flourishes"
  ],
  "visualSample": {
    "background": "#FFFFFF",
    "foreground": "#111111",
    "accent": "#0055FF",
    "previewText": "SAMPLE"
  }
}
```

### Adding a New Preset
1. Create a new file in `style-presets/<id>.json`.
2. Populate all required fields following the schema above.
3. Restart the server or run `bun test` to verify preset schema compliance.

---

## Revision Prompt Composition

When you request an in-session revision:
1. Renderloom retrieves the current JSX of the target candidate version.
2. The JSX is injected inside a fenced code block into the prompt.
3. The user's revision feedback is appended along with candidate-specific conversation history (truncated to the last 4 turns to avoid unbounded context expansion).
4. The system reminds the model to preserve unaffected layout elements while applying the requested changes.
