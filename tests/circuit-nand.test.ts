// Keys and limits of logic-gates/nand.mdx (book Section 6.6).
// Run from Site/ with:  npm test
//
// Every check walks complete truth tables. Every build limit is proved to be
// exactly the fewest possible: a circuit within the limit exists, and no
// circuit with one gate fewer does. No solution circuit is written down.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { CircuitSpec } from "../src/components/games/circuits/model.ts";
import { columnsOf, evaluateNet, netOf, outputsOf, rowSetting, rowsMatching, tableOf } from "../src/components/games/circuits/problems/engine.ts";
import * as bank from "../src/components/games/circuits/problems/banks/nand.ts";
import { fewestGates } from "./circuit-search.ts";

const column = (spec: CircuitSpec, out = "out") => columnsOf(spec)[out];
const settingOf = (inputs: string[], bits: string) => rowSetting(inputs, parseInt(bits, 2));
const typesIn = (c: CircuitSpec) => new Set(c.gates.map((g) => g.type));

// The fewest NAND gates, each with two or three inputs, that produce every
// target column. Same method as circuit-search.ts (try every circuit up to
// `limit` gates), widened to three-input gates for the last problem.
function fewestWideNands(inputs: string[], targets: string[], limit: number): number {
  const n = inputs.length, R = 1 << n, FULL = (1 << R) - 1;
  const maskOf = (col: string) => [...col].reduce((m, ch, r) => (ch === "1" ? m | (1 << r) : m), 0);
  const want = targets.map(maskOf);
  const base = inputs.map((_, i) => { let m = 0; for (let r = 0; r < R; r++) if ((r >> (n - 1 - i)) & 1) m |= 1 << r; return m; });
  let best = Infinity;
  const dfs = (nodes: number[], used: number) => {
    if (want.every((w) => nodes.includes(w))) { best = Math.min(best, used); return; }
    if (used >= limit || used + 1 >= best) return;
    const L = nodes.length;
    for (let i = 0; i < L; i++) for (let j = i; j < L; j++) {
      const ab = nodes[i] & nodes[j];
      dfs([...nodes, ~ab & FULL], used + 1);
      for (let k = j; k < L; k++) dfs([...nodes, ~(ab & nodes[k]) & FULL], used + 1);
    }
  };
  dfs(base, 0);
  return best;
}

// ---------------------------------------------------------------------------
//  The reading problems
// ---------------------------------------------------------------------------

test("nand page: every NAND circuit shown is made of NAND gates only, and the NOR one of NOR only", () => {
  const nandCircuits = [bank.twoNands, bank.readWires, bank.oneDark, ...bank.whichOrOptions, ...bank.alwaysLitOptions, ...bank.boxOptions];
  for (const c of nandCircuits) assert.deepEqual([...typesIn(c)], ["NAND"]);
  assert.deepEqual([...typesIn(bank.norFill)], ["NOR"]);
});

test("nand page 1: the two-NAND circuit has the table 1011, and p is a plain NAND of a and b", () => {
  assert.equal(column(bank.twoNands), tableOf(["a", "b"], (v) => v.a | (v.b ^ 1)));
  const net = netOf(bank.twoNands);
  for (let r = 0; r < 4; r++) {
    const s = rowSetting(["a", "b"], r);
    assert.equal(evaluateNet(net, s).p, (s.a & s.b) ^ 1);
  }
});

test("nand page 2: the asked wires are p = 1, q = 0 and the bulb lit, so not all the same", () => {
  const v = evaluateNet(netOf(bank.readWires), settingOf(["a", "b", "c"], bank.readWiresSwitches));
  assert.equal(v.p, 1);
  assert.equal(v.q, 0);
  assert.equal(v.r, 1);
});

