import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ImagePreview } from "../../src/components/ImagePreview";

describe("ImagePreview", () => {
  test("renders fallback empty state when imageUrl is null or empty", () => {
    const nullHtml = renderToStaticMarkup(
      <ImagePreview imageUrl={null} alt="Preview image" />,
    );
    expect(nullHtml).toContain("Image unavailable");
    expect(nullHtml).toContain("empty-state-unavailable-artifact");

    const emptyHtml = renderToStaticMarkup(
      <ImagePreview imageUrl="" alt="Preview image" />,
    );
    expect(emptyHtml).toContain("Image unavailable");
  });

  test("renders image element with src, alt, and aspect ratio when valid imageUrl is supplied", () => {
    const html = renderToStaticMarkup(
      <ImagePreview
        imageUrl="/api/sessions/s1/artifacts/images/out.png"
        alt="Candidate preview design"
        width={1024}
        height={768}
      />,
    );

    expect(html).toContain('src="/api/sessions/s1/artifacts/images/out.png"');
    expect(html).toContain('alt="Candidate preview design"');
    expect(html).toContain("aspect-ratio:1024 / 768");
    expect(html).toContain("image-preview-skeleton");
    expect(html).toContain("image-preview-img");
  });
});
