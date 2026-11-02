// Tests for the circuit problem machinery and for the keys of the pilot page.
// Run from Site/ with:  npm test
// (that is: node --experimental-strip-types --test tests/)
//
// No dependencies beyond Node 22. Every check that involves a circuit walks
// its complete truth table.

import { test } from "node:test";
import assert from "node:assert/strict";

import { evalGate, evalGateN, evaluate, type Bit, type Circuit, type GateType } from "../src/components/games/circuits/model.ts";
import * as gallery from "../src/components/games/circuits/circuits.ts";
import {
  checkNet,
  circuitDepth,
  columnsOf,
  evaluateNet,
  gateCount,
  netOf,
  outputsOf,
  resolveTarget,
  rowIndex,
  rowSetting,
  rowsMatching,
  tableOf,
  tableOfNet,
  topoOrder,
  wouldLoop,
  type Net,
} from "../src/components/games/circuits/problems/engine.ts";
import { gateInputPin, gateOutputPin, gateSize, layoutCircuit } from "../src/components/games/circuits/problems/layout.ts";
import * as bank from "../src/components/games/circuits/problems/banks/gates.ts";
import { fewestGates } from "./circuit-search.ts";

const TYPES: GateType[] = ["NOT", "AND", "OR", "XOR", "NAND", "NOR"];
const bits = (s: string) => [...s].map((c) => (c === "1" ? 1 : 0)) as Bit[];

// ---------------------------------------------------------------------------
//  Gates and evaluation
// ---------------------------------------------------------------------------

test("evalGateN agrees with evalGate on every two-input row", () => {
  for (const t of TYPES) for (const a of [0, 1] as Bit[]) for (const b of [0, 1] as Bit[]) {
    const want = evalGate(t, a, b);
    assert.equal(evalGateN(t, t === "NOT" ? [a] : [a, b]), want, `${t}(${a},${b})`);
  }
});

test("evalGateN on three inputs", () => {
  for (let r = 0; r < 8; r++) {
    const v = [(r >> 2) & 1, (r >> 1) & 1, r & 1] as Bit[];
    const ones = v.filter((x) => x === 1).length;
    assert.equal(evalGateN("AND", v), ones === 3 ? 1 : 0);
    assert.equal(evalGateN("OR", v), ones > 0 ? 1 : 0);
    assert.equal(evalGateN("XOR", v), ones % 2);
    assert.equal(evalGateN("NAND", v), ones === 3 ? 0 : 1);
    assert.equal(evalGateN("NOR", v), ones > 0 ? 0 : 1);
  }
});

test("evaluateNet matches model.evaluate on every gallery circuit, every row", () => {
  const circuits = Object.entries(gallery).filter(([, c]) => c && typeof c === "object" && "gates" in (c as object)) as [string, Circuit][];
  assert.ok(circuits.length >= 10);
  for (const [name, c] of circuits) {
    const net = netOf(c);
    for (let r = 0; r < 1 << c.inputs.length; r++) {
      const s = rowSetting(net.inputs, r);
      const old = evaluate(c, s);
      const neu = evaluateNet(net, s);
      for (const o of c.outputs) assert.equal(neu[o.source], old[o.source], `${name} row ${r}`);
    }
  }
});

test("gates may be listed in any order", () => {
  const c = gallery.majority3;
  const shuffled = { ...c, gates: [...c.gates].reverse() };
  assert.deepEqual(columnsOf(shuffled), columnsOf(c));
  assert.equal(columnsOf(c).out, "00010111");
});

test("loops are found, and a wire that would make one is refused", () => {
  const net: Net = {
    inputs: ["a"],
    gates: [
      { id: "g1", type: "AND", inputs: ["a", "g2"] },
      { id: "g2", type: "NOT", inputs: ["g1"] },
    ],
    outputs: [{ id: "out", source: "g2" }],
  };
  assert.equal(topoOrder(net), null);
  const ok: Net = {
    inputs: ["a", "b"],
    gates: [
      { id: "g1", type: "AND", inputs: ["a", "b"] },
      { id: "g2", type: "NOT", inputs: ["g1"] },
      { id: "g3", type: "OR", inputs: [null, null] },
    ],
    outputs: [{ id: "out", source: "g2" }],
  };
  assert.ok(topoOrder(ok));
  assert.equal(wouldLoop(ok, "g2", "g1"), true);   // g1 feeds g2
  assert.equal(wouldLoop(ok, "g1", "g1"), true);
  assert.equal(wouldLoop(ok, "g1", "g3"), false);
  assert.equal(wouldLoop(ok, "a", "g1"), false);
});

