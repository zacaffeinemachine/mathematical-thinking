// Keys of logic-gates/if-then.mdx (book Section 6.3, If Then Circuits).
// Run from Site/ with:  npm test
//
// Every check walks the complete truth table. Each claim the page states is
// written here again, independently, as a plain function of the switches,
// using the one rule of the section: "if P then Q" fails exactly when P
// holds and Q fails. Build problems are checked by exhaustive search: the
// limit can be met, and not with one gate fewer.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Bit } from "../src/components/games/circuits/model.ts";
import { columnsOf, evaluateNet, netOf, outputsOf, rowSetting, rowsMatching, tableOf } from "../src/components/games/circuits/problems/engine.ts";
import { layoutCircuit } from "../src/components/games/circuits/problems/layout.ts";
import * as B from "../src/components/games/circuits/problems/banks/if-then.ts";
import { fewestGates } from "./circuit-search.ts";

type V = Record<string, Bit>;
const not = (x: number) => (x ? 0 : 1);
// "if P then Q", as a truth value.
const ifThen = (p: number, q: number) => (p && !q ? 0 : 1);
// "P unless Q", read as "if Q fails, then P".
const unless = (p: number, q: number) => ifThen(not(q), p);
const iff = (p: number, q: number) => (p === q ? 1 : 0);
const col = (spec: Parameters<typeof columnsOf>[0], out = "out") => columnsOf(spec)[out];
const AB = ["a", "b"], ABC = ["a", "b", "c"];

test("if-then: every fixed circuit on the page lays out without error", () => {
  const all = [
    B.rainCoat, B.converseBox, ...B.contraOptions, B.petBox, B.claimConverse, B.disagreeBox, B.orDownBox,
    B.nestedBox, ...B.sameClaimOptions, ...B.iffOptions,
  ];
  for (const c of all) assert.doesNotThrow(() => layoutCircuit(c));
});

test("if-then 1: the rain-and-coat box is the claim, and at 10 its asked values are mixed", () => {
  assert.equal(col(B.rainCoat), tableOf(["rain", "coat"], (v) => ifThen(v.rain, v.coat)));
  const v = evaluateNet(netOf(B.rainCoat), rowSetting(["rain", "coat"], parseInt(B.rainCoatSwitches, 2)));
  assert.equal(v.n, 0);
  assert.equal(v.o, 0);
  // The setting asked about is the one that breaks the claim.
  assert.equal(ifThen(1, 0), 0);
});

test("if-then 2: the box is the converse", () => {
  assert.equal(col(B.converseBox), tableOf(AB, (v) => ifThen(v.b, v.a)));
});

test("if-then 3: exactly the keyed claim fits all three sightings", () => {
  const claims = [
    (v: V) => ifThen(v.a, v.b),
    (v: V) => ifThen(v.b, v.a),
    (v: V) => unless(v.a, v.b),
    (v: V) => iff(v.a, v.b),
  ];
  assert.equal(claims.length, B.sightingClaims.length);
  const fits = claims.map((f) => B.sightings.every((s) => f(rowSetting(AB, parseInt(s.switches, 2)) as V) === Number(s.bulb)));
  assert.deepEqual(fits.map((ok, k) => (ok ? k : -1)).filter((k) => k >= 0), [B.sightingAnswer]);
});

test("if-then build problems: each target is the rule as the statement words it", () => {
  // Children under ten must have an adult with them.
  assert.equal(B.pool.target, tableOf(B.pool.inputs, (v) => ifThen(v.child, v.adult)));
  // If the shop is closed, the sign shows CLOSED. (open up: shop open; sign up: sign shows OPEN)
  assert.equal(B.shop.target, tableOf(B.shop.inputs, (v) => ifThen(not(v.open), not(v.sign))));
  // If the saw is running, the guard is closed. (open up: guard open)
  assert.equal(B.saw.target, tableOf(B.saw.inputs, (v) => ifThen(v.running, not(v.open))));
  // The match is played unless it rains.
  assert.equal(B.match.target, tableOf(B.match.inputs, (v) => unless(v.played, v.rain)));
  // The lights are off unless someone is in the room. (light up: light on)
  assert.equal(B.lights.target, tableOf(B.lights.inputs, (v) => unless(not(v.light), v.someone)));
  // If you use the laser, you wear goggles and gloves.
  assert.equal(B.laser.target, tableOf(B.laser.inputs, (v) => ifThen(v.laser, v.goggles & v.gloves)));
  // If you arrive late, you bring a note or a parent.
  assert.equal(B.late.target, tableOf(B.late.inputs, (v) => ifThen(v.late, v.note | v.parent)));
  // The green lamp is lit if and only if both keys are turned. Bulb: the lamp behaves.
  assert.equal(B.vault.target, tableOf(B.vault.inputs, (v) => iff(v.lamp, v.left & v.right)));
  // If (if a is up, then b is up), then c is up.
  assert.equal(B.ifInIf.target, tableOf(B.ifInIf.inputs, (v) => ifThen(ifThen(v.a, v.b), v.c)));
  // a is up if and only if b is up.
  assert.equal(B.iffNoXor.target, tableOf(B.iffNoXor.inputs, (v) => iff(v.a, v.b)));
  // If you roll a six, you move. If you move, you draw a card. Both rules kept.
  assert.equal(B.twoRules.target, tableOf(B.twoRules.inputs, (v) => ifThen(v.six, v.move) & ifThen(v.move, v.card)));
});

