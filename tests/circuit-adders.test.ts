// Keys of logic-gates/adders.mdx ("Adding Numbers").
// Run from Site/ with:  npm test
//
// Every target, and the table of the sealed 2-bit adder box, is rebuilt here
// from the rule as the page words it: the sum of the two numbers, bulb by
// bulb. The two `fewest` counts are proved both ways by trying every smaller
// circuit. The box machinery of engine.ts is checked on a toy box, so that no
// adder circuit is written down.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Bit, GateType } from "../src/components/games/circuits/model.ts";
import { boxCount, checkNet, evaluateNet, gateCount, rowCount, rowSetting, type Net } from "../src/components/games/circuits/problems/engine.ts";
import * as B from "../src/components/games/circuits/problems/banks/adders.ts";
import { fewestGates } from "./circuit-search.ts";

type W = Record<string, Bit>;
const ids = (b: B.AdderBuild) => b.inputs.map((i) => i.id);
// The number shown by switches listed most valuable first.
const value = (w: W, sw: string[]) => sw.reduce((n, s) => 2 * n + w[s], 0);

// ---------------------------------------------------------------------------
//  A faster exact search, copied from circuit-build-it.test.ts and checked
//  against circuit-search.ts below. Tables are 32-bit masks: at most 5 switches.
// ---------------------------------------------------------------------------
function smallest(n: number, want0: string[], palette: GateType[], limit: number): number {
  const R = 1 << n, FULL = R === 32 ? 0xffffffff : (1 << R) - 1;
  const want = want0.map((col) => [...col].reduce((m, ch, r) => (ch === "1" ? m | (1 << r) : m), 0) >>> 0);
  const nodes: number[] = [];
  for (let i = 0; i < n; i++) { let m = 0; for (let r = 0; r < R; r++) if ((r >> (n - 1 - i)) & 1) m |= 1 << r; nodes.push(m >>> 0); }
  const code: Record<GateType, number> = { NOT: 0, AND: 1, OR: 2, XOR: 3, NAND: 4, NOR: 5 };
  const op = (t: number, a: number, b: number) =>
    (t === 0 ? ~a & FULL : t === 1 ? a & b : t === 2 ? a | b : t === 3 ? a ^ b : t === 4 ? ~(a & b) & FULL : ~(a | b) & FULL) >>> 0;
  const pal = palette.map((p) => code[p]);
  const keys: number[] = [], reads: number[] = [];
  const dfs = (left: number): boolean => {
    let missing = 0;
    for (const w of want) if (!nodes.includes(w)) missing++;
    if (missing === 0) return true;
    let unread = 0;
    for (let k = n; k < nodes.length; k++) if (reads[k] === 0 && !want.includes(nodes[k])) unread++;
    if (left === 0 || missing > left || unread > left + missing) return false;
    const N = nodes.length, last = N - 1, lastKey = N > n ? keys[last] : -1;
    for (const t of pal) for (let j = 0; j < N; j++) for (let i = 0; i <= j; i++) {
      if (t === 0 && i !== j) continue;
      const key = (j * 64 + i) * 8 + t;
      if (lastKey >= 0 && i !== last && j !== last && key <= lastKey) continue;
      const f = op(t, nodes[i], nodes[j]);
      if (nodes.includes(f)) continue;
      if (left === 1 && !want.includes(f)) continue;
      nodes.push(f); keys[N] = key; reads[N] = 0;
      if (i >= n) reads[i]++;
      if (j >= n && j !== i) reads[j]++;
      const ok = dfs(left - 1);
      if (i >= n) reads[i]--;
      if (j >= n && j !== i) reads[j]--;
      nodes.pop();
      if (ok) return true;
    }
    return false;
  };
  for (let k = 0; k <= limit; k++) if (dfs(k)) return k;
  return Infinity;
}

// ---------------------------------------------------------------------------
//  Targets, from the rule
// ---------------------------------------------------------------------------
function expected(n: number): Record<string, string> {
  const a = B.worths(n).map((w) => `a${w}`), b = B.worths(n).map((w) => `b${w}`);
  const sw = [...a, ...b];
  const cols: Record<string, string> = {};
  for (const w of B.worths(n + 1)) {
    let col = "";
    for (let r = 0; r < rowCount(sw); r++) {
      const s = rowSetting(sw, r);
      col += Math.floor((value(s, a) + value(s, b)) / w) % 2 ? "1" : "0";
    }
    cols[`s${w}`] = col;
  }
  return cols;
}

