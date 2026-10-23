import ts from "typescript";
import { RenderError } from "../domain/errors";
import { validateAssetSource } from "./assets";
import { ALLOWED_ELEMENTS, type AllowedElement } from "./types";

const DANGEROUS_TAGS: Record<string, true> = {
  script: true,
  style: true,
  iframe: true,
  object: true,
  embed: true,
  frame: true,
  frameset: true,
  link: true,
  meta: true,
  base: true,
};

const ALLOWED_TAGS: Record<string, true> = {
  div: true,
  span: true,
  p: true,
  img: true,
  svg: true,
  path: true,
  rect: true,
  circle: true,
};

export interface ValidatedJsx {
  sourceFile: ts.SourceFile;
  rootElement: ts.JsxElement | ts.JsxSelfClosingElement;
}

export interface ValidatorOptions {
  baseDir?: string;
}

function getTagName(
  element: ts.JsxElement | ts.JsxSelfClosingElement | ts.JsxOpeningElement,
  sourceFile: ts.SourceFile,
): string {
  if (ts.isJsxElement(element)) {
    return element.openingElement.tagName.getText(sourceFile).trim();
  }
  return element.tagName.getText(sourceFile).trim();
}

function validateStyleObject(
  objectLiteral: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
): void {
  for (const property of objectLiteral.properties) {
    if (ts.isSpreadAssignment(property)) {
      throw new RenderError(
        "DANGEROUS_CODE_DETECTED",
        "Spread assignments in style objects are not allowed",
        { code: property.getText(sourceFile) },
      );
    }

    if (!ts.isPropertyAssignment(property)) {
      throw new RenderError(
        "UNSUPPORTED_SYNTAX",
        `Unsupported property type in style object: ${property.getText(sourceFile)}`,
        { code: property.getText(sourceFile) },
      );
    }

    if (ts.isComputedPropertyName(property.name)) {
      throw new RenderError(
        "UNSUPPORTED_SYNTAX",
        "Computed property names in style objects are not allowed",
        { code: property.name.getText(sourceFile) },
      );
    }

    const init = property.initializer;

    if (ts.isCallExpression(init)) {
      throw new RenderError(
        "DANGEROUS_CODE_DETECTED",
        `Function calls in styles are not allowed: ${init.getText(sourceFile)}`,
        { code: init.getText(sourceFile) },
      );
    }

    const isString =
      ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init);
    const isNumber = ts.isNumericLiteral(init);
    const isUnaryNumber =
      ts.isPrefixUnaryExpression(init) &&
      (init.operator === ts.SyntaxKind.PlusToken ||
        init.operator === ts.SyntaxKind.MinusToken) &&
      ts.isNumericLiteral(init.operand);
    const isBoolean =
      init.kind === ts.SyntaxKind.TrueKeyword ||
      init.kind === ts.SyntaxKind.FalseKeyword;

    if (!isString && !isNumber && !isUnaryNumber && !isBoolean) {
      throw new RenderError(
        "UNSUPPORTED_SYNTAX",
        `Dynamic style values are not allowed: ${init.getText(sourceFile)}`,
        { code: init.getText(sourceFile) },
      );
    }
  }
}