test("nand page 3: exactly the keyed option is an OR", () => {
  const want = tableOf(["a", "b"], (v) => v.a | v.b);
  const hits = bank.whichOrOptions.map((c, k) => [k, column(c) === want] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, [bank.whichOrAnswer]);
  // the distractors are AND, "a up or b down", and "neither up"
  assert.deepEqual(bank.whichOrOptions.map((c) => column(c)), ["0001", "1011", "0111", "1000"]);
});

test("nand page 4: exactly one setting darkens the bulb, and it is a up, b down, c up", () => {
  assert.deepEqual(rowsMatching(netOf(bank.oneDark), bank.oneDarkGoal), [parseInt("101", 2)]);
});

test("nand page 5: the keyed options are exactly the ones lit on every setting", () => {
  const hits = bank.alwaysLitOptions.map((c, k) => [k, column(c) === "1111"] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, bank.alwaysLitAnswer);
});

test("nand page 6: exactly the keyed circuit fits all three sightings", () => {
  const fits = bank.boxOptions.map((c, k) =>
    [k, bank.boxSightings.every((s) => outputsOf(netOf(c), settingOf(["a", "b"], s.switches)).out === Number(s.bulb))] as const);
  assert.deepEqual(fits.filter(([, ok]) => ok).map(([k]) => k), [bank.boxAnswer]);
  assert.equal(column(bank.boxOptions[bank.boxAnswer]), tableOf(["a", "b"], (v) => (v.a & (v.b ^ 1)) ^ 1));
});

test("nand page NOR table: the NOR circuit lights only for a up, b down", () => {
  assert.equal(column(bank.norFill), "0010");
  assert.deepEqual(rowsMatching(netOf(bank.norFill), { out: 1 }), [2]);
});

// ---------------------------------------------------------------------------
//  The build problems
// ---------------------------------------------------------------------------

test("nand page build targets: each is the rule its statement states", () => {
  const ab = ["a", "b"], abc = ["a", "b", "c"];
  assert.equal(bank.buildNot.target, tableOf(["a"], (v) => v.a ^ 1));
  assert.equal(bank.buildAnd.target, tableOf(ab, (v) => v.a & v.b));
  assert.equal(bank.buildOr.target, tableOf(ab, (v) => v.a | v.b));
  assert.equal(bank.alwaysDark.target, tableOf(["a"], () => 0));
  assert.equal(bank.ifThen.target, tableOf(ab, (v) => !(v.a === 1 && v.b === 0)));
  assert.equal(bank.upDownLock.target, tableOf(ab, (v) => v.a === 1 && v.b === 0));
  assert.equal(bank.threeKeys.target, tableOf(abc, (v) => v.a & v.b & v.c));
  assert.equal(bank.chooser.target, tableOf(abc, (v) => (v.c === 1 ? v.a : v.b)));
  assert.equal(bank.norOr.target, tableOf(ab, (v) => v.a | v.b));
  assert.equal(bank.norAnd.target, tableOf(ab, (v) => v.a & v.b));
  assert.equal(bank.norIfThen.target, tableOf(ab, (v) => !(v.a === 1 && v.b === 0)));
  assert.equal(bank.nandXor.target, tableOf(ab, (v) => v.a ^ v.b));
  assert.deepEqual(bank.agreeDiffer.target, tableOf(ab, (v) => ({ same: v.a === v.b, differ: v.a !== v.b })));
  assert.equal(bank.fireAlarm.target, tableOf(abc, (v) => v.a | v.b | v.c));
  assert.equal(bank.majority.target, tableOf(abc, (v) => v.a + v.b + v.c >= 2));
  assert.equal(bank.norXor.target, tableOf(ab, (v) => v.a ^ v.b));
  assert.equal(bank.wideMajority.target, tableOf(abc, (v) => v.a + v.b + v.c >= 2));
});