test("if-then build problems: every gate limit is exactly the fewest possible", () => {
  const cases = [
    ["pool", B.pool], ["shop", B.shop], ["saw", B.saw], ["match", B.match], ["lights", B.lights],
    ["laser", B.laser], ["late", B.late], ["vault", B.vault],
    ["if inside if", B.ifInIf], ["iff without XOR", B.iffNoXor], ["two rules", B.twoRules],
  ] as const;
  for (const [name, p] of cases) {
    assert.equal(fewestGates([...p.inputs], [p.target], [...p.gates], p.maxGates + 1), p.maxGates, name);
  }
  // The iff problem really forbids XOR.
  assert.ok(!B.iffNoXor.gates.includes("XOR"));
});

test("if-then 9: the keyed boxes are exactly those for 'if b is down, then a is down'", () => {
  const want = tableOf(AB, (v) => ifThen(not(v.b), not(v.a)));
  const hits = B.contraOptions.map((c, k) => (col(c) === want ? k : -1)).filter((k) => k >= 0);
  assert.deepEqual(hits, B.contraAnswer);
});

test("if-then 10: the pet box is its claim, and exactly the keyed sentences share it", () => {
  const P = ["dog", "cat"];
  const box = tableOf(P, (v) => ifThen(v.dog, not(v.cat)));
  assert.equal(col(B.petBox), box);
  const sentences = [
    (v: V) => ifThen(v.cat, not(v.dog)),
    (v: V) => ifThen(not(v.dog), v.cat),
    (v: V) => ifThen(not(v.cat), v.dog),
    (v: V) => not(v.dog & v.cat),
    (v: V) => unless(v.dog, v.cat),
  ];
  assert.equal(sentences.length, B.petSentences.length);
  const hits = sentences.map((f, k) => (tableOf(P, f) === box ? k : -1)).filter((k) => k >= 0);
  assert.deepEqual(hits, B.petAnswer);
});

test("if-then 11: one setting, and only one, keeps the claim and breaks the converse", () => {
  const t = columnsOf(B.claimConverse);
  assert.equal(t.claim, tableOf(AB, (v) => ifThen(v.a, v.b)));
  assert.equal(t.converse, tableOf(AB, (v) => ifThen(v.b, v.a)));
  assert.deepEqual(rowsMatching(netOf(B.claimConverse), B.claimConverseGoal), [1]);
});

test("if-then 14: the box is its claim, and exactly two settings break it", () => {
  assert.equal(col(B.disagreeBox), tableOf(ABC, (v) => ifThen(v.a, v.b ^ v.c)));
  assert.deepEqual(rowsMatching(netOf(B.disagreeBox), B.disagreeGoal), [4, 7]);
});

test("if-then 15: the box is its claim, and at 011 the asked values are mixed", () => {
  assert.equal(col(B.orDownBox), tableOf(ABC, (v) => ifThen(v.a | v.b, not(v.c))));
  const v = outputsOf(netOf(B.orDownBox), rowSetting(ABC, parseInt(B.orDownSwitches, 2)));
  const all = evaluateNet(netOf(B.orDownBox), rowSetting(ABC, parseInt(B.orDownSwitches, 2)));
  const asked = [...B.orDownTags.map((t) => all[t.wire]), v.out];
  assert.ok(asked.includes(0) && asked.includes(1));
});

test("if-then 16: the nested box is its claim, and exactly one setting darkens it", () => {
  assert.equal(col(B.nestedBox), tableOf(ABC, (v) => ifThen(v.a, ifThen(v.b, v.c))));
  assert.deepEqual(rowsMatching(netOf(B.nestedBox), B.nestedGoal), [6]);
});

test("if-then 17: exactly the keyed boxes check the same claim as the nested one", () => {
  const want = tableOf(ABC, (v) => ifThen(v.a, ifThen(v.b, v.c)));
  // Each option is the claim its comment names.
  assert.equal(col(B.sameClaimOptions[0]), tableOf(ABC, (v) => ifThen(v.a & v.b, v.c)));
  assert.equal(col(B.sameClaimOptions[1]), tableOf(ABC, (v) => ifThen(v.a | v.b, v.c)));
  assert.equal(col(B.sameClaimOptions[2]), tableOf(ABC, (v) => ifThen(v.b, ifThen(v.a, v.c))));
  assert.equal(col(B.sameClaimOptions[3]), tableOf(ABC, (v) => ifThen(ifThen(v.a, v.b), v.c)));
  const hits = B.sameClaimOptions.map((c, k) => (col(c) === want ? k : -1)).filter((k) => k >= 0);
  assert.deepEqual(hits, B.sameClaimAnswer);
});

test("if-then 18: exactly the keyed boxes are 'a is up if and only if b is up'", () => {
  const want = tableOf(AB, (v) => iff(v.a, v.b));
  const hits = B.iffOptions.map((c, k) => (col(c) === want ? k : -1)).filter((k) => k >= 0);
  assert.deepEqual(hits, B.iffAnswer);
  // The "claim or converse" option lights on every setting.
  assert.equal(col(B.iffOptions[3]), "1111");
});

test("if-then: the example settings printed in build statements agree with the targets", () => {
  // [problem, inputs, target, setting, bulb]
  const shown: [string, string[], string, string, string][] = [
    ["4 pool", B.pool.inputs, B.pool.target, "10", "0"],
    ["4 pool", B.pool.inputs, B.pool.target, "11", "1"],
    ["12 laser", B.laser.inputs, B.laser.target, "111", "1"],
    ["12 laser", B.laser.inputs, B.laser.target, "110", "0"],
    ["19 vault", B.vault.inputs, B.vault.target, "110", "0"],
    ["19 vault", B.vault.inputs, B.vault.target, "100", "1"],
  ];
  for (const [name, ins, target, setting, bulb] of shown) {
    assert.equal(setting.length, ins.length, name);
    assert.equal(target[parseInt(setting, 2)], bulb, `${name} at ${setting}`);
  }
});
