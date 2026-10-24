import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RevisionInput } from "../../src/components/RevisionInput";

describe("RevisionInput Component", () => {
  test("renders revision input section with parent version badge and apply button", () => {
    const html = renderToStaticMarkup(
      <RevisionInput
        candidateId="design-001"
        parentVersionId="v002"
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain("revision-input-section");
    expect(html).toContain("Design Revision");
    expect(html).toContain("Parent: v002");
    expect(html).toContain("revision-input-textarea");
    expect(html).toContain("0 / 1000");
    expect(html).toContain("Apply Revision");
  });

  test("renders disabled state when disabled prop is true", () => {
    const html = renderToStaticMarkup(
      <RevisionInput
        candidateId="design-001"
        parentVersionId="v001"
        disabled={true}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain("disabled");
  });

  test("renders submitting spinner when isSubmitting prop is true", () => {
    const html = renderToStaticMarkup(
      <RevisionInput
        candidateId="design-001"
        parentVersionId="v001"
        isSubmitting={true}
        onSubmit={() => {}}
      />,
    );

    expect(html).toContain("spinner-sm");
    expect(html).toContain("Revising...");
  });
});
