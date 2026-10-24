export const ALLOWED_ELEMENTS = [
  "div",
  "span",
  "p",
  "img",
  "svg",
  "path",
  "rect",
  "circle",
] as const;

export type AllowedElement = (typeof ALLOWED_ELEMENTS)[number];

export type VNodeChild = VNode | string | number | null | undefined;

export interface VNodeProps {
  style?: Record<string, string | number | undefined>;
  children?: VNodeChild | VNodeChild[];
  src?: string;
  width?: string | number;
  height?: string | number;
  viewBox?: string;
  d?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: string | number;
  cx?: string | number;
  cy?: string | number;
  r?: string | number;
  x?: string | number;
  y?: string | number;
  rx?: string | number;
  ry?: string | number;
  xmlns?: string;
  [key: string]: unknown;
}

export interface VNode {
  type: AllowedElement | string;
  props: VNodeProps;
}

export type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
export type FontStyle = "normal" | "italic";

export interface FontConfig {
  name: string;
  data: ArrayBuffer;
  weight?: FontWeight;
  style?: FontStyle;
}

export interface RenderOptions {
  width: number;
  height: number;
  fonts?: FontConfig[];
  baseDir?: string;
  timeoutMs?: number;
}

export interface RenderResult {
  svg: string;
  png: Buffer;
  width: number;
  height: number;
}