test("an empty pin leaves its gate, and everything after it, without a value", () => {
  const net: Net = {
    inputs: ["a"],
    gates: [
      { id: "g1", type: "AND", inputs: ["a", null] },
      { id: "g2", type: "NOT", inputs: ["g1"] },
    ],
    outputs: [{ id: "out", source: "g2" }, { id: "o2", source: null }],
  };
  const v = outputsOf(net, { a: 1 });
  assert.equal(v.out, undefined);
  assert.equal(v.o2, undefined);
});

// ---------------------------------------------------------------------------
//  Size and depth
// ---------------------------------------------------------------------------

test("depth counts every gate on the longest path, NOT included", () => {
  assert.equal(circuitDepth(netOf(gallery.orChain3)), 2);
  assert.equal(circuitDepth(netOf(gallery.andFromNotOr)), 3);
  assert.equal(circuitDepth(netOf(gallery.recipeWalkthrough)), 4);
  assert.equal(circuitDepth(netOf(gallery.notGate)), 1);
  const chain: Net = {
    inputs: ["a", "b", "c", "d"],
    gates: [
      { id: "x1", type: "XOR", inputs: ["a", "b"] },
      { id: "x2", type: "XOR", inputs: ["x1", "c"] },
      { id: "x3", type: "XOR", inputs: ["x2", "d"] },
    ],
    outputs: [{ id: "out", source: "x3" }],
  };
  const tree: Net = {
    inputs: ["a", "b", "c", "d"],
    gates: [
      { id: "x1", type: "XOR", inputs: ["a", "b"] },
      { id: "x2", type: "XOR", inputs: ["c", "d"] },
      { id: "x3", type: "XOR", inputs: ["x1", "x2"] },
    ],
    outputs: [{ id: "out", source: "x3" }],
  };
  assert.equal(gateCount(chain), 3);
  assert.equal(gateCount(tree), 3);
  assert.equal(circuitDepth(chain), 3);
  assert.equal(circuitDepth(tree), 2);
  assert.deepEqual(tableOfNet(chain).out, tableOfNet(tree).out);
  // A switch wired straight to a bulb has depth 0; a stray gate still counts toward size.
  const direct: Net = { inputs: ["a"], gates: [{ id: "g", type: "NOT", inputs: ["a"] }], outputs: [{ id: "out", source: "a" }] };
  assert.equal(circuitDepth(direct), 0);
  assert.equal(gateCount(direct), 1);
});

// ---------------------------------------------------------------------------
//  Rows and targets
// ---------------------------------------------------------------------------

test("rows run with the first input as the slowest column", () => {
  assert.deepEqual(rowSetting(["a", "b"], 0), { a: 0, b: 0 });
  assert.deepEqual(rowSetting(["a", "b"], 1), { a: 0, b: 1 });
  assert.deepEqual(rowSetting(["a", "b"], 2), { a: 1, b: 0 });
  assert.deepEqual(rowSetting(["a", "b", "c"], 6), { a: 1, b: 1, c: 0 });
  for (let r = 0; r < 16; r++) assert.equal(rowIndex(["p", "q", "r", "s"], rowSetting(["p", "q", "r", "s"], r)), r);
});

