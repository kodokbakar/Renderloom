# Outputs and Session Persistence

Renderloom is built on a local-first filesystem architecture. Every design session, candidate generation, and revision iteration is persisted in the local `Outputs/` directory in human-readable, inspectable formats.

---

## Session Directory Structure

Each session lives inside a dedicated folder derived from its name and slug:

```
Outputs/
└── bauhaus-geometric-poster/
    ├── session.json                # Core session metadata and candidate version tree
    ├── conversation.json           # User prompt and revision chat history
    ├── generation-config.json      # Parameters used during generation (provider, style, dimensions)
    ├── prompt.snapshot.txt         # Snapshot of base prompt.txt captured at session creation
    ├── images/                     # Rendered PNG raster images
    │   ├── c01-v001.png
    │   ├── c01-v002.png
    │   └── c02-v001.png
    ├── svg/                        # Rendered vector SVG graphics
    │   ├── c01-v001.svg
    │   ├── c01-v002.svg
    │   └── c02-v001.svg
    ├── source/                     # Validated JSX source files
    │   ├── c01-v001.jsx
    │   ├── c01-v002.jsx
    │   └── c02-v001.jsx
    └── assets/                     # Optional local image assets used by JSX <img src="..." />
```

---

## Metadata Schemas

### `session.json`
Stores the complete state of the session, including candidates, version history, and active batch status:

```json
{
  "schemaVersion": 1,
  "id": "e3b0c442-98fc-1c14-9afb-4c7299342410",
  "name": "Bauhaus Geometric Poster",
  "slug": "bauhaus-geometric-poster",
  "createdAt": "2026-10-24T12:00:00.000Z",
  "updatedAt": "2026-10-24T12:05:00.000Z",
  "providerId": "openai",
  "modelId": "gpt-4o",
  "styleId": "bauhaus",
  "dimensions": {
    "width": 1200,
    "height": 1200
  },
  "candidates": [
    {
      "id": "c01",
      "index": 0,
      "state": "completed",
      "currentVersionId": "v002",
      "artifacts": {
        "pngPath": "images/c01-v002.png",
        "svgPath": "svg/c01-v002.svg",
        "sourcePath": "source/c01-v002.jsx"
      },
      "versions": [
        {
          "id": "v001",
          "candidateId": "c01",
          "versionNumber": 1,
          "pngPath": "images/c01-v001.png",
          "svgPath": "svg/c01-v001.svg",
          "jsxSourcePath": "source/c01-v001.jsx",
          "createdAt": "2026-10-24T12:00:30.000Z",
          "label": "Initial composition"
        },
        {
          "id": "v002",
          "candidateId": "c01",
          "versionNumber": 2,
          "parentVersionId": "v001",
          "revisionPrompt": "Add accent circle in top right",
          "pngPath": "images/c01-v002.png",
          "svgPath": "svg/c01-v002.svg",
          "jsxSourcePath": "source/c01-v002.jsx",
          "createdAt": "2026-10-24T12:02:15.000Z",
          "label": "Revision 2"
        }
      ]
    }
  ]
}
```

### `conversation.json`
Contains user prompts, revision requests, and timestamped message logs.

### `generation-config.json`
Records the original parameters (provider, model, style preset, candidate count, dimensions) for auditing and reproducibility.

---

## Immutable Artifacts and Versioning

1. **Immutable Artifact Files:** Every rendered asset filename includes candidate ID and version ID (`<candidateId>-<versionId>.<ext>`). Once written to disk, artifact files are never modified or overwritten in place.
2. **Non-Destructive Revisions:** Revisions never delete previous versions. Each revision creates a new version record (`v002`, `v003`) linked to its `parentVersionId`.
3. **Version Restoring and Branching:**
   - Restoring a previous version updates `currentVersionId` and active paths on the candidate.
   - Subsequent revisions from a restored version branch forward cleanly without erasing the alternate revision branch.

---

## Filesystem Integrity and Security Guarantees

- **Atomic Writes:** All JSON metadata and artifact files are written to a temporary `.tmp.<uuid>` file first and atomically renamed. Incomplete writes (e.g. power loss or process kill) never corrupt existing session records.
- **Orphaned File Cleanup:** On startup or session listing, dangling `.tmp` files from interrupted writes are automatically cleaned up.
- **Path Traversal Defenses:** All session paths and artifact requests are canonicalized and verified against directory traversal (`..`, null bytes, symlink escape) via `validateSessionPath` and `validateArtifactPath`.
- **Zero Secret Ingestion:** No credentials, API keys, or raw provider headers are ever written to the session directory.