function validateAttributes(
  attributes: ts.JsxAttributes,
  sourceFile: ts.SourceFile,
  tagName: string,
  options?: ValidatorOptions,
): void {
  for (const prop of attributes.properties) {
    if (ts.isJsxSpreadAttribute(prop)) {
      throw new RenderError(
        "DANGEROUS_CODE_DETECTED",
        "JSX spread attributes ({...props}) are not allowed",
        { code: prop.getText(sourceFile) },
      );
    }

    const attrName = prop.name.getText(sourceFile).trim();
    const lowerAttrName = attrName.toLowerCase();

    if (lowerAttrName.startsWith("on")) {
      throw new RenderError(
        "DANGEROUS_CODE_DETECTED",
        `Event handlers are not allowed: ${attrName}`,
        { attribute: attrName },
      );
    }

    if (!prop.initializer) {
      continue;
    }

    if (ts.isStringLiteral(prop.initializer)) {
      if (lowerAttrName === "src" && tagName === "img") {
        validateAssetSource(prop.initializer.text, options?.baseDir);
      }
      continue;
    }

    if (ts.isJsxExpression(prop.initializer)) {
      const expr = prop.initializer.expression;
      if (!expr) {
        continue;
      }

      if (lowerAttrName === "style") {
        if (!ts.isObjectLiteralExpression(expr)) {
          throw new RenderError(
            "UNSUPPORTED_SYNTAX",
            "style attribute must be an object literal",
            { code: expr.getText(sourceFile) },
          );
        }
        validateStyleObject(expr, sourceFile);
        continue;
      }

      if (ts.isCallExpression(expr)) {
        throw new RenderError(
          "DANGEROUS_CODE_DETECTED",
          `Function calls in attributes are not allowed: ${expr.getText(sourceFile)}`,
          { code: expr.getText(sourceFile) },
        );
      }

      const isString =
        ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr);
      const isNumber = ts.isNumericLiteral(expr);
      const isUnaryNumber =
        ts.isPrefixUnaryExpression(expr) &&
        (expr.operator === ts.SyntaxKind.PlusToken ||
          expr.operator === ts.SyntaxKind.MinusToken) &&
        ts.isNumericLiteral(expr.operand);
      const isBoolean =
        expr.kind === ts.SyntaxKind.TrueKeyword ||
        expr.kind === ts.SyntaxKind.FalseKeyword;

      if (lowerAttrName === "src" && tagName === "img") {
        if (!isString) {
          throw new RenderError(
            "UNSUPPORTED_SYNTAX",
            "Image src attribute must be a static string literal",
            { code: expr.getText(sourceFile) },
          );
        }
        validateAssetSource(
          ts.isStringLiteral(expr) ? expr.text : expr.text,
          options?.baseDir,
        );
        continue;
      }

      if (!isString && !isNumber && !isUnaryNumber && !isBoolean) {
        throw new RenderError(
          "UNSUPPORTED_SYNTAX",
          `Dynamic attribute expressions are not allowed: ${expr.getText(sourceFile)}`,
          { code: expr.getText(sourceFile) },
        );
      }
      continue;
    }

    throw new RenderError(
      "UNSUPPORTED_SYNTAX",
      `Unsupported attribute initializer: ${prop.initializer.getText(sourceFile)}`,
      { code: prop.initializer.getText(sourceFile) },
    );
  }
}

function validateElement(
  element: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  options?: ValidatorOptions,
): void {
  const tagName = getTagName(element, sourceFile);
  const lowerTag = tagName.toLowerCase();

  if (DANGEROUS_TAGS[lowerTag]) {
    throw new RenderError(
      "DANGEROUS_CODE_DETECTED",
      `<${tagName}> tags are strictly prohibited`,
      { tag: tagName },
    );
  }

  if (!ALLOWED_TAGS[lowerTag]) {
    throw new RenderError(
      "UNSUPPORTED_SYNTAX",
      `Unsupported element <${tagName}>. Allowed elements: ${ALLOWED_ELEMENTS.join(", ")}`,
      { tag: tagName },
    );
  }

  const attributes = ts.isJsxElement(element)
    ? element.openingElement.attributes
    : element.attributes;
  validateAttributes(attributes, sourceFile, lowerTag, options);

  if (ts.isJsxElement(element)) {
    for (const child of element.children) {
      if (ts.isJsxText(child)) {
        continue;
      }

      if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
        validateElement(child, sourceFile, options);
        continue;
      }

      if (ts.isJsxExpression(child)) {
        const expr = child.expression;
        if (!expr) {
          continue;
        }

        if (ts.isCallExpression(expr)) {
          throw new RenderError(
            "DANGEROUS_CODE_DETECTED",
            `Function calls in JSX children are not allowed: ${expr.getText(sourceFile)}`,
            { code: expr.getText(sourceFile) },
          );
        }

        if (ts.isArrowFunction(expr) || ts.isFunctionExpression(expr)) {
          throw new RenderError(
            "DANGEROUS_CODE_DETECTED",
            "Functions are not allowed in JSX children",
            { code: expr.getText(sourceFile) },
          );
        }

        if (ts.isIdentifier(expr)) {
          throw new RenderError(
            "UNSUPPORTED_SYNTAX",
            `Dynamic variables or identifiers in JSX children are not allowed: ${expr.getText(sourceFile)}`,
            { code: expr.getText(sourceFile) },
          );
        }

        const isString =
          ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr);
        const isNumber = ts.isNumericLiteral(expr);

        if (!isString && !isNumber) {
          throw new RenderError(
            "UNSUPPORTED_SYNTAX",
            `Dynamic expressions in JSX children are not allowed: ${expr.getText(sourceFile)}`,
            { code: expr.getText(sourceFile) },
          );
        }
        continue;
      }

      throw new RenderError(
        "UNSUPPORTED_SYNTAX",
        `Unsupported JSX child node type: ${ts.SyntaxKind[child.kind]}`,
        { kind: ts.SyntaxKind[child.kind] },
      );
    }
  }
}

