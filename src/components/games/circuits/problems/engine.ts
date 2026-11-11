// The exact machinery behind every circuit problem: evaluation, size and
// depth, truth tables, targets and the check. Pure TypeScript with no React
// and no browser, so tests/circuit-problems.test.ts can run it under plain
// Node. Every check here walks the complete truth table. Nothing samples.
//
// Imports carry their .ts extension so Node's --experimental-strip-types can
// load this file directly. Vite is happy either way.

import type { Bit, GateType } from "../model.ts";
import { evalGateN } from "../model.ts";

export type { Bit, GateType };

export const ALL_GATES: GateType[] = ["NOT", "AND", "OR", "XOR", "NAND", "NOR"];

// ---------------------------------------------------------------------------
//  The net: a circuit with the drawing stripped off.
// ---------------------------------------------------------------------------

// One gate. A pin that has no wire yet holds null.
//
// A box (a part with several output wires, such as a sealed adder) enters the
// net as one NetGate per output wire, each reading all of the box's pins. Such
// a node carries `lut`, its output column over its inputs in the usual row
// order (first input slowest), and `part`, the id of the box on the canvas.
// Its `type` is then ignored. Box nodes are not gates: they do not count
// toward size, type limits or fan-in. See boxCount and boxesUsed.
export interface NetGate {
  id: string;
  type: GateType;
  inputs: (string | null)[];
  lut?: Bit[];
  part?: string;
}

export interface Net {
  inputs: string[];                                   // switch ids, in table order
  gates: NetGate[];                                   // any order
  outputs: { id: string; source: string | null }[];   // bulb ids, in table order
}

// Anything with the CircuitSpec shape converts to a net.
export function netOf(c: {
  inputs: { id: string }[];
  gates: { id: string; type: GateType; inputs: (string | null)[] }[];
  outputs: { id: string; source: string | null }[];
}): Net {
  return {
    inputs: c.inputs.map((i) => i.id),
    gates: c.gates.map((g) => ({ id: g.id, type: g.type, inputs: [...g.inputs] })),
    outputs: c.outputs.map((o) => ({ id: o.id, source: o.source })),
  };
}

// ---------------------------------------------------------------------------
//  Order, evaluation, size, depth.
// ---------------------------------------------------------------------------

// Gates in an order where every gate comes after the gates feeding it.
// Returns null if the gates contain a loop. A source that is neither an input
// nor a gate is treated as an empty pin.
export function topoOrder(net: Net): NetGate[] | null {
  const byId = new Map(net.gates.map((g) => [g.id, g]));
  const state = new Map<string, 1 | 2>(); // 1 = on the stack, 2 = done
  const out: NetGate[] = [];
  let loop = false;
  const visit = (g: NetGate) => {
    const s = state.get(g.id);
    if (s === 2) return;
    if (s === 1) { loop = true; return; }
    state.set(g.id, 1);
    for (const src of g.inputs) {
      const h = src == null ? undefined : byId.get(src);
      if (h) visit(h);
      if (loop) return;
    }
    state.set(g.id, 2);
    out.push(g);
  };
  for (const g of net.gates) {
    visit(g);
    if (loop) return null;
  }
  return out;
}

// Value of every node (switch and gate) for one setting of the switches.
// A gate with an empty pin, or fed by such a gate, has no value (undefined).
export function evaluateNet(net: Net, setting: Record<string, Bit>): Record<string, Bit | undefined> {
  const v: Record<string, Bit | undefined> = {};
  for (const id of net.inputs) v[id] = setting[id] ?? 0;
  const order = topoOrder(net);
  if (!order) return v;
  for (const g of order) {
    const bits: Bit[] = [];
    let floating = g.inputs.length === 0;
    for (const src of g.inputs) {
      const b = src == null ? undefined : v[src];
      if (b === undefined) { floating = true; break; }
      bits.push(b);
    }
    v[g.id] = floating ? undefined : g.lut ? g.lut[bits.reduce<number>((r, b) => (r << 1) | b, 0)] : evalGateN(g.type, bits);
  }
  return v;
}

