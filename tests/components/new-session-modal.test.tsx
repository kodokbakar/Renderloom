import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NewSessionModal } from "../../src/components/NewSessionModal";

describe("NewSessionModal", () => {
  test("renders closed modal as null", () => {
    const html = renderToStaticMarkup(
      <NewSessionModal
        isOpen={false}
        onClose={() => {}}
        onCreate={async () => {}}
      />,
    );
    expect(html).toBe("");
  });

  test("renders open modal with fields, aspect ratio buttons, and launch button", () => {
    const html = renderToStaticMarkup(
      <NewSessionModal
        isOpen={true}
        onClose={() => {}}
        onCreate={async () => {}}
      />,
    );

    expect(html).toContain("Create New Session");
    expect(html).toContain('data-testid="new-session-name-input"');
    expect(html).toContain('data-testid="new-session-provider-select"');
    expect(html).toContain('data-testid="new-session-model-select"');
    expect(html).toContain('data-testid="new-session-style-select"');
    expect(html).toContain('data-testid="ratio-btn-1:1"');
    expect(html).toContain('data-testid="ratio-btn-16:9"');
    expect(html).toContain('data-testid="ratio-btn-custom"');
    expect(html).toContain('data-testid="new-session-prompt-input"');
    expect(html).toContain('data-testid="create-session-submit"');
    expect(html).toContain('data-testid="create-session-cancel"');
  });
});
