// Keys of logic-gates/building.mdx (book Section 6.2), checked by walking
// every row of every table. Run from Site/ with:  npm test
//
// Build problems: each target is checked against the rule as the statement
// words it, and each gate limit is shown to be exactly the fewest possible
// (doable within the limit, impossible with one gate fewer), by fewestGates
// from circuit-search.ts.
//
// Impossibility claims ("no box of ANDs and ORs can ...") are checked by
// working out every table a palette can make with any number of gates: start
// from the switch columns and keep adding gate outputs until nothing new
// appears.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { GateType } from "../src/components/games/circuits/model.ts";
import { columnsOf, evaluateNet, netOf, rowSetting, rowsMatching, tableOf } from "../src/components/games/circuits/problems/engine.ts";
import * as B from "../src/components/games/circuits/problems/banks/building.ts";
import { fewestGates } from "./circuit-search.ts";

const column = (spec: Parameters<typeof columnsOf>[0], out = "out") => columnsOf(spec)[out];
const allFn = (n: number) => (1 << (1 << n)) - 1;
const switchMasks = (n: number) => {
  const R = 1 << n;
  return Array.from({ length: n }, (_, i) => { let m = 0; for (let r = 0; r < R; r++) if ((r >> (n - 1 - i)) & 1) m |= 1 << r; return m; });
};
const maskOf = (col: string) => [...col].reduce((m, ch, r) => (ch === "1" ? m | (1 << r) : m), 0);
const ones = (col: string) => [...col].filter((c) => c === "1").length;
const apply = (t: GateType, x: number, y: number, full: number) =>
  t === "NOT" ? ~x & full : t === "AND" ? x & y : t === "OR" ? x | y : t === "XOR" ? x ^ y : t === "NAND" ? ~(x & y) & full : ~(x | y) & full;

// Every table (as a row mask) that some circuit of `palette` gates on n switches makes.
function reachable(n: number, palette: GateType[]): Set<number> {
  const full = allFn(n);
  const got = new Set(switchMasks(n));
  for (let grew = true; grew; ) {
    grew = false;
    const now = [...got];
    for (const t of palette) for (const x of now) for (const y of now) {
      const v = apply(t, x, y, full);
      if (!got.has(v)) { got.add(v); grew = true; }
    }
  }
  return got;
}

// ---------------------------------------------------------------------------
//  Reading disguised circuits
// ---------------------------------------------------------------------------

test("building 1: the circuit with no OR inside has the OR table", () => {
  assert.equal(column(B.noOrInside), tableOf(["a", "b"], (v) => v.a | v.b));
  assert.ok(!B.noOrInside.gates.some((g) => g.type === "OR"));
});

test("building 2: exactly the keyed gate has the same table as the two-flip circuit", () => {
  const truth = column(B.twoFlips);
  assert.equal(truth, tableOf(["a", "b"], (v) => v.a ^ v.b));
  const hits = B.twoFlipsOptions.map((c, k) => [k, column(c) === truth] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, [B.twoFlipsAnswer]);
});

test("building 3: the circuit uses only OR and NOT, and the asked wires do not all agree", () => {
  assert.ok(B.readOrNot.gates.every((g) => g.type === "OR" || g.type === "NOT"));
  const v = evaluateNet(netOf(B.readOrNot), rowSetting(["a", "b", "c"], parseInt(B.readOrNotSwitches, 2)));
  const asked = [...B.readOrNotTags.map((t) => v[t.wire]), v.n];
  assert.ok(asked.includes(0) && asked.includes(1));
});

test("building 4: the box uses only OR and NOT, and exactly the keyed table is its own", () => {
  assert.ok(B.orNotBox.gates.every((g) => g.type === "OR" || g.type === "NOT"));
  const truth = column(B.orNotBox);
  assert.equal(truth, tableOf(["a", "b", "c"], (v) => v.a & (v.b | v.c)));
  const hits = B.orNotBoxOptions.map((o, k) => [k, o.table.outputs.bulb === truth] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, [B.orNotBoxAnswer]);
});