// What each bulb shows for one setting (undefined if it is not wired up).
export function outputsOf(net: Net, setting: Record<string, Bit>): Record<string, Bit | undefined> {
  const v = evaluateNet(net, setting);
  const r: Record<string, Bit | undefined> = {};
  for (const o of net.outputs) r[o.id] = o.source == null ? undefined : v[o.source];
  return r;
}

// Depth of every node: a switch is 0, a gate is one more than the deepest
// gate feeding it. A box counts as one step, like a gate. Empty pins count as 0. Undefined if the net has a loop.
export function nodeDepths(net: Net): Record<string, number> | undefined {
  const order = topoOrder(net);
  if (!order) return undefined;
  const d: Record<string, number> = {};
  for (const id of net.inputs) d[id] = 0;
  for (const g of order) {
    let m = 0;
    for (const src of g.inputs) if (src != null && d[src] !== undefined) m = Math.max(m, d[src]);
    d[g.id] = m + 1;
  }
  return d;
}

// The depth of the circuit, as the book defines it: the largest number of
// gates lying one behind another on a path from a switch to a bulb. Every
// gate counts, NOT included. Bulbs that are not wired up are ignored.
export function circuitDepth(net: Net): number {
  const d = nodeDepths(net);
  if (!d) return 0;
  let m = 0;
  for (const o of net.outputs) if (o.source != null && d[o.source] !== undefined) m = Math.max(m, d[o.source]);
  return m;
}

// The size of the circuit: every gate counts, NOT included, and so does a
// gate that is not wired to any bulb. A gate on the canvas is a gate built.
// Boxes are not gates and do not count.
export function gateCount(net: Net): number {
  return net.gates.filter((g) => !g.part).length;
}

export function countByType(net: Net): Partial<Record<GateType, number>> {
  const r: Partial<Record<GateType, number>> = {};
  for (const g of net.gates) if (!g.part) r[g.type] = (r[g.type] ?? 0) + 1;
  return r;
}

// The number of boxes on the canvas.
export function boxCount(net: Net): number {
  return new Set(net.gates.filter((g) => g.part).map((g) => g.part)).size;
}

// The number of boxes at least one of whose output wires feeds a gate, a box
// or a bulb.
export function boxesUsed(net: Net): number {
  const read = new Set<string>();
  for (const g of net.gates) for (const s of g.inputs) if (s != null) read.add(s);
  for (const o of net.outputs) if (o.source != null) read.add(o.source);
  return new Set(net.gates.filter((g) => g.part && read.has(g.id)).map((g) => g.part)).size;
}

// ---------------------------------------------------------------------------
//  Rows of a truth table.
// ---------------------------------------------------------------------------

// Row r of the table, as a setting of the switches. Rows run in the usual
// order: the FIRST input listed is the leftmost column and changes slowest,
// row 0 has every switch at 0 and the last row has every switch at 1.
// With inputs a, b the rows are 00, 01, 10, 11.
export function rowSetting(inputs: string[], r: number): Record<string, Bit> {
  const n = inputs.length;
  const s: Record<string, Bit> = {};
  inputs.forEach((id, i) => { s[id] = ((r >> (n - 1 - i)) & 1) as Bit; });
  return s;
}

export function rowIndex(inputs: string[], setting: Record<string, Bit>): number {
  let r = 0;
  for (const id of inputs) r = (r << 1) | (setting[id] ?? 0);
  return r;
}

export function rowCount(inputs: string[]): number {
  return 1 << inputs.length;
}

// The full output columns of a net. Undefined entries mean "not wired".
export function tableOfNet(net: Net): Record<string, (Bit | undefined)[]> {
  const cols: Record<string, (Bit | undefined)[]> = {};
  for (const o of net.outputs) cols[o.id] = [];
  for (let r = 0; r < rowCount(net.inputs); r++) {
    const out = outputsOf(net, rowSetting(net.inputs, r));
    for (const o of net.outputs) cols[o.id].push(out[o.id]);
  }
  return cols;
}