test("targets in every accepted form resolve to the same columns", () => {
  const ins = ["a", "b"];
  const want = { out: bits("0110") };
  for (const spec of ["0110", "01 10", "0_1|1_0", [0, 1, 1, 0], [false, true, true, false], (v: Record<string, Bit>) => v.a ^ v.b, (v: Record<string, Bit>) => v.a !== v.b, { out: "0110" }]) {
    const r = resolveTarget(spec as never, ins, ["out"]);
    assert.ok(r.ok, JSON.stringify(spec));
    if (r.ok) assert.deepEqual(r.cols, want);
  }
  const multi = resolveTarget((v) => ({ door: v.a & v.b, bomb: v.a & (v.b ^ 1) }), ins, ["door", "bomb"]);
  assert.ok(multi.ok);
  if (multi.ok) assert.deepEqual(multi.cols, { door: bits("0001"), bomb: bits("0010") });
});

test("malformed targets are refused with a message", () => {
  const bad: [unknown, string[]][] = [
    ["011", ["out"]],
    ["01102", ["out"]],
    ["0110", ["x", "y"]],
    [{ x: "0110" }, ["x", "y"]],
    [{ x: "0110", y: "0110", z: "0000" }, ["x", "y"]],
    [undefined, ["out"]],
    [(v: Record<string, Bit>) => v.a, ["x", "y"]],
  ];
  for (const [spec, outs] of bad) {
    const r = resolveTarget(spec as never, ["a", "b"], outs);
    assert.equal(r.ok, false, JSON.stringify(spec));
    if (!r.ok) assert.ok(r.error.length > 10);
  }
});

test("tableOf gives plain strings that resolve to the function's columns", () => {
  assert.equal(tableOf(["a", "b", "c"], (v) => v.a | v.b | v.c), "01111111");
  assert.deepEqual(tableOf(["a", "b"], (v) => ({ door: v.a & v.b, bomb: v.a })), { door: "0001", bomb: "0011" });
  const fn = (v: Record<string, Bit>) => (v.a & v.b) | (v.c ^ 1);
  const a = resolveTarget(fn, ["a", "b", "c"], ["out"]);
  const b = resolveTarget(tableOf(["a", "b", "c"], fn), ["a", "b", "c"], ["out"]);
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------------------
//  The check
// ---------------------------------------------------------------------------

const cols = (s: Record<string, string>) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, bits(v)]));

test("check: a correct circuit passes, and reports rows, size and depth", () => {
  const r = checkNet(netOf(gallery.xorFromBasics), cols({ out: "0110" }));
  assert.deepEqual(r, { status: "ok", rows: 4, gates: 5, depth: 3 });
});

test("check: a wrong circuit reports the FIRST wrong row and every wrong bulb on it", () => {
  const r = checkNet(netOf(gallery.orChain3), cols({ out: "01111110" }));
  assert.equal(r.status, "wrong");
  if (r.status === "wrong") {
    assert.equal(r.row, 7);
    assert.deepEqual(r.setting, { a: 1, b: 1, c: 1 });
    assert.deepEqual(r.wrong, [{ output: "out", want: 0, got: 1 }]);
  }
  const two: Net = {
    inputs: ["a"],
    gates: [{ id: "n", type: "NOT", inputs: ["a"] }],
    outputs: [{ id: "x", source: "a" }, { id: "y", source: "n" }],
  };
  const r2 = checkNet(two, cols({ x: "10", y: "01" }));
  assert.equal(r2.status, "wrong");
  if (r2.status === "wrong") assert.deepEqual(r2.wrong.map((w) => w.output), ["x", "y"]);
});