test("building 5: the circuit uses only OR and NOT, and the count of lighting settings is as recorded", () => {
  assert.ok(B.everyOrNot.gates.every((g) => g.type === "OR" || g.type === "NOT"));
  assert.equal(rowsMatching(netOf(B.everyOrNot), { out: 1 }).length, B.everyOrNotCount);
});

test("building 6: the keyed gadgets are exactly the ones lit in both positions", () => {
  const hits = B.alwaysLitOptions.map((c, k) => [k, column(c) === "11"] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, B.alwaysLitAnswer);
  // Every gadget really has one switch, and no option is lit in only one position by accident of wiring.
  for (const c of B.alwaysLitOptions) assert.equal(c.inputs.length, 1);
});

// ---------------------------------------------------------------------------
//  Build problems
// ---------------------------------------------------------------------------

test("building: each build target is the rule its statement states", () => {
  assert.equal(B.alwaysDark.target, tableOf(B.alwaysDark.inputs, () => 0));
  assert.equal(B.notBoth.target, tableOf(B.notBoth.inputs, (v) => (v.a & v.b) ^ 1));
  assert.equal(B.upAndDown.target, tableOf(B.upAndDown.inputs, (v) => v.a === 1 && v.b === 0));
  assert.equal(B.orFromXorAnd.target, tableOf(B.orFromXorAnd.inputs, (v) => v.a | v.b));
  assert.equal(B.andFromXorOr.target, tableOf(B.andFromXorOr.inputs, (v) => v.a & v.b));
  assert.equal(B.agreeXorNot.target, tableOf(B.agreeXorNot.inputs, (v) => v.a === v.b));
  assert.equal(B.agreeAndOrNot.target, tableOf(B.agreeAndOrNot.inputs, (v) => v.a === v.b));
  assert.equal(B.xorInFour.target, tableOf(B.xorInFour.inputs, (v) => v.a !== v.b));
  assert.equal(B.allDown.target, tableOf(B.allDown.inputs, (v) => v.a + v.b + v.c === 0));
  assert.equal(B.xorOrNot.target, tableOf(B.xorOrNot.inputs, (v) => v.a !== v.b));
  assert.equal(B.allUpOrNot.target, tableOf(B.allUpOrNot.inputs, (v) => v.a + v.b + v.c === 3));
  // Palettes leave out the gate being built.
  assert.ok(!B.orFromXorAnd.gates.includes("OR"));
  assert.ok(!B.andFromXorOr.gates.includes("AND"));
  assert.ok(!B.xorInFour.gates.includes("XOR"));
  assert.ok(!B.xorOrNot.gates.includes("XOR") && !B.xorOrNot.gates.includes("AND"));
  assert.ok(!B.allUpOrNot.gates.includes("AND"));
});

const builds: [string, B.Build][] = [
  ["always dark", B.alwaysDark],
  ["not both", B.notBoth],
  ["up and down", B.upAndDown],
  ["OR from XOR and AND", B.orFromXorAnd],
  ["AND from XOR and OR", B.andFromXorOr],
  ["agree from XOR and NOT", B.agreeXorNot],
  ["agree from NOT, AND, OR", B.agreeAndOrNot],
  ["XOR in four", B.xorInFour],
  ["all three down", B.allDown],
  ["XOR from OR and NOT", B.xorOrNot],
  ["all three up from OR and NOT", B.allUpOrNot],
];

test("building: every gate limit is exactly the fewest possible", () => {
  // fewestGates returns the smallest count within the limit, so getting the
  // limit back proves both that it can be done and that one fewer cannot.
  for (const [name, p] of builds) assert.equal(fewestGates(p.inputs, [p.target], p.gates, p.maxGates), p.maxGates, name);
});

test("building 14: the book's XOR uses five gates, and four is the fewest", () => {
  assert.equal(fewestGates(["a", "b"], ["0110"], ["NOT", "AND", "OR"], 5), 4);
});

// ---------------------------------------------------------------------------
//  What a palette cannot build
// ---------------------------------------------------------------------------