// The column of any wire (switch or gate) of a net, over every row.
export function wireColumn(net: Net, wire: string): (Bit | undefined)[] {
  const col: (Bit | undefined)[] = [];
  for (let r = 0; r < rowCount(net.inputs); r++) col.push(evaluateNet(net, rowSetting(net.inputs, r))[wire]);
  return col;
}

// ---------------------------------------------------------------------------
//  Targets.
// ---------------------------------------------------------------------------

export type BitLike = 0 | 1 | boolean | number;

// One output column. A string such as "0110" (spaces, "_" and "|" are
// ignored, so "0110 1001" is fine), or an array of bits, one per row.
export type Column = string | BitLike[];

// A function of the switches, returning one value (single bulb) or one value
// per bulb id. 0, 1, true, false or any number (non-zero means 1).
export type TargetFn = (v: Record<string, Bit>) => BitLike | Record<string, BitLike>;

// A target for a problem with these bulbs:
//   - a Column, when there is exactly one bulb,
//   - an object { bulbId: Column } with one entry per bulb,
//   - a TargetFn (only from React code; in MDX wrap it in tableOf, see below).
export type TargetSpec = Column | Record<string, Column> | TargetFn;

export const toBit = (x: BitLike): Bit => (x ? 1 : 0);

export type Resolved = { ok: true; cols: Record<string, Bit[]> } | { ok: false; error: string };

export function parseColumn(col: Column, rows: number, name: string): Bit[] | string {
  let bits: Bit[];
  if (typeof col === "string") {
    const s = col.replace(/[\s_|]/g, "");
    if (!/^[01]*$/.test(s)) return `Column for "${name}" may only contain 0 and 1, got "${col}".`;
    bits = [...s].map((ch) => (ch === "1" ? 1 : 0));
  } else if (Array.isArray(col)) {
    bits = col.map(toBit);
  } else {
    return `Column for "${name}" must be a string like "0110" or an array of bits.`;
  }
  if (bits.length !== rows) return `Column for "${name}" has ${bits.length} entries, but the table has ${rows} rows.`;
  return bits;
}

// Turn any TargetSpec into one exact column per bulb, or explain what is wrong
// with it. The error is meant for page authors and is shown on the page.
export function resolveTarget(spec: TargetSpec | undefined, inputs: string[], outputs: string[]): Resolved {
  const rows = rowCount(inputs);
  if (spec === undefined || spec === null)
    return { ok: false, error: "No target given. In MDX a function target is dropped on the way to the browser: wrap it as target={tableOf([...inputs], fn)}." };
  const cols: Record<string, Bit[]> = {};
  if (typeof spec === "function") {
    for (const id of outputs) cols[id] = [];
    for (let r = 0; r < rows; r++) {
      const val = spec(rowSetting(inputs, r));
      if (typeof val === "object" && val !== null) {
        for (const id of outputs) {
          if (!(id in val)) return { ok: false, error: `The target function returned no value for bulb "${id}".` };
          cols[id].push(toBit((val as Record<string, BitLike>)[id]));
        }
      } else {
        if (outputs.length !== 1) return { ok: false, error: `There are ${outputs.length} bulbs, so the target function must return an object with one value per bulb.` };
        cols[outputs[0]].push(toBit(val as BitLike));
      }
    }
    return { ok: true, cols };
  }
  if (typeof spec === "string" || Array.isArray(spec)) {
    if (outputs.length !== 1) return { ok: false, error: `There are ${outputs.length} bulbs, so the target must be an object { bulbId: column }.` };
    const c = parseColumn(spec, rows, outputs[0]);
    if (typeof c === "string") return { ok: false, error: c };
    cols[outputs[0]] = c;
    return { ok: true, cols };
  }
  if (typeof spec === "object") {
    for (const id of outputs) {
      if (!(id in spec)) return { ok: false, error: `The target has no column for bulb "${id}".` };
      const c = parseColumn((spec as Record<string, Column>)[id], rows, id);
      if (typeof c === "string") return { ok: false, error: c };
      cols[id] = c;
    }
    for (const k of Object.keys(spec)) if (!outputs.includes(k)) return { ok: false, error: `The target has a column for "${k}", which is not a bulb.` };
    return { ok: true, cols };
  }
  return { ok: false, error: "Unrecognised target." };
}

