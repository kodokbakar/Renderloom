export type TokenType =
  | "tag"
  | "attr"
  | "string"
  | "keyword"
  | "comment"
  | "number"
  | "punctuation"
  | "text";

export interface Token {
  type: TokenType;
  value: string;
}
const JS_KEYWORDS: Record<string, true> = {
  import: true,
  export: true,
  default: true,
  function: true,
  const: true,
  let: true,
  var: true,
  return: true,
  from: true,
  if: true,
  else: true,
  switch: true,
  case: true,
  break: true,
  try: true,
  catch: true,
  finally: true,
  true: true,
  false: true,
  null: true,
  undefined: true,
  async: true,
  await: true,
  typeof: true,
  interface: true,
  type: true,
};

export function tokenizeJsxOrSvg(
  code: string,
  language: "jsx" | "svg",
): Token[] {
  if (!code) return [];

  const tokens: Token[] = [];
  let pos = 0;
  const len = code.length;

  while (pos < len) {
    const rest = code.slice(pos);

    // 1. Comments
    // XML/HTML/SVG comment <!-- ... -->
    if (rest.startsWith("<!--")) {
      const end = rest.indexOf("-->");
      const comment = end !== -1 ? rest.slice(0, end + 3) : rest;
      tokens.push({ type: "comment", value: comment });
      pos += comment.length;
      continue;
    }

    // JS block comment /* ... */
    if (language === "jsx" && rest.startsWith("/*")) {
      const end = rest.indexOf("*/");
      const comment = end !== -1 ? rest.slice(0, end + 2) : rest;
      tokens.push({ type: "comment", value: comment });
      pos += comment.length;
      continue;
    }

    // JS line comment // ...
    if (language === "jsx" && rest.startsWith("//")) {
      const nextNewline = rest.indexOf("\n");
      const comment = nextNewline !== -1 ? rest.slice(0, nextNewline) : rest;
      tokens.push({ type: "comment", value: comment });
      pos += comment.length;
      continue;
    }

    // 2. Strings ("...", '...', `...`)
    const quote = rest[0];
    if (
      quote === '"' ||
      quote === "'" ||
      (language === "jsx" && quote === "`")
    ) {
      let i = 1;
      let escaped = false;
      while (i < rest.length) {
        const c = rest[i];
        if (escaped) {
          escaped = false;
        } else if (c === "\\") {
          escaped = true;
        } else if (c === quote) {
          i++;
          break;
        }
        i++;
      }
      const strVal = rest.slice(0, i);
      tokens.push({ type: "string", value: strVal });
      pos += strVal.length;
      continue;
    }

    // 3. Tags: <tag, </tag, />, >
    const tagMatch = rest.match(
      /^(<\/[a-zA-Z][a-zA-Z0-9_.:-]*>|<[a-zA-Z][a-zA-Z0-9_.:-]*|\/?>)/,
    );
    if (tagMatch?.[1]) {
      tokens.push({ type: "tag", value: tagMatch[1] });
      pos += tagMatch[1].length;
      continue;
    }

    // 4. Attribute names (followed by =)
    const attrMatch = rest.match(/^([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?=\s*=)/);
    if (attrMatch?.[1]) {
      tokens.push({ type: "attr", value: attrMatch[1] });
      pos += attrMatch[1].length;
      continue;
    }

    // 5. Numbers
    const numMatch = rest.match(/^\b\d+(?:\.\d+)?(?:px|%|rem|em|deg)?\b/);
    if (numMatch?.[0]) {
      tokens.push({ type: "number", value: numMatch[0] });
      pos += numMatch[0].length;
      continue;
    }
    // 6. Keywords (for JSX) or Word identifier
    const wordMatch = rest.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
    if (wordMatch?.[0]) {
      const word = wordMatch[0];
      if (language === "jsx" && JS_KEYWORDS[word]) {
        tokens.push({ type: "keyword", value: word });
      } else {
        tokens.push({ type: "text", value: word });
      }
      pos += word.length;
      continue;
    }

    // 7. Punctuation
    const punctMatch = rest.match(/^[{}()[\];,=+\-*/&|!?:.]/);
    if (punctMatch?.[0]) {
      tokens.push({ type: "punctuation", value: punctMatch[0] });
      pos += punctMatch[0].length;
      continue;
    }

    // 8. Whitespace or single unhandled character
    const wsMatch = rest.match(/^\s+/);
    if (wsMatch?.[0]) {
      tokens.push({ type: "text", value: wsMatch[0] });
      pos += wsMatch[0].length;
      continue;
    }

    // Fallback: 1 char
    tokens.push({ type: "text", value: rest[0] ?? "" });
    pos++;
  }

  return tokens;
}

export function tokenizeLines(
  code: string,
  language: "jsx" | "svg",
): Token[][] {
  const tokens = tokenizeJsxOrSvg(code, language);
  const lines: Token[][] = [[]];

  for (const token of tokens) {
    if (!token.value.includes("\n")) {
      const currentLine = lines[lines.length - 1];
      if (currentLine) {
        currentLine.push(token);
      }
      continue;
    }

    // Token contains newlines (e.g. multi-line string or comment or whitespace)
    const parts = token.value.split("\n");
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i > 0) {
        lines.push([]);
      }
      if (part && part.length > 0) {
        const currentLine = lines[lines.length - 1];
        if (currentLine) {
          currentLine.push({ type: token.type, value: part });
        }
      }
    }
  }

  return lines;
}