test("building 16: the keyed tables are exactly those some box of ANDs and ORs makes", () => {
  const can = reachable(2, ["AND", "OR"]);
  const hits = B.andOrTables.map((t, k) => [k, can.has(maskOf(t))] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, B.andOrTableAnswer);
  // The book's argument is enough: every wrong option fails on "both down" (must be 0) or "both up" (must be 1).
  for (const [k, t] of B.andOrTables.entries()) if (!B.andOrTableAnswer.includes(k)) assert.ok(t[0] === "1" || t[3] === "0", t);
});

// "Sure to catch" a setting: every box of the palette disagrees with the claim there.
const sureRows = (n: number, palette: GateType[], claim: string) => {
  const can = [...reachable(n, palette)];
  return Array.from({ length: 1 << n }, (_, r) => r).filter((r) => can.every((m) => ((m >> r) & 1) !== Number(claim[r])));
};

test("building 17: both up is the one setting sure to catch an AND-and-OR box claimed to be XOR", () => {
  assert.equal(B.catchXorClaim, tableOf(["a", "b"], (v) => v.a ^ v.b));
  assert.deepEqual(rowSetting(["a", "b"], B.catchXorRows[1]), { a: 1, b: 0 });
  assert.deepEqual(rowSetting(["a", "b"], B.catchXorRows[2]), { a: 0, b: 1 });
  const sure = sureRows(2, ["AND", "OR"], B.catchXorClaim);
  const hits = B.catchXorRows.map((r, k) => [k, sure.includes(r)] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, [B.catchXorAnswer]);
  assert.deepEqual(sure, [3]);
});

test("building 18: all down and all up are the settings sure to catch the three-switch claim", () => {
  assert.equal(B.catchNoneClaim, tableOf(["a", "b", "c"], (v) => v.a + v.b + v.c === 0));
  const words: Record<number, { a: number; b: number; c: number }> = {
    0: { a: 0, b: 0, c: 0 }, 1: { a: 1, b: 0, c: 0 }, 2: { a: 1, b: 1, c: 0 }, 3: { a: 1, b: 1, c: 1 }, 4: { a: 1, b: 0, c: 1 },
  };
  B.catchNoneRows.forEach((r, k) => assert.deepEqual(rowSetting(["a", "b", "c"], r), words[k], B.catchNoneOptions[k].caption));
  const sure = sureRows(3, ["AND", "OR"], B.catchNoneClaim);
  assert.deepEqual(sure, [0, 7]);
  const hits = B.catchNoneRows.map((r, k) => [k, sure.includes(r)] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, B.catchNoneAnswer);
});

test("building 19: XOR-and-NOT boxes on two switches make exactly the tables with an even number of 1s", () => {
  const can = reachable(2, ["XOR", "NOT"]);
  for (let m = 0; m < 16; m++) {
    const col = Array.from({ length: 4 }, (_, r) => ((m >> r) & 1 ? "1" : "0")).join("");
    assert.equal(can.has(m), ones(col) % 2 === 0, col);
  }
  for (const t of Object.values(B.xorNotSeen)) assert.ok(can.has(maskOf(t)), t);
  const hits = B.xorNotTables.map((t, k) => [k, can.has(maskOf(t))] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, B.xorNotTableAnswer);
  // OR in particular is out of reach.
  assert.ok(!can.has(maskOf("0111")));
});

test("building 20: the keyed palettes are exactly those that can build OR", () => {
  const hits = B.orPalettes.map((p, k) => [k, reachable(2, p).has(maskOf("0111"))] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, B.orPaletteAnswer);
  assert.equal(B.orPalettes.length, B.orPaletteOptions.length);
});

test("building 21: none of the palettes without NOT can build NOT", () => {
  assert.equal(B.notPalettes.length, B.notPaletteOptions.length);
  for (const p of B.notPalettes) if (p) {
    assert.ok(!reachable(1, p).has(maskOf("10")), p.join(","));
    assert.ok(!reachable(2, p).has(maskOf("1100")), p.join(","));
  }
  assert.equal(B.notPalettes[B.notPaletteAnswer], null);
  // The always-dark gadget from one XOR is reachable, an always-lit one is not.
  assert.ok(reachable(1, ["XOR"]).has(0));
  assert.ok(!reachable(1, ["AND", "OR", "XOR"]).has(3));
});