// Build-time helper for MDX. Evaluates fn on every row and returns plain
// strings, which survive the trip to the browser where a function does not.
//   tableOf(["a", "b"], (v) => v.a & v.b)                 -> "0001"
//   tableOf(["a", "b"], (v) => ({ door: v.a, bomb: v.b })) -> { door: "0011", bomb: "0101" }
export function tableOf(inputs: string[], fn: TargetFn): string | Record<string, string> {
  const rows = rowCount(inputs);
  let single: string | null = null;
  let multi: Record<string, string> | null = null;
  for (let r = 0; r < rows; r++) {
    const val = fn(rowSetting(inputs, r));
    if (typeof val === "object" && val !== null) {
      if (single !== null) throw new Error("tableOf: fn returned a bit on one row and an object on another.");
      multi ??= {};
      for (const [k, x] of Object.entries(val)) multi[k] = (multi[k] ?? "") + toBit(x as BitLike);
    } else {
      if (multi !== null) throw new Error("tableOf: fn returned an object on one row and a bit on another.");
      single = (single ?? "") + toBit(val as BitLike);
    }
  }
  return multi ?? single ?? "";
}

// The output columns of a fixed circuit, as strings. Useful as the target of
// a "build the same thing with fewer gates" problem.
export function columnsOf(c: {
  inputs: { id: string }[];
  gates: { id: string; type: GateType; inputs: (string | null)[] }[];
  outputs: { id: string; source: string | null }[];
}): Record<string, string> {
  const t = tableOfNet(netOf(c));
  const r: Record<string, string> = {};
  for (const [k, col] of Object.entries(t)) r[k] = col.map((b) => (b === undefined ? "0" : String(b))).join("");
  return r;
}

// ---------------------------------------------------------------------------
//  Limits and the check.
// ---------------------------------------------------------------------------

export interface Limits {
  allowed?: GateType[];                          // gate types that may be used
  maxGates?: number;                             // every gate counts, NOT included
  maxDepth?: number;
  maxPerType?: Partial<Record<GateType, number>>;
  maxFanIn?: number;                             // most inputs on one gate (default 2)
  needBox?: boolean;                             // at least one box must be used
  maxBoxes?: number;                             // most boxes on the canvas
}

export type CheckResult =
  | { status: "ok"; rows: number; gates: number; depth: number }
  | { status: "unwired-output"; outputs: string[] }
  | { status: "empty-pin"; gates: string[] }
  | { status: "loop" }
  | { status: "wrong"; row: number; setting: Record<string, Bit>; wrong: { output: string; want: Bit; got: Bit }[] }
  | { status: "not-allowed"; type: GateType }
  | { status: "too-many-inputs"; gate: string; inputs: number; limit: number }
  | { status: "too-many-gates"; gates: number; limit: number }
  | { status: "too-deep"; depth: number; limit: number }
  | { status: "too-many-of-type"; type: GateType; count: number; limit: number }
  | { status: "box-unused" }
  | { status: "too-many-boxes"; boxes: number; limit: number };

