import { describe, expect, test } from "bun:test";
import { interpretJsx } from "../../src/renderer/interpreter";
import type { VNode } from "../../src/renderer/types";

describe("Trusted AST Interpreter", () => {
  test("converts simple div with inline styles to VNode", async () => {
    const jsx = `
      <div style={{ display: "flex", width: 500, height: 300, backgroundColor: "#0f172a" }}>
        <span>Renderloom</span>
      </div>
    `;

    const vnode = await interpretJsx(jsx);
    expect(vnode.type).toBe("div");
    expect(vnode.props.style).toEqual({
      display: "flex",
      width: 500,
      height: 300,
      backgroundColor: "#0f172a",
    });

    const child = vnode.props.children as VNode;
    expect(child).toBeDefined();
    expect(child.type).toBe("span");
    expect(child.props.children).toBe("Renderloom");
  });

  test("handles negative numeric styles", async () => {
    const jsx = `
      <div style={{ display: "flex", marginTop: -20, zIndex: 10 }}>
        <span>Negative margin</span>
      </div>
    `;

    const vnode = await interpretJsx(jsx);
    expect(vnode.props.style?.marginTop).toBe(-20);
    expect(vnode.props.style?.zIndex).toBe(10);
  });

  test("handles multiple nested children in array", async () => {
    const jsx = `
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span>Title</span>
        <p>Description text</p>
        <span>Footer</span>
      </div>
    `;

    const vnode = await interpretJsx(jsx);
    expect(Array.isArray(vnode.props.children)).toBe(true);
    const children = vnode.props.children as VNode[];
    expect(children.length).toBe(3);
    expect(children[0]?.type).toBe("span");
    expect(children[0]?.props.children).toBe("Title");
    expect(children[1]?.type).toBe("p");
    expect(children[1]?.props.children).toBe("Description text");
    expect(children[2]?.type).toBe("span");
    expect(children[2]?.props.children).toBe("Footer");
  });

  test("interprets SVG elements and attributes", async () => {
    const jsx = `
      <div style={{ display: "flex" }}>
        <svg width={100} height={100} viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={40} fill="#3b82f6" />
          <rect x={10} y={10} width={80} height={80} fill="#ef4444" stroke="#000000" strokeWidth={2} />
          <path d="M 0 0 L 100 100" stroke="#10b981" />
        </svg>
      </div>
    `;

    const vnode = await interpretJsx(jsx);
    const svgNode = vnode.props.children as VNode;
    expect(svgNode.type).toBe("svg");
    expect(svgNode.props.width).toBe(100);
    expect(svgNode.props.height).toBe(100);
    expect(svgNode.props.viewBox).toBe("0 0 100 100");

    const svgChildren = svgNode.props.children as VNode[];
    expect(svgChildren.length).toBe(3);

    expect(svgChildren[0]?.type).toBe("circle");
    expect(svgChildren[0]?.props.cx).toBe(50);
    expect(svgChildren[0]?.props.cy).toBe(50);
    expect(svgChildren[0]?.props.r).toBe(40);
    expect(svgChildren[0]?.props.fill).toBe("#3b82f6");

    expect(svgChildren[1]?.type).toBe("rect");
    expect(svgChildren[1]?.props.x).toBe(10);
    expect(svgChildren[1]?.props.y).toBe(10);
    expect(svgChildren[1]?.props.width).toBe(80);
    expect(svgChildren[1]?.props.height).toBe(80);
    expect(svgChildren[1]?.props.strokeWidth).toBe(2);

    expect(svgChildren[2]?.type).toBe("path");
    expect(svgChildren[2]?.props.d).toBe("M 0 0 L 100 100");
  });

  test("handles self-closing elements without children", async () => {
    const jsx = `
      <div style={{ display: "flex" }}>
        <img src="data:image/png;base64,abc" width={50} height={50} />
      </div>
    `;

    const vnode = await interpretJsx(jsx);
    const imgNode = vnode.props.children as VNode;
    expect(imgNode.type).toBe("img");
    expect(imgNode.props.src).toBe("data:image/png;base64,abc");
    expect(imgNode.props.width).toBe(50);
    expect(imgNode.props.height).toBe(50);
    expect(imgNode.props.children).toBeUndefined();
  });
});
