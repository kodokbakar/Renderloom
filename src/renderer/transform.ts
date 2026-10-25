const BR_TAG_REGEX = /<\s*\/?\s*br(\s+[^>]*>|\s*\/?>)/gi;

/**
 * Sanitizes and transforms all variations of `<br>` tags (`<br>`, `<br/>`, `<br />`,
 * `<BR>`, attributes, or closing `</br>`) into valid JSX newline expressions `{"\n"}`.
 *
 * This prevents TypeScript JSX parsing errors on unclosed `<br>` tags and avoids
 * Satori layout failures since Satori does not support HTML inline `<br>` elements.
 */
export function sanitizeLineBreaks(jsxSource: string): string {
  if (!jsxSource) return jsxSource;
  return jsxSource.replace(BR_TAG_REGEX, '{"\\n"}');
}

/**
 * Pre-processes raw JSX source code before AST parsing and validation.
 */
export function transformJsx(jsxSource: string): string {
  if (!jsxSource) return jsxSource;
  return sanitizeLineBreaks(jsxSource);
}
