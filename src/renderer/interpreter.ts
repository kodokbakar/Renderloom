import ts from "typescript";
import { resolveAssetToDataUri } from "./assets";
import type { VNode, VNodeChild, VNodeProps } from "./types";
import { type ValidatedJsx, validateJsx } from "./validator";

export interface InterpreterOptions {
  baseDir?: string;
}

function normalizeJsxText(rawText: string): string | null {
  const lines = rawText.split(/\r?\n/);
  const normalizedLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      normalizedLines.push(trimmed);
    }
  }
  if (normalizedLines.length === 0) {
    return null;
  }
  return normalizedLines.join(" ");
}

function parseStyleObject(
  objectLiteral: ts.ObjectLiteralExpression,
  sourceFile: ts.SourceFile,
): Record<string, string | number> {
  const style: Record<string, string | number> = {};

  for (const prop of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(prop)) {
      continue;
    }

    const key = prop.name.getText(sourceFile).trim();
    const init = prop.initializer;

    if (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) {
      style[key] = init.text;
    } else if (ts.isNumericLiteral(init)) {
      style[key] = Number(init.text);
    } else if (ts.isPrefixUnaryExpression(init)) {
      const sign = init.operator === ts.SyntaxKind.MinusToken ? -1 : 1;
      style[key] = sign * Number(init.operand.getText(sourceFile));
    }
  }

  return style;
}

async function convertElementToVNode(
  element: ts.JsxElement | ts.JsxSelfClosingElement,
  sourceFile: ts.SourceFile,
  options?: InterpreterOptions,
): Promise<VNode> {
  const isElement = ts.isJsxElement(element);
  const tagName = isElement
    ? element.openingElement.tagName.getText(sourceFile).trim().toLowerCase()
    : element.tagName.getText(sourceFile).trim().toLowerCase();

  const attributes = isElement
    ? element.openingElement.attributes
    : element.attributes;

  const props: VNodeProps = {};

  for (const prop of attributes.properties) {
    if (!ts.isJsxAttribute(prop)) {
      continue;
    }

    const attrName = prop.name.getText(sourceFile).trim();

    if (!prop.initializer) {
      props[attrName] = true;
      continue;
    }

    if (ts.isStringLiteral(prop.initializer)) {
      const rawVal = prop.initializer.text;
      if (attrName.toLowerCase() === "src" && tagName === "img") {
        props[attrName] = await resolveAssetToDataUri(rawVal, options?.baseDir);
      } else {
        props[attrName] = rawVal;
      }
      continue;
    }

    if (ts.isJsxExpression(prop.initializer)) {
      const expr = prop.initializer.expression;
      if (!expr) {
        continue;
      }

      if (attrName.toLowerCase() === "style") {
        if (ts.isObjectLiteralExpression(expr)) {
          props.style = parseStyleObject(expr, sourceFile);
        }
        continue;
      }

      if (
        ts.isStringLiteral(expr) ||
        ts.isNoSubstitutionTemplateLiteral(expr)
      ) {
        if (attrName.toLowerCase() === "src" && tagName === "img") {
          props[attrName] = await resolveAssetToDataUri(
            expr.text,
            options?.baseDir,
          );
        } else {
          props[attrName] = expr.text;
        }
        continue;
      }

      if (ts.isNumericLiteral(expr)) {
        props[attrName] = Number(expr.text);
        continue;
      }

      if (ts.isPrefixUnaryExpression(expr)) {
        const sign = expr.operator === ts.SyntaxKind.MinusToken ? -1 : 1;
        props[attrName] = sign * Number(expr.operand.getText(sourceFile));
        continue;
      }

      if (expr.kind === ts.SyntaxKind.TrueKeyword) {
        props[attrName] = true;
        continue;
      }

      if (expr.kind === ts.SyntaxKind.FalseKeyword) {
        props[attrName] = false;
      }
    }
  }

  if (isElement) {
    const children: VNodeChild[] = [];

    for (const child of element.children) {
      if (ts.isJsxText(child)) {
        const normalized = normalizeJsxText(child.text);
        if (normalized !== null) {
          children.push(normalized);
        }
        continue;
      }

      if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
        const childVNode = await convertElementToVNode(
          child,
          sourceFile,
          options,
        );
        children.push(childVNode);
        continue;
      }

      if (ts.isJsxExpression(child)) {
        const expr = child.expression;
        if (!expr) {
          continue;
        }

        if (
          ts.isStringLiteral(expr) ||
          ts.isNoSubstitutionTemplateLiteral(expr)
        ) {
          children.push(expr.text);
          continue;
        }

        if (ts.isNumericLiteral(expr)) {
          children.push(Number(expr.text));
        }
      }
    }

    if (children.length === 1) {
      const firstChild = children[0];
      if (firstChild !== undefined) {
        props.children = firstChild;
      }
    } else if (children.length > 1) {
      props.children = children;
    }
  }

  return {
    type: tagName,
    props,
  };
}

export async function interpretJsx(
  input: string | ValidatedJsx,
  options?: InterpreterOptions,
): Promise<VNode> {
  const validated =
    typeof input === "string" ? validateJsx(input, options) : input;

  return convertElementToVNode(
    validated.rootElement,
    validated.sourceFile,
    options,
  );
}