test("adders: switches and bulbs are the ones the page describes", () => {
  assert.deepEqual(ids(B.one), ["a1", "b1"]);
  assert.deepEqual(ids(B.two), ["a2", "a1", "b2", "b1"]);
  assert.deepEqual(ids(B.three), ["a4", "a2", "a1", "b4", "b2", "b1"]);
  assert.deepEqual(ids(B.stepUp), ids(B.three));
  assert.deepEqual(B.one.outputs.map((o) => o.label), ["2", "1"]);
  assert.deepEqual(B.two.outputs.map((o) => o.label), ["4", "2", "1"]);
  assert.deepEqual(B.three.outputs.map((o) => o.label), ["8", "4", "2", "1"]);
  assert.deepEqual(B.three.inputs.map((i) => i.label), ["a₄", "a₂", "a₁", "b₄", "b₂", "b₁"]);
  for (const b of [B.one, B.two, B.three, B.stepUp]) {
    const outs = b.outputs.map((o) => o.id);
    assert.equal(new Set([...ids(b), ...outs]).size, ids(b).length + outs.length);
    assert.deepEqual(Object.keys(b.target).sort(), [...outs].sort());
  }
});

test("adders: every target is the sum, bulb by bulb", () => {
  assert.deepEqual(B.one.target, expected(1));
  assert.deepEqual(B.two.target, expected(2));
  assert.deepEqual(B.three.target, expected(3));
  assert.deepEqual(B.stepUp.target, expected(3));
});

test("adders: the box adds two 2-bit numbers, pins as labelled", () => {
  const box = B.box2;
  assert.deepEqual(box.inputs, ["2", "1", "2", "1"]);
  assert.deepEqual(box.outputs, ["4", "2", "1"]);
  assert.equal(box.gap, 2);
  assert.equal(box.max, 1);
  assert.equal(box.required, true);
  const pins = ["x2", "x1", "y2", "y1"];
  for (let r = 0; r < 16; r++) {
    const s = rowSetting(pins, r);
    const sum = value(s, ["x2", "x1"]) + value(s, ["y2", "y1"]);
    box.outputs.forEach((label, k) => assert.equal(box.table[k][r], Math.floor(sum / Number(label)) % 2 ? "1" : "0", `row ${r} pin ${label}`));
  }
});

test("adders: the faster search agrees with circuit-search.ts", () => {
  const P: GateType[] = ["NOT", "AND", "OR", "XOR"];
  const t = (b: B.AdderBuild) => b.outputs.map((o) => b.target[o.id]);
  assert.equal(smallest(2, t(B.one), P, 4), fewestGates(ids(B.one), t(B.one), P, 4));
  for (const col of ["0110", "1000", "0111", "1001"]) assert.equal(smallest(2, [col], P, 4), fewestGates(["a", "b"], [col], P, 4), col);
});

test("adders: every fewest count is exactly the fewest gates possible", () => {
  for (const b of [B.one, B.two]) {
    const t = b.outputs.map((o) => b.target[o.id]);
    assert.equal(smallest(b.inputs.length, t, b.gates, b.fewest! + 1), b.fewest, ids(b).join(","));
  }
  assert.equal(B.one.fewest, 2);
  assert.equal(B.two.fewest, 7);
  assert.equal(B.three.fewest, undefined);
  assert.equal(B.stepUp.fewest, undefined);
});

// ---------------------------------------------------------------------------
//  The box machinery in engine.ts, on a toy box that copies and flips its
//  one input: output 0 copies it, output 1 is its flip.
// ---------------------------------------------------------------------------
const toy = (pin: string | null, bulbSource: string | null, extraGate = false): Net => ({
  inputs: ["a"],
  gates: [
    { id: "x.0", type: "AND", inputs: [pin], lut: [0, 1], part: "x" },
    { id: "x.1", type: "AND", inputs: [pin], lut: [1, 0], part: "x" },
    ...(extraGate ? [{ id: "g1", type: "NOT" as GateType, inputs: ["a"] }] : []),
  ],
  outputs: [{ id: "out", source: bulbSource }],
});

test("adders: a box is evaluated by its table and is not a gate", () => {
  const net = toy("a", "x.1");
  assert.deepEqual([0, 1].map((a) => evaluateNet(net, { a: a as Bit })["x.1"]), [1, 0]);
  assert.deepEqual([0, 1].map((a) => evaluateNet(net, { a: a as Bit })["x.0"]), [0, 1]);
  assert.equal(gateCount(net), 0);
  assert.equal(boxCount(net), 1);
  assert.equal(gateCount(toy("a", "x.1", true)), 1);
  assert.equal(checkNet(net, { out: [1, 0] }, { allowed: ["NOT"], needBox: true }).status, "ok");
  assert.equal(checkNet(net, { out: [0, 1] }, { needBox: true }).status, "wrong");
  assert.equal(checkNet(toy(null, "x.1"), { out: [1, 0] }).status, "empty-pin");
});

test("adders: a box that is placed but feeds nothing does not count as used", () => {
  const unused = toy("a", "g1", true);
  assert.equal(checkNet(unused, { out: [1, 0] }).status, "ok");
  assert.equal(checkNet(unused, { out: [1, 0] }, { needBox: true }).status, "box-unused");
  assert.equal(checkNet(toy("a", "x.1"), { out: [1, 0] }, { maxBoxes: 0 }).status, "too-many-boxes");
});