test("nand page build statements: every pictured setting agrees with the target", () => {
  const at = (col: string, bits: string) => col[parseInt(bits, 2)];
  const onlyRow = (col: string, bits: string, value: "0" | "1") =>
    [...col].forEach((ch, r) => assert.equal(ch, r === parseInt(bits, 2) ? value : value === "1" ? "0" : "1"));
  // 7: down lit, up dark.  10: dark both ways.
  assert.equal(bank.buildNot.target, "10");
  assert.equal(bank.alwaysDark.target, "00");
  // 11 and 18: "10 gives dark, every other setting gives lit", i.e. the claim fails on one setting only.
  onlyRow(bank.ifThen.target as string, "10", "0");
  onlyRow(bank.norIfThen.target as string, "10", "0");
  // 12: "10 gives lit, every other setting gives dark".
  onlyRow(bank.upDownLock.target as string, "10", "1");
  // 13: 111 lit, 110 dark.
  assert.equal(at(bank.threeKeys.target as string, "111"), "1");
  assert.equal(at(bank.threeKeys.target as string, "110"), "0");
  // 14 and 22: the sealed-box sightings.
  for (const s of bank.chooserSightings) assert.equal(at(bank.chooser.target as string, s.switches), s.bulb);
  for (const s of bank.majoritySightings) assert.equal(at(bank.majority.target as string, s.switches), s.bulb);
  // 20: 00 gives same lit, differ dark; 01 gives the reverse.
  const ad = bank.agreeDiffer.target as Record<string, string>;
  assert.deepEqual([at(ad.same, "00"), at(ad.differ, "00"), at(ad.same, "01"), at(ad.differ, "01")], ["1", "0", "0", "1"]);
  // 21: "000 gives a silent bell, every other setting rings it".
  onlyRow(bank.fireAlarm.target as string, "000", "0");
});

test("nand page build limits: each limit can be met, and no circuit with one gate fewer works", () => {
  const two: [string, bank.Build][] = [
    ["NOT from NAND", bank.buildNot],
    ["AND from NAND", bank.buildAnd],
    ["OR from NAND", bank.buildOr],
    ["always dark", bank.alwaysDark],
    ["if-then box", bank.ifThen],
    ["up-down lock", bank.upDownLock],
    ["three keys", bank.threeKeys],
    ["chooser", bank.chooser],
    ["OR from NOR", bank.norOr],
    ["AND from NOR", bank.norAnd],
    ["if-then from NOR", bank.norIfThen],
    ["XOR from NAND", bank.nandXor],
    ["agree and differ", bank.agreeDiffer],
    ["fire alarm", bank.fireAlarm],
    ["majority", bank.majority],
    ["XOR from NOR", bank.norXor],
  ];
  for (const [name, b] of two) {
    assert.equal(b.maxFanIn ?? 2, 2, name);
    const targets = typeof b.target === "string" ? [b.target] : (b.outputs ?? []).map((o) => (b.target as Record<string, string>)[o]);
    assert.equal(targets.length, (b.outputs ?? ["out"]).length, name);
    assert.equal(fewestGates(b.inputs, targets, b.gates, b.maxGates + 1), b.maxGates, name);
  }
});

test("nand page wide majority: NANDs with two or three inputs need exactly 4 gates", () => {
  const b = bank.wideMajority;
  assert.equal(b.maxFanIn, 3);
  assert.deepEqual(b.gates, ["NAND"]);
  assert.equal(fewestWideNands(b.inputs, [b.target as string], b.maxGates + 1), b.maxGates);
  // and the three-input gate really helps: with two-input NANDs alone it takes 6
  assert.equal(fewestGates(b.inputs, [b.target as string], ["NAND"], 7), 6);
});

test("nand page wide search agrees with circuit-search when only two-input gates could help", () => {
  // Sanity check of the widened search: it can never need more gates than
  // circuit-search, and on one switch the third input changes nothing.
  assert.equal(fewestWideNands(["a"], ["10"], 3), 1);
  assert.equal(fewestWideNands(["a"], ["00"], 4), 3);
  assert.equal(fewestWideNands(["a", "b"], ["0110"], 5), 4);
  assert.equal(fewestWideNands(["a", "b", "c"], ["11111110"], 3), 1);
});
