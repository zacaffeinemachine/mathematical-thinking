// Keys and limits of logic-gates/any-table.mdx (book Section 6.5).
// Run from Site/ with:  npm test
//
// Every check walks complete truth tables. Every gate limit on the page is
// presented as the fewest possible, and each is proved here by exhaustive
// search: a circuit within the limit exists, and none with one gate fewer.
// No solution circuit for a build problem is stored anywhere.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Bit, GateType } from "../src/components/games/circuits/model.ts";
import { columnsOf, gateCount, netOf, rowsMatching, tableOf } from "../src/components/games/circuits/problems/engine.ts";
import * as B from "../src/components/games/circuits/problems/banks/any-table.ts";
import { fewestGates } from "./circuit-search.ts";

const NAMES = ["a", "b", "c", "d"];
const rowOf = (bits: string) => parseInt(bits, 2);
const sum = (v: Record<string, Bit>) => Object.values(v).reduce<number>((s, x) => s + x, 0);

// ---------------------------------------------------------------------------
//  A faster exact search, for the four-switch problems.
// ---------------------------------------------------------------------------
// Same answer as fewestGates (checked below), with three prunings that are
// each safe for a SMALLEST circuit:
//   1. no gate repeats a table already on some wire (it could be removed);
//   2. two neighbouring gates where the second does not read the first are
//      tried in one order only (they could be swapped);
//   3. a smallest circuit has no gate that is unread and is not a bulb, and
//      each further gate can reduce the number of such gates by at most one
//      (two for a gate that gives a bulb its table).
// It never builds a circuit to show anyone: it returns a number.
function smallest(n: number, targets: string[], palette: GateType[], limit: number): number {
  const R = 1 << n, FULL = R === 32 ? 0xffffffff : (1 << R) - 1;
  const want = targets.map((col) => [...col].reduce((m, ch, r) => (ch === "1" ? m | (1 << r) : m), 0) >>> 0);
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
      if (t === 0 && i !== j) continue; // NOT reads one wire
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

test("the faster search agrees with circuit-search.ts on random two- and three-switch tables", () => {
  let seed = 11;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const palettes: GateType[][] = [["NOT", "AND", "OR"], ["NOT", "AND", "OR", "XOR"], ["OR", "NOT"], ["AND", "OR"]];
  for (let it = 0; it < 80; it++) {
    const n = it < 40 ? 2 : 3;
    let t = "";
    for (let r = 0; r < 1 << n; r++) t += rnd() < 0.5 ? "1" : "0";
    const p = palettes[it % palettes.length];
    const lim = n === 2 ? 5 : 4;
    assert.equal(smallest(n, [t], p, lim), fewestGates(NAMES.slice(0, n), [t], p, lim), `${t} ${p}`);
  }
});

// Proves "max is the fewest possible" for one build problem: a circuit with
// `max` gates exists, and none with fewer. Three-switch problems are also
// checked with circuit-search.ts itself.
function assertFewest(name: string, p: { inputs: string[]; target: string; gates: GateType[]; maxGates: number }) {
  const n = p.inputs.length;
  assert.equal(smallest(n, [p.target], p.gates, p.maxGates), p.maxGates, name);
  if (n <= 3 && p.maxGates <= 5) assert.equal(fewestGates(p.inputs, [p.target], p.gates, p.maxGates), p.maxGates, `${name} (circuit-search)`);
}

// The gate count of the book's recipe: one NOT for each switch that is down
// in some winning row (shared), one detector per winning row made of n - 1
// two-input ANDs, and one OR fewer than the number of detectors.
function recipeCount(n: number, column: string): number {
  const wins = [...column].map((ch, r) => (ch === "1" ? r : -1)).filter((r) => r >= 0);
  const nots = Array.from({ length: n }, (_, i) => wins.some((r) => ((r >> (n - 1 - i)) & 1) === 0)).filter(Boolean).length;
  return nots + wins.length * (n - 1) + (wins.length - 1);
}

test("recipeCount matches the book's own counts", () => {
  // The worked table of the book, three winning rows of two switches: 2 NOTs, 3 ANDs, 2 ORs.
  assert.equal(recipeCount(2, "1011"), 7);
  // The combination lock up, down, up, up: one NOT and three ANDs.
  assert.equal(recipeCount(4, tableOf(NAMES, (v) => v.a & (v.b ^ 1) & v.c & v.d) as string), 4);
  // The six-detector fire alarm: 383 gates.
  assert.equal(recipeCount(6, "0" + "1".repeat(63)), 383);
});

// ---------------------------------------------------------------------------
//  Spike detectors
// ---------------------------------------------------------------------------

test("1: on every row exactly one detector bulb is lit, and the set row lights only y", () => {
  const ids = B.board.outputs.map((o) => o.id);
  const cols = columnsOf(B.board);
  for (let r = 0; r < 4; r++) assert.equal(ids.filter((id) => cols[id][r] === "1").length, 1, `row ${r}`);
  // Each bulb is a spike detector: its column has a single 1.
  for (const id of ids) assert.equal([...cols[id]].filter((c) => c === "1").length, 1, id);
  const lit = ids.filter((id) => cols[id][rowOf(B.boardSwitches)] === "1");
  assert.deepEqual(lit, ["y"]);
});

test("2: the detector lights on exactly one setting, the one keyed", () => {
  assert.deepEqual(rowsMatching(netOf(B.whichRow), { out: 1 }), [rowOf(B.whichRowAnswer)]);
});

test("3 to 5: spike detector targets are the stated rows, and the limits are the fewest possible", () => {
  assert.equal(B.spike01.target, tableOf(B.spike01.inputs, (v) => (v.a ^ 1) & v.b));
  for (const s of B.spike01Sightings) assert.equal(B.spike01.target[rowOf(s.switches)], s.bulb);
  assert.equal(B.spike101.target, tableOf(B.spike101.inputs, (v) => v.a & (v.b ^ 1) & v.c));
  assert.equal(B.allDown.target, tableOf(B.allDown.inputs, (v) => sum(v) === 0));
  assert.equal(recipeCount(4, B.allDown.target), B.allDown.recipe);
  assertFewest("one row of two", B.spike01);
  assertFewest("one row of three", B.spike101);
  assertFewest("all four down", B.allDown);
});

// ---------------------------------------------------------------------------
//  The recipe
// ---------------------------------------------------------------------------

test("6: the recipe for the counting table uses the keyed number of gates, and only one option says so", () => {
  const { column } = B.countTable;
  assert.equal(column.length, 1 << B.countTable.inputs.length);
  assert.deepEqual([...column].map((c, r) => (c === "1" ? r : -1)).filter((r) => r >= 0), [0b000, 0b011, 0b101]);
  const n = recipeCount(3, column);
  assert.equal(n, 11);
  assert.deepEqual(B.countOptions.map((x, k) => [x, k] as const).filter(([x]) => x === n).map(([, k]) => k), [B.countAnswer]);
});

test("7: the recipe circuit lights on exactly the keyed settings, and it is the recipe's size", () => {
  const rows = rowsMatching(netOf(B.backwards), { out: 1 });
  assert.deepEqual(rows, B.backwardsRows.map(rowOf));
  const column = columnsOf(B.backwards).out;
  assert.equal(gateCount(netOf(B.backwards)), recipeCount(3, column));
});

test("8: the friend's table fits within the recipe's count, which is the limit", () => {
  assert.equal(recipeCount(3, B.friend.target), B.friend.maxGates);
  assert.ok(smallest(3, [B.friend.target], B.friend.gates, 8) <= B.friend.maxGates);
});

test("9: exactly the keyed circuits have the table", () => {
  assert.equal(B.manyTable.column, tableOf(B.manyTable.inputs, (v) => v.a | ((v.b ^ 1) & (v.c ^ 1))));
  const hits = B.manyOptions.map((c, k) => [k, columnsOf(c).out === B.manyTable.column] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, B.manyAnswer);
});

test("10 and 11: two winning rows, the recipe's count, and the smallest circuit", () => {
  const { column } = B.twoRowsTable;
  assert.deepEqual([...column].map((c, r) => (c === "1" ? r : -1)).filter((r) => r >= 0), [0b1110, 0b1111]);
  const n = recipeCount(4, column);
  assert.equal(n, 8);
  assert.deepEqual(B.twoRowsOptions.map((x, k) => [x, k] as const).filter(([x]) => x === n).map(([, k]) => k), [B.twoRowsAnswer]);
  assert.equal(B.twoRowsBuild.target, column);
  assertFewest("two winning rows", B.twoRowsBuild);
});

// ---------------------------------------------------------------------------
//  Fewer kinds of gate
// ---------------------------------------------------------------------------

test("12 and 13: OR and NOT only, at the fewest possible", () => {
  assert.equal(B.noAnd.target, tableOf(B.noAnd.inputs, (v) => v.a & (v.b ^ 1)));
  for (const s of B.noAndSightings) assert.equal(B.noAnd.target[rowOf(s.switches)], s.bulb);
  assert.equal(B.spike101On.target, tableOf(B.spike101On.inputs, (v) => v.a & (v.b ^ 1) & v.c));
  assert.deepEqual(B.noAnd.gates, ["OR", "NOT"]);
  assert.deepEqual(B.spike101On.gates, ["OR", "NOT"]);
  assertFewest("a up and b down", B.noAnd);
  assertFewest("row 101 from OR and NOT", B.spike101On);
});

test("14: the keyed tables are exactly those that AND and OR gates alone can build", () => {
  // Every table any AND/OR circuit on three switches can carry: start from
  // the three switches and close up under AND and OR until nothing new appears.
  const R = 8;
  const base = [0, 1, 2].map((i) => { let m = 0; for (let r = 0; r < R; r++) if ((r >> (2 - i)) & 1) m |= 1 << r; return m; });
  const seen = new Set(base);
  for (let grew = true; grew;) {
    grew = false;
    const all = [...seen];
    for (const x of all) for (const y of all) for (const f of [x & y, x | y]) if (!seen.has(f)) { seen.add(f); grew = true; }
  }
  const maskOf = (col: string) => [...col].reduce((m, ch, r) => (ch === "1" ? m | (1 << r) : m), 0);
  const hits = B.noNotColumns.map((c, k) => [k, seen.has(maskOf(c))] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, B.noNotAnswer);
  // The same answer from the book's one-way test.
  const oneWay = (col: string) => [...Array(R).keys()].every((r) => [0, 1, 2].every((k) => !(col[r] === "1" && col[r | (1 << k)] === "0")));
  assert.deepEqual(B.noNotColumns.map((c, k) => [k, oneWay(c) && /1/.test(c) && /0/.test(c)] as const).filter(([, ok]) => ok).map(([k]) => k), B.noNotAnswer);
  // The options as passed to the page are these columns.
  assert.deepEqual(B.noNotOptions.map((o) => o.table.outputs.bulb), B.noNotColumns);
});

// ---------------------------------------------------------------------------
//  Votes, and beating the recipe
// ---------------------------------------------------------------------------

test("15 to 17: the vote targets are the stated rules, and the limits are the fewest possible", () => {
  assert.equal(B.twoOfFour.target, tableOf(B.twoOfFour.inputs, (v) => sum(v) >= 2));
  assert.equal(B.threeOfFour.target, tableOf(B.threeOfFour.inputs, (v) => sum(v) >= 3));
  assert.equal(B.chair.target, tableOf(B.chair.inputs, (v) => (v.a & (v.b | v.c | v.d)) | (v.b & v.c & v.d)));
  for (const p of [B.twoOfFour, B.threeOfFour, B.chair]) assert.deepEqual(p.gates, ["AND", "OR"]);
  const sightings: [{ target: string }, readonly (readonly [string, number])[]][] = [
    [B.twoOfFour, B.twoOfFourSightings], [B.threeOfFour, B.threeOfFourSightings], [B.chair, B.chairSightings], [B.exactlyOne, B.exactlyOneSightings],
  ];
  for (const [p, list] of sightings) for (const [sw, lit] of list) assert.equal(p.target[rowOf(sw)], String(lit), sw);
  assertFewest("at least two of four", B.twoOfFour);
  assertFewest("at least three of four", B.threeOfFour);
  assertFewest("the chair and the members", B.chair);
});

test("18 to 21: the hard targets are the stated rules, and the limits are the fewest possible", () => {
  assert.equal(B.majority.target, tableOf(B.majority.inputs, (v) => sum(v) >= 2));
  assert.equal(B.exactlyOne.target, tableOf(B.exactlyOne.inputs, (v) => sum(v) === 1));
  assert.equal(B.friendSmall.target, B.friend.target);
  assert.equal(B.spike0110.target, tableOf(B.spike0110.inputs, (v) => (v.a ^ 1) & v.b & v.c & (v.d ^ 1)));
  assert.equal(recipeCount(4, B.spike0110.target), B.spike0110.recipe);
  assert.equal(recipeCount(3, B.majority.target), B.majority.recipe);
  assert.equal(recipeCount(3, B.friendSmall.target), 14);
  // The book's smaller majority circuit: three ANDs and two ORs.
  const bookMajority = {
    inputs: [{ id: "a" }, { id: "b" }, { id: "c" }],
    gates: [
      { id: "p", type: "AND" as const, inputs: ["a", "b"] },
      { id: "q", type: "AND" as const, inputs: ["a", "c"] },
      { id: "r", type: "AND" as const, inputs: ["b", "c"] },
      { id: "s", type: "OR" as const, inputs: ["p", "q"] },
      { id: "t", type: "OR" as const, inputs: ["s", "r"] },
    ],
    outputs: [{ id: "out", source: "t" }],
  };
  assert.equal(columnsOf(bookMajority).out, B.majority.target);
  assert.equal(bookMajority.gates.length, B.majority.book);
  assertFewest("majority", B.majority);
  assertFewest("exactly one of three", B.exactlyOne);
  assertFewest("the friend's table, small", B.friendSmall);
  assertFewest("row 0110", B.spike0110);
  // Exactly one of three needs more without XOR: the XOR in the palette matters.
  assert.ok(smallest(3, [B.exactlyOne.target], ["NOT", "AND", "OR"], 6) > 6);
});

