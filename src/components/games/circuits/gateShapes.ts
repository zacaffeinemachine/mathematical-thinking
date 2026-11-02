// Gate shapes and colours, shared by CircuitDiagram.tsx and by the problem
// components in problems/. Change a shape here and every circuit on the
// site changes with it.
//
// A gate is drawn in its own frame: the anchor (0, 0) is the middle of the
// gate's left edge, and the body extends to the right. That is the meaning
// of a gate's (x, y) in model.ts.

import type { GateType } from "./model";

// Standard gate dimensions.
export const GW = 56;     // gate body width
export const GH = 36;     // gate body height
export const NOT_W = 36;
export const NOT_H = 28;

// Gate fills come from CSS variables so they swap on dark/light theme.
export const GATE_FILL: Record<GateType, string> = {
  NOT:  "var(--gate-not)",
  AND:  "var(--gate-and)",
  OR:   "var(--gate-or)",
  XOR:  "var(--gate-xor)",
  NAND: "var(--gate-nand)",
  NOR:  "var(--gate-nor)",
};
export const GATE_INK = "var(--gate-ink)";
export const WIRE_ON = "var(--gate-wire-on)";
export const WIRE_OFF = "var(--gate-wire-off)";

// Body path for a gate of the given size. The defaults give the standard
// two-input gate (or the standard NOT).
export function gatePathSized(type: GateType, w: number, h: number): string {
  switch (type) {
    case "NOT":
      // triangle pointing right; bubble drawn separately
      return `M 0 ${-h / 2} L ${w} 0 L 0 ${h / 2} Z`;
    case "AND":
    case "NAND": {
      // Flat-back D: rectangle on left, semicircle on right
      const r = h / 2;
      const flatW = w - r;
      return `M 0 ${-r} L ${flatW} ${-r} A ${r} ${r} 0 0 1 ${flatW} ${r} L 0 ${r} Z`;
    }
    case "OR":
    case "NOR":
    case "XOR": {
      // Shield with a curved back and a pointed nose
      return `
        M 0 ${-h / 2}
        Q ${w * 0.25} 0 0 ${h / 2}
        Q ${w * 0.55} ${h / 2} ${w} 0
        Q ${w * 0.55} ${-h / 2} 0 ${-h / 2}
        Z
      `;
    }
  }
}

export function gatePath(type: GateType): string {
  return type === "NOT"
    ? gatePathSized(type, NOT_W, NOT_H)
    : gatePathSized(type, GW, GH);
}

export function hasBubble(type: GateType): boolean {
  return type === "NOT" || type === "NAND" || type === "NOR";
}

// XOR gets an extra back-curve drawn behind the OR shield
export function xorBackPathSized(w: number, h: number): string {
  return `M -8 ${-h / 2} Q ${w * 0.25 - 8} 0 -8 ${h / 2}`;
}

export function xorBackPath(): string {
  return xorBackPathSized(GW, GH);
}

// How far right of x = 0 the curved back of an OR-family gate sits at
// height y. The back is a quadratic Bezier whose y is linear in t, so this
// is exact. Used to run an input stub right up to the body.
export function orBackX(w: number, h: number, y: number): number {
  const t = y / h + 0.5;
  return 2 * t * (1 - t) * w * 0.25;
}
