// Geometry shared by every problem component: where a gate's pins are, how
// big a switch or a bulb is, how a wire is drawn, and the automatic layout of
// a fixed circuit whose author left the coordinates out.
//
// Coordinates follow model.ts: a switch's (x, y) is its centre, a gate's
// (x, y) is the middle of its left edge, a bulb's (x, y) is the centre of its
// glass. Pure TypeScript, so the tests can import it.

import type { Circuit, CircuitSpec, GateType } from "../model.ts";
import { GW, GH, NOT_W, NOT_H } from "../gateShapes.ts";
import { topoOrder, netOf } from "./engine.ts";

// ---- sizes ---------------------------------------------------------------

export const SWITCH_W = 18;    // switch body
export const SWITCH_H = 30;
export const SWITCH_PIN = 20;  // switch output pin, right of centre
export const BULB_R = 10;      // bulb glass radius
export const BULB_PIN = 22;    // bulb input pin, left of centre
export const PIN_STUB = 8;     // gate pin stub length

export function gateSize(type: GateType, n: number): { w: number; h: number } {
  if (type === "NOT") return { w: NOT_W, h: NOT_H };
  if (n <= 2) return { w: GW, h: GH };
  const h = Math.max(GH, 14 * n + 8);
  return { w: GW + (h - GH) * 0.5, h };
}

// Relative to the gate anchor.
export function gateInputPin(type: GateType, n: number, idx: number): { x: number; y: number } {
  const { h } = gateSize(type, n);
  const x = type === "XOR" ? -PIN_STUB - 6 : -PIN_STUB;
  if (type === "NOT" || n <= 1) return { x, y: 0 };
  if (n === 2) return { x, y: (idx === 0 ? -1 : 1) * GH * 0.28 };
  return { x, y: -h / 2 + (h * (idx + 1)) / (n + 1) };
}

export function gateOutputPin(type: GateType, n: number): { x: number; y: number } {
  const { w } = gateSize(type, n);
  const bubble = type === "NOT" || type === "NAND" || type === "NOR" ? 6 : 0;
  return { x: w + bubble + PIN_STUB, y: 0 };
}

// ---- boxes ---------------------------------------------------------------
//
// A box is a rectangle with a title band on top, input pins down its left
// edge and output pins down its right edge. Its anchor is the middle of its
// left edge, as for a gate. `gap` is the number of pins after which a small
// space is left on the input side (an adder leaves one between the two
// numbers), or 0 for none.

export const BOX_W = 96;
export const BOX_TITLE = 20;
export const BOX_PIN_GAP = 22;
export const BOX_SPLIT = 10;

export function boxSize(nIn: number, nOut: number, gap = 0): { w: number; h: number } {
  const inH = nIn * BOX_PIN_GAP + (gap > 0 && gap < nIn ? BOX_SPLIT : 0);
  return { w: BOX_W, h: BOX_TITLE + Math.max(inH, nOut * BOX_PIN_GAP) + 8 };
}

// Relative to the box anchor.
export function boxInputPin(nIn: number, nOut: number, gap: number, idx: number): { x: number; y: number } {
  const { h } = boxSize(nIn, nOut, gap);
  const inH = nIn * BOX_PIN_GAP + (gap > 0 && gap < nIn ? BOX_SPLIT : 0);
  const top = -h / 2 + BOX_TITLE + (h - BOX_TITLE - 8 - inH) / 2 + 4;
  const split = gap > 0 && idx >= gap ? BOX_SPLIT : 0;
  return { x: -PIN_STUB, y: top + BOX_PIN_GAP * (idx + 0.5) + split };
}

export function boxOutputPin(nIn: number, nOut: number, gap: number, idx: number): { x: number; y: number } {
  const { h } = boxSize(nIn, nOut, gap);
  const outH = nOut * BOX_PIN_GAP;
  const top = -h / 2 + BOX_TITLE + (h - BOX_TITLE - 8 - outH) / 2 + 4;
  return { x: BOX_W + PIN_STUB, y: top + BOX_PIN_GAP * (idx + 0.5) };
}

// ---- wires ---------------------------------------------------------------