test("check: structure first, then the table, then the limits", () => {
  const unwired: Net = { inputs: ["a"], gates: [], outputs: [{ id: "out", source: null }] };
  assert.equal(checkNet(unwired, cols({ out: "01" })).status, "unwired-output");
  const empty: Net = { inputs: ["a"], gates: [{ id: "g", type: "AND", inputs: ["a", null] }], outputs: [{ id: "out", source: "a" }] };
  assert.deepEqual(checkNet(empty, cols({ out: "01" })), { status: "empty-pin", gates: ["g"] });
  // Over the gate limit AND wrong: the wrong table is what is reported.
  assert.equal(checkNet(netOf(gallery.orChain3), cols({ out: "00000001" }), { maxGates: 1 }).status, "wrong");
  // Right table, then each limit in turn.
  const net = netOf(gallery.andFromNotOr);
  const t = cols({ out: "0001" });
  assert.deepEqual(checkNet(net, t, { maxGates: 3 }), { status: "too-many-gates", gates: 4, limit: 3 });
  assert.deepEqual(checkNet(net, t, { maxDepth: 2 }), { status: "too-deep", depth: 3, limit: 2 });
  assert.deepEqual(checkNet(net, t, { allowed: ["AND", "OR"] }), { status: "not-allowed", type: "NOT" });
  assert.deepEqual(checkNet(net, t, { maxPerType: { NOT: 2 } }), { status: "too-many-of-type", type: "NOT", count: 3, limit: 2 });
  assert.equal(checkNet(net, t, { maxGates: 4, maxDepth: 3, allowed: ["NOT", "OR"], maxPerType: { NOT: 3 } }).status, "ok");
  const wide: Net = { inputs: ["a", "b", "c"], gates: [{ id: "g", type: "AND", inputs: ["a", "b", "c"] }], outputs: [{ id: "out", source: "g" }] };
  assert.deepEqual(checkNet(wide, cols({ out: "00000001" })), { status: "too-many-inputs", gate: "g", inputs: 3, limit: 2 });
  assert.equal(checkNet(wide, cols({ out: "00000001" }), { maxFanIn: 3 }).status, "ok");
});

// ---------------------------------------------------------------------------
//  Layout
// ---------------------------------------------------------------------------

test("automatic layout places every node, left to right, without overlaps", () => {
  const specs = [
    bank.readWires, bank.disguised, bank.whichTableCircuit, bank.litAndDark, bank.stuck, bank.everySetting,
    ...bank.boxOptions, ...bank.atLeastOneOptions,
    { inputs: gallery.majority3.inputs.map((i) => ({ id: i.id })), gates: gallery.majority3.gates.map((g) => ({ id: g.id, type: g.type, inputs: g.inputs })), outputs: [{ id: "out", source: "or2" }] },
  ];
  for (const spec of specs) {
    const c = layoutCircuit(spec);
    const pos = new Map<string, { x: number; y: number; right: number }>();
    for (const i of c.inputs) { assert.ok(Number.isFinite(i.x) && Number.isFinite(i.y)); pos.set(i.id, { x: i.x, y: i.y, right: i.x + 20 }); }
    for (const g of c.gates) {
      assert.ok(Number.isFinite(g.x) && Number.isFinite(g.y));
      pos.set(g.id, { x: g.x, y: g.y, right: g.x + gateOutputPin(g.type, g.inputs.length).x });
    }
    for (const g of c.gates) for (const s of g.inputs) assert.ok(pos.get(s)!.right < g.x + gateInputPin(g.type, g.inputs.length, 0).x, `${g.id} sits right of ${s}`);
    for (const o of c.outputs) assert.ok(pos.get(o.source)!.right < o.x - 20);
    for (const g of c.gates) for (const h of c.gates) if (g !== h && g.x === h.x) {
      const gap = Math.abs(g.y - h.y), need = (gateSize(g.type, g.inputs.length).h + gateSize(h.type, h.inputs.length).h) / 2;
      assert.ok(gap >= need, `${g.id} and ${h.id} overlap`);
    }
    for (const n of [...c.inputs, ...c.gates, ...c.outputs]) { assert.ok(n.x > 0 && n.x < c.width); assert.ok(n.y > 0 && n.y < c.height); }
  }
});

test("a fully placed circuit keeps its coordinates", () => {
  const c = layoutCircuit(gallery.xorFromBasics);
  assert.deepEqual(c.gates.map((g) => [g.x, g.y]), gallery.xorFromBasics.gates.map((g) => [g.x, g.y]));
  assert.equal(c.width, gallery.xorFromBasics.width);
});

// ---------------------------------------------------------------------------
//  Keys of the pilot page, logic-gates/gates.mdx
// ---------------------------------------------------------------------------

const column = (spec: Parameters<typeof columnsOf>[0], out = "out") => columnsOf(spec)[out];