// The whole check, in a fixed order so that two students with the same
// circuit always get the same message:
//   1. every bulb is wired, every gate pin is filled, there is no loop;
//   2. the full truth table matches, and the first wrong row is reported;
//   3. only then the limits: allowed types, fan-in, size, depth, per type,
//      and for a problem with a box, how many boxes and whether one is used.
// Limits come last on purpose: "the table is right but it is too big" is the
// more useful thing to hear than "too big", which says nothing about the table.
export function checkNet(net: Net, target: Record<string, Bit[]>, limits: Limits = {}): CheckResult {
  const unwired = net.outputs.filter((o) => o.source == null).map((o) => o.id);
  if (unwired.length) return { status: "unwired-output", outputs: unwired };
  const ids = new Set([...net.inputs, ...net.gates.map((g) => g.id)]);
  const empty = net.gates.filter((g) => g.inputs.length === 0 || g.inputs.some((s) => s == null || !ids.has(s))).map((g) => g.id);
  if (empty.length) return { status: "empty-pin", gates: empty };
  if (!topoOrder(net)) return { status: "loop" };

  const rows = rowCount(net.inputs);
  for (let r = 0; r < rows; r++) {
    const setting = rowSetting(net.inputs, r);
    const got = outputsOf(net, setting);
    const wrong: { output: string; want: Bit; got: Bit }[] = [];
    for (const o of net.outputs) {
      const want = target[o.id][r];
      const g = got[o.id] as Bit;
      if (g !== want) wrong.push({ output: o.id, want, got: g });
    }
    if (wrong.length) return { status: "wrong", row: r, setting, wrong };
  }

  if (limits.allowed) {
    const bad = net.gates.find((g) => !g.part && !limits.allowed!.includes(g.type));
    if (bad) return { status: "not-allowed", type: bad.type };
  }
  const fan = limits.maxFanIn ?? 2;
  for (const g of net.gates) {
    if (!g.part && g.type !== "NOT" && g.inputs.length > fan) return { status: "too-many-inputs", gate: g.id, inputs: g.inputs.length, limit: fan };
  }
  const size = gateCount(net);
  if (limits.maxGates !== undefined && size > limits.maxGates) return { status: "too-many-gates", gates: size, limit: limits.maxGates };
  const depth = circuitDepth(net);
  if (limits.maxDepth !== undefined && depth > limits.maxDepth) return { status: "too-deep", depth, limit: limits.maxDepth };
  if (limits.maxPerType) {
    const counts = countByType(net);
    for (const t of ALL_GATES) {
      const lim = limits.maxPerType[t];
      if (lim !== undefined && (counts[t] ?? 0) > lim) return { status: "too-many-of-type", type: t, count: counts[t] ?? 0, limit: lim };
    }
  }
  if (limits.maxBoxes !== undefined && boxCount(net) > limits.maxBoxes) return { status: "too-many-boxes", boxes: boxCount(net), limit: limits.maxBoxes };
  if (limits.needBox && boxesUsed(net) === 0) return { status: "box-unused" };
  return { status: "ok", rows, gates: size, depth };
}

// Would a wire from `source` into gate `sinkGate` make a loop? True when the
// sink gate already feeds the source, directly or through other gates.
export function wouldLoop(net: Net, source: string, sinkGate: string): boolean {
  if (source === sinkGate) return true;
  const feeds = new Map<string, string[]>(); // gate id -> gates it feeds
  for (const g of net.gates) for (const s of g.inputs) if (s != null) {
    if (!feeds.has(s)) feeds.set(s, []);
    feeds.get(s)!.push(g.id);
  }
  const seen = new Set<string>();
  const stack = [sinkGate];
  while (stack.length) {
    const x = stack.pop()!;
    if (x === source) return true;
    if (seen.has(x)) continue;
    seen.add(x);
    for (const y of feeds.get(x) ?? []) stack.push(y);
  }
  return false;
}

// ---------------------------------------------------------------------------
//  "Every setting that lights the bulb."
// ---------------------------------------------------------------------------

// Row indices on which every listed bulb shows the wanted value.
export function rowsMatching(net: Net, goal: Record<string, Bit>): number[] {
  const r: number[] = [];
  for (let i = 0; i < rowCount(net.inputs); i++) {
    const out = outputsOf(net, rowSetting(net.inputs, i));
    if (Object.entries(goal).every(([id, b]) => out[id] === b)) r.push(i);
  }
  return r;
}