export function validateJsx(
  jsxSource: string,
  options?: ValidatorOptions,
): ValidatedJsx {
  const trimmed = jsxSource.trim();
  if (trimmed.length === 0) {
    throw new RenderError("UNSUPPORTED_SYNTAX", "Empty JSX source");
  }

  const sourceFile = ts.createSourceFile(
    "render-target.tsx",
    trimmed,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  if (sourceFile.statements.length === 0) {
    throw new RenderError(
      "UNSUPPORTED_SYNTAX",
      "No statements found in JSX source",
    );
  }

  // Check for prohibited top-level statements
  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt) || ts.isImportEqualsDeclaration(stmt)) {
      throw new RenderError(
        "DANGEROUS_CODE_DETECTED",
        "Import statements are not allowed in JSX source",
        { code: stmt.getText(sourceFile) },
      );
    }

    if (ts.isFunctionDeclaration(stmt)) {
      throw new RenderError(
        "DANGEROUS_CODE_DETECTED",
        "Function declarations are not allowed in JSX source",
        { code: stmt.getText(sourceFile) },
      );
    }

    if (ts.isClassDeclaration(stmt)) {
      throw new RenderError(
        "DANGEROUS_CODE_DETECTED",
        "Class declarations are not allowed in JSX source",
        { code: stmt.getText(sourceFile) },
      );
    }

    if (ts.isVariableStatement(stmt)) {
      throw new RenderError(
        "DANGEROUS_CODE_DETECTED",
        "Variable declarations are not allowed in JSX source",
        { code: stmt.getText(sourceFile) },
      );
    }
  }

  if (sourceFile.statements.length !== 1) {
    throw new RenderError(
      "UNSUPPORTED_SYNTAX",
      `Expected a single root JSX element, found ${sourceFile.statements.length} statements`,
    );
  }

  const singleStmt = sourceFile.statements[0];
  if (!singleStmt) {
    throw new RenderError("UNSUPPORTED_SYNTAX", "No statement found");
  }

  let expr: ts.Expression | undefined;
  if (ts.isExpressionStatement(singleStmt)) {
    expr = singleStmt.expression;
  } else if (ts.isExportAssignment(singleStmt)) {
    expr = singleStmt.expression;
  } else {
    throw new RenderError(
      "UNSUPPORTED_SYNTAX",
      `Only root JSX expressions or export default are allowed, found: ${ts.SyntaxKind[singleStmt.kind]}`,
    );
  }

  // Unwrap any parentheses around the expression: (<div ...>...</div>)
  while (expr && ts.isParenthesizedExpression(expr)) {
    expr = expr.expression;
  }

  if (!expr) {
    throw new RenderError("UNSUPPORTED_SYNTAX", "Missing root JSX expression");
  }

  if (ts.isJsxFragment(expr)) {
    throw new RenderError(
      "UNSUPPORTED_SYNTAX",
      "Root element must be <div>, fragments not allowed",
    );
  }

  if (!ts.isJsxElement(expr) && !ts.isJsxSelfClosingElement(expr)) {
    throw new RenderError(
      "UNSUPPORTED_SYNTAX",
      `Root statement must be a JSX element, found: ${ts.SyntaxKind[expr.kind]}`,
      { code: expr.getText(sourceFile) },
    );
  }

  const rootTag = getTagName(expr, sourceFile).toLowerCase();
  if (rootTag !== "div") {
    throw new RenderError(
      "UNSUPPORTED_SYNTAX",
      `Root element must be <div>, found <${rootTag}>`,
      { tag: rootTag },
    );
  }

  validateElement(expr, sourceFile, options);

  return {
    sourceFile,
    rootElement: expr,
  };
}