test("gates page 1: exactly the keyed gate fits all three sightings", () => {
  const fits = bank.boxOptions.map((c, k) => [k, bank.boxSightings.every((s) => outputsOf(netOf(c), rowSetting(["a", "b"], parseInt(s.switches, 2))).out === Number(s.bulb))] as const);
  assert.deepEqual(fits.filter(([, ok]) => ok).map(([k]) => k), [bank.boxAnswer]);
});

test("gates page 2: the wires asked about do not all carry the same value", () => {
  const v = evaluateNet(netOf(bank.readWires), rowSetting(["a", "b", "c"], parseInt(bank.readWiresSwitches, 2)));
  const asked = [...bank.readWiresTags.map((t) => v[t.wire]), v.r];
  assert.ok(asked.includes(0) && asked.includes(1));
});

test("gates page 4: exactly the keyed table belongs to the circuit", () => {
  const truth = column(bank.whichTableCircuit);
  const hits = bank.whichTableOptions.map((o, k) => [k, o.table.outputs.bulb === truth] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, [bank.whichTableAnswer]);
});

test("gates page 5: one setting, and only one, lights left and darkens right", () => {
  assert.deepEqual(rowsMatching(netOf(bank.litAndDark), bank.litAndDarkGoal), [7]);
});

test("gates page 7: with b stuck down there is a setting that lights the bulb, and it is unique", () => {
  const rows = rowsMatching(netOf(bank.stuck), { out: 1 }).filter((r) => rowSetting(["a", "b", "c"], r).b === bank.stuckFixed.b);
  assert.equal(rows.length, 1);
});

test("gates page 9: the count of lighting settings is as recorded", () => {
  assert.equal(rowsMatching(netOf(bank.everySetting), { out: 1 }).length, bank.everySettingCount);
});

test("gates page 11: the keyed options are exactly the ones that mean 'at least one is up'", () => {
  const want = tableOf(["a", "b", "c"], (v) => v.a | v.b | v.c);
  const hits = bank.atLeastOneOptions.map((c, k) => [k, column(c) === want] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, bank.atLeastOneAnswer);
});

test("gates page build problems: each target is the stated rule, and its gate limit is exactly the fewest possible", () => {
  // The rule each statement states, written independently of the key.
  assert.equal(bank.threeKeys.target, tableOf(bank.threeKeys.inputs, (v) => v.a & v.b & v.c));
  assert.equal(bank.bothDown.target, tableOf(bank.bothDown.inputs, (v) => (v.a | v.b) ^ 1));
  assert.deepEqual(bank.agreeDisagree.target, tableOf(bank.agreeDisagree.inputs, (v) => ({ same: v.a === v.b, differ: v.a !== v.b })));
  assert.equal(bank.fourStairs.target, tableOf(bank.fourStairs.inputs, (v) => v.a ^ v.b ^ v.c ^ v.d));
  // "Any single flip changes the bulb", checked directly on the four-switch table.
  const t = bank.fourStairs.target;
  for (let r = 0; r < 16; r++) for (let k = 0; k < 4; k++) assert.notEqual(t[r], t[r ^ (1 << k)]);
  assert.equal(t[0], "0");

  const cases: [string, string[], string[], GateType[], number][] = [
    ["three keys", bank.threeKeys.inputs, [bank.threeKeys.target], bank.threeKeys.gates, bank.threeKeys.maxGates],
    ["both down", bank.bothDown.inputs, [bank.bothDown.target], bank.bothDown.gates, bank.bothDown.maxGates],
    ["agree and disagree", bank.agreeDisagree.inputs, [bank.agreeDisagree.target.same, bank.agreeDisagree.target.differ], bank.agreeDisagree.gates, bank.agreeDisagree.maxGates],
    ["four stairs", bank.fourStairs.inputs, [bank.fourStairs.target], bank.fourStairs.gates, bank.fourStairs.maxGates],
  ];
  for (const [name, ins, targets, palette, max] of cases) {
    assert.equal(fewestGates(ins, targets, palette, max + 1), max, name);
  }
});
