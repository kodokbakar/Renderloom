import { describe, expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  EmptyState,
  type EmptyStateType,
} from "../../src/components/EmptyState";

describe("EmptyState", () => {
  const types: EmptyStateType[] = [
    "new-session",
    "generating",
    "no-success",
    "unavailable-artifact",
  ];

  for (const type of types) {
    test(`renders default empty state for type: ${type}`, () => {
      const html = renderToStaticMarkup(<EmptyState type={type} />);
      expect(html).toContain(`empty-state-${type}`);
      expect(html).toContain(`data-empty-type="${type}"`);
      expect(html).toContain("<h3");
      expect(html).toContain("<p");
    });
  }

  test("renders custom title, message, and action slot", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        type="new-session"
        title="Custom Title Here"
        message="Custom message body text"
        action={<button type="button">Action Button</button>}
      />,
    );

    expect(html).toContain("Custom Title Here");
    expect(html).toContain("Custom message body text");
    expect(html).toContain("<button");
    expect(html).toContain("Action Button");
  });

  test("renders appropriate icons for each semantic state", () => {
    const generatingHtml = renderToStaticMarkup(
      <EmptyState type="generating" />,
    );
    expect(generatingHtml).toContain("spin");

    const noSuccessHtml = renderToStaticMarkup(
      <EmptyState type="no-success" />,
    );
    expect(noSuccessHtml).toContain("alert");

    const defaultHtml = renderToStaticMarkup(<EmptyState type="new-session" />);
    expect(defaultHtml).toContain("placeholder");
  });
});