// A smooth S-curve from a source pin to a sink pin.
export function wirePath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(18, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

// Points along that curve, for hit-testing and for placing a delete badge.
export function wirePoint(x1: number, y1: number, x2: number, y2: number, t: number): { x: number; y: number } {
  const dx = Math.max(18, Math.abs(x2 - x1) * 0.45);
  const u = 1 - t;
  const bx = u * u * u * x1 + 3 * u * u * t * (x1 + dx) + 3 * u * t * t * (x2 - dx) + t * t * t * x2;
  const by = u * u * u * y1 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y2;
  return { x: bx, y: by };
}

export function distToWire(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  let best = Infinity;
  for (let i = 0; i <= 24; i++) {
    const p = wirePoint(x1, y1, x2, y2, i / 24);
    best = Math.min(best, Math.hypot(p.x - px, p.y - py));
  }
  return best;
}

// ---- wires that go round gates ------------------------------------------------
//
// A wire in a drawn circuit is a single S-curve, and nothing stopped it
// passing behind a gate it has nothing to do with: a switch wire skipping a
// column ran straight through the NOT fed by the same switch, and looked like
// that NOT's input or output. routeWire keeps the S-curve when it is clear,
// and otherwise sends the wire through a free lane above or below each gate in
// its way, as a straight run past the gate, joined by S-curves.

export interface Box { x0: number; x1: number; y0: number; y1: number }

// The body of a gate, bubble included, as an obstacle.
export function gateBox(g: { type: GateType; inputs: unknown[]; x: number; y: number }): Box {
  const { w, h } = gateSize(g.type, g.inputs.length);
  const bubble = g.type === "NOT" || g.type === "NAND" || g.type === "NOR" ? 7 : 0;
  return { x0: g.x - (g.type === "XOR" ? 7 : 1), x1: g.x + w + bubble, y0: g.y - h / 2, y1: g.y + h / 2 };
}

type Seg = { kind: "curve" | "line"; x1: number; y1: number; x2: number; y2: number };
const curveAt = (q: Seg, t: number) => {
  if (q.kind === "line") return { x: q.x1 + (q.x2 - q.x1) * t, y: q.y1 + (q.y2 - q.y1) * t };
  return wirePoint(q.x1, q.y1, q.x2, q.y2, t);
};
const hits = (segs: Seg[], boxes: Box[], pad: number) => {
  for (const q of segs) for (let k = 1; k < 32; k++) {
    const p = curveAt(q, k / 32);
    for (const b of boxes) if (p.x > b.x0 - pad && p.x < b.x1 + pad && p.y > b.y0 - pad && p.y < b.y1 + pad) return b;
  }
  return null;
};

// The pieces of a wire from (x1, y1) to (x2, y2) that keeps out of `boxes`
// (the gates other than its own two ends), staying between `top` and `bottom`.
export function routeSegments(x1: number, y1: number, x2: number, y2: number, boxes: Box[], top = -Infinity, bottom = Infinity): Seg[] {
  const straight: Seg[] = [{ kind: "curve", x1, y1, x2, y2 }];
  if (x2 < x1 + 30 || !hits(straight, boxes, 1)) return straight;
  const LANE = 9, GAP = 7;
  const segs: Seg[] = [];
  let cx = x1, cy = y1;
  for (let guard = 0; guard < 12; guard++) {
    const rest: Seg[] = [{ kind: "curve", x1: cx, y1: cy, x2, y2 }];
    const hit = hits(rest, boxes.filter((b) => b.x0 > cx - 1), 1);
    if (!hit) { segs.push(...rest); return segs; }
    // Every gate that overlaps the hit gate left to right is passed together.
    let x0 = hit.x0, x1b = hit.x1;
    for (let grew = true; grew;) {
      grew = false;
      for (const b of boxes) if (b.x1 > x0 - GAP && b.x0 < x1b + GAP && (b.x0 < x0 || b.x1 > x1b)) { x0 = Math.min(x0, b.x0); x1b = Math.max(x1b, b.x1); grew = true; }
    }
    const group = boxes.filter((b) => b.x1 > x0 - GAP && b.x0 < x1b + GAP);
    const mid = (x0 + x1b) / 2;
    const ideal = cy + ((y2 - cy) * (mid - cx)) / Math.max(1, x2 - cx);
    const free = (y: number) => y > top && y < bottom && group.every((b) => y <= b.y0 - LANE + 0.5 || y >= b.y1 + LANE - 0.5);
    const lanes = [ideal, ...group.flatMap((b) => [b.y0 - LANE, b.y1 + LANE])].filter(free);
    if (!lanes.length || x0 - GAP <= cx) { segs.push(...rest); return segs; }
    const lane = lanes.reduce((a, b) => (Math.abs(b - ideal) < Math.abs(a - ideal) ? b : a));
    const ex = Math.min(x1b + GAP, x2 - 12);
    segs.push({ kind: "curve", x1: cx, y1: cy, x2: x0 - GAP, y2: lane });
    segs.push({ kind: "line", x1: x0 - GAP, y1: lane, x2: ex, y2: lane });
    cx = ex; cy = lane;
    if (cx >= x2 - 12) break;
  }
  segs.push({ kind: "curve", x1: cx, y1: cy, x2, y2 });
  return segs;
}

export function segmentsPath(segs: Seg[]): string {
  return segs.map((q, k) => {
    const head = k === 0 ? `M ${q.x1} ${q.y1} ` : "";
    if (q.kind === "line") return `${head}L ${q.x2} ${q.y2}`;
    const dx = Math.max(18, Math.abs(q.x2 - q.x1) * 0.45);
    return `${head}C ${q.x1 + dx} ${q.y1}, ${q.x2 - dx} ${q.y2}, ${q.x2} ${q.y2}`;
  }).join(" ");
}

// Points along a routed wire, for tests.
export function segmentsPoints(segs: Seg[], per = 32): { x: number; y: number }[] {
  return segs.flatMap((q) => Array.from({ length: per + 1 }, (_, k) => curveAt(q, k / per)));
}



export function sourcePin(c: Circuit, id: string): { x: number; y: number } | null {
  const inp = c.inputs.find((i) => i.id === id);
  if (inp) return { x: inp.x + SWITCH_PIN, y: inp.y };
  const g = c.gates.find((g) => g.id === id);
  if (g) {
    const p = gateOutputPin(g.type, g.inputs.length);
    return { x: g.x + p.x, y: g.y + p.y };
  }
  return null;
}

// ---- automatic layout ----------------------------------------------------

const has = (n: { x?: number; y?: number }) => typeof n.x === "number" && typeof n.y === "number";
const textW = (s: string, size = 13) => s.length * size * 0.62;

// Give every node coordinates. If the spec already places every node, those
// coordinates are kept and only width / height are filled in if missing. If
// any node lacks coordinates, the whole circuit is laid out afresh: switches
// in a column on the left, each gate one column right of the deepest thing
// feeding it, bulbs on the right, and each node as close as possible to the
// height of whatever feeds it.
export function layoutCircuit(spec: CircuitSpec): Circuit {
  const inLabel = (i: CircuitSpec["inputs"][number]) => i.label ?? i.id;
  const outLabel = (o: CircuitSpec["outputs"][number]) => o.label ?? o.id;

  const placed = spec.inputs.every(has) && spec.gates.every(has) && spec.outputs.every(has);
  if (placed) {
    const inputs = spec.inputs.map((i) => ({ id: i.id, label: inLabel(i), x: i.x!, y: i.y! }));
    const gates = spec.gates.map((g) => ({ id: g.id, type: g.type, inputs: [...g.inputs], x: g.x!, y: g.y!, label: g.label }));
    const outputs = spec.outputs.map((o) => ({ id: o.id, label: outLabel(o), source: o.source, x: o.x!, y: o.y! }));
    let w = 0, h = 0;
    for (const i of inputs) { w = Math.max(w, i.x + 40); h = Math.max(h, i.y + 26); }
    for (const g of gates) { const s = gateSize(g.type, g.inputs.length); w = Math.max(w, g.x + s.w + 30); h = Math.max(h, g.y + s.h / 2 + 22); }
    for (const o of outputs) { w = Math.max(w, o.x + 20 + textW(o.label)); h = Math.max(h, o.y + 26); }
    return { width: spec.width ?? Math.ceil(w), height: spec.height ?? Math.ceil(h), inputs, gates, outputs };
  }

  const order = topoOrder(netOf(spec));
  if (!order) throw new Error("layoutCircuit: the circuit has a loop.");
  const gateById = new Map(spec.gates.map((g) => [g.id, g]));

  // Columns.
  const col: Record<string, number> = {};
  for (const i of spec.inputs) col[i.id] = 0;
  for (const g of order) {
    let m = 0;
    for (const s of g.inputs) if (s != null && col[s] !== undefined) m = Math.max(m, col[s]);
    col[g.id] = m + 1;
  }
  const lastGateCol = Math.max(0, ...order.map((g) => col[g.id]));

  const labelW = Math.max(8, ...spec.inputs.map((i) => textW(inLabel(i))));
  const switchX = Math.ceil(labelW + 22 + SWITCH_W / 2);
  const firstGateX = switchX + SWITCH_PIN + 34;
  const COL_W = 116;
  const gateX = (c: number) => firstGateX + (c - 1) * COL_W;
  const TOP = 34;

  const y: Record<string, number> = {};
  const IN_GAP = 56;
  spec.inputs.forEach((inp, k) => { y[inp.id] = TOP + k * IN_GAP; });

  // Place one column of nodes: ideal heights first, then push apart.
  const placeColumn = (ids: string[], ideal: Record<string, number>, gap: (id: string) => number) => {
    const sorted = [...ids].sort((p, q) => ideal[p] - ideal[q] || ids.indexOf(p) - ids.indexOf(q));
    const pos: number[] = [];
    sorted.forEach((id, k) => {
      let p = ideal[id];
      if (k > 0) p = Math.max(p, pos[k - 1] + (gap(sorted[k - 1]) + gap(id)) / 2);
      pos.push(p);
    });
    // Shift the whole block so that, on average, nodes sit at their ideal
    // height, but never above the top margin.
    let shift = sorted.reduce((t, id, k) => t + ideal[id] - pos[k], 0) / Math.max(1, sorted.length);
    if (sorted.length && pos[0] + shift < TOP) shift = TOP - pos[0];
    sorted.forEach((id, k) => { y[id] = Math.round(pos[k] + shift); });
  };

  const gateGap = (id: string) => {
    const g = gateById.get(id)!;
    return Math.max(60, gateSize(g.type, g.inputs.length).h + 26);
  };
  for (let c = 1; c <= lastGateCol; c++) {
    const ids = order.filter((g) => col[g.id] === c).map((g) => g.id);
    const ideal: Record<string, number> = {};
    for (const id of ids) {
      const srcs = gateById.get(id)!.inputs.filter((s): s is string => s != null && y[s] !== undefined);
      ideal[id] = srcs.length ? srcs.reduce((a, s) => a + y[s], 0) / srcs.length : TOP;
    }
    placeColumn(ids, ideal, gateGap);
  }

  // Bulbs: one column right of the last gate.
  const lastGateRight = lastGateCol === 0
    ? switchX + SWITCH_PIN
    : Math.max(...order.filter((g) => col[g.id] === lastGateCol).map((g) => gateX(lastGateCol) + gateOutputPin(g.type, g.inputs.length).x));
  const bulbX = lastGateRight + 30 + BULB_PIN;
  const outIdeal: Record<string, number> = {};
  for (const o of spec.outputs) outIdeal["out:" + o.id] = y[o.source] ?? TOP;
  const outIds = spec.outputs.map((o) => "out:" + o.id);
  placeColumn(outIds, outIdeal, () => 54);

  const inputs = spec.inputs.map((i) => ({ id: i.id, label: inLabel(i), x: switchX, y: y[i.id] }));
  const gates = spec.gates.map((g) => ({ id: g.id, type: g.type, inputs: [...g.inputs], label: g.label, x: gateX(col[g.id]), y: y[g.id] }));
  const outputs = spec.outputs.map((o) => ({ id: o.id, label: outLabel(o), source: o.source, x: bulbX, y: y["out:" + o.id] }));

  let h = 0;
  for (const i of inputs) h = Math.max(h, i.y + SWITCH_H / 2 + 16);
  for (const g of gates) h = Math.max(h, g.y + gateSize(g.type, g.inputs.length).h / 2 + (g.label ? 26 : 16));
  for (const o of outputs) h = Math.max(h, o.y + 26);
  const w = bulbX + BULB_R + 10 + Math.max(...outputs.map((o) => textW(o.label)), 0) + 12;
  return { width: spec.width ?? Math.ceil(w), height: spec.height ?? Math.ceil(h), inputs, gates, outputs };
}
