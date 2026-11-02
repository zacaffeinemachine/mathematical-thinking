// Keys of logic-gates/isles.mdx ("Puzzles in Wires", book Section 6.7).
// Run from Site/ with:  npm test
//
// Every puzzle is encoded again here, straight from the sentences the page
// prints, and its consistent settings are found by trying every row. Each
// circuit, target and key in banks/isles.ts is then checked against that,
// row by row. Each gate limit is checked to be exactly the fewest possible
// with fewestGates from circuit-search.ts, which tries every circuit up to
// the limit; no solution circuit is written down anywhere.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Bit, CircuitSpec, GateType } from "../src/components/games/circuits/model.ts";
import { columnsOf, netOf, rowCount, rowSetting, rowsMatching, tableOf, topoOrder, wireColumn } from "../src/components/games/circuits/problems/engine.ts";
import { layoutCircuit } from "../src/components/games/circuits/problems/layout.ts";
import * as B from "../src/components/games/circuits/problems/banks/isles.ts";
import { fewestGates } from "./circuit-search.ts";

type W = Record<string, Bit>;
type Claim = (w: W) => boolean;

// The column (one character per row, first switch slowest) of the settings in
// which every speaker's type agrees with the truth of her claim, and anything
// we were told holds.
function consistency(switches: string[], claims: Record<string, Claim>, told: Claim = () => true): string {
  let col = "";
  for (let r = 0; r < rowCount(switches); r++) {
    const w = rowSetting(switches, r);
    const ok = told(w) && Object.entries(claims).every(([who, c]) => (w[who] === 1) === c(w));
    col += ok ? "1" : "0";
  }
  return col;
}
const claimColumn = (switches: string[], c: Claim) => tableOf(switches, (w) => c(w)) as string;
const rowsOf = (col: string) => [...col].flatMap((ch, r) => (ch === "1" ? [r] : []));
const bitsOfRow = (switches: string[], r: number) => switches.map((s) => rowSetting(switches, r)[s]).join("");
const out = (c: CircuitSpec) => columnsOf(c).out;
const oracles = (w: W, who: string[]) => who.filter((x) => w[x] === 1).length;
const ifThen = (p: boolean, q: boolean) => !p || q;   // false only when the if-part holds and the then-part fails

// ---------------------------------------------------------------------------
//  Every circuit on the page is well formed and lays out
// ---------------------------------------------------------------------------

const drawn: [string, CircuitSpec][] = [
  ...B.atLeastOneOptions.map((c, k) => [`atLeastOne ${k}`, c] as [string, CircuitSpec]),
  ...B.ifThenOptions.map((c, k) => [`ifThen ${k}`, c] as [string, CircuitSpec]),
  ...B.pickOptions.map((c, k) => [`pick ${k}`, c] as [string, CircuitSpec]),
  ["bash", B.bash], ["ruby", B.ruby], ["count", B.countCircuit], ["three", B.threeCircuit],
  ["two", B.twoCircuit], ["circle3", B.circle3], ["circle4", B.circle4], ["many", B.manyCircuit],
  ["four", B.fourCircuit],
];

test("isles: every drawn circuit has known sources, no loop, and a finite layout", () => {
  for (const [name, c] of drawn) {
    const ids = new Set([...c.inputs.map((i) => i.id), ...c.gates.map((x) => x.id)]);
    assert.equal(ids.size, c.inputs.length + c.gates.length, `${name}: ids unique`);
    for (const x of c.gates) for (const s of x.inputs) assert.ok(ids.has(s), `${name}: ${x.id} reads ${s}`);
    for (const o of c.outputs) assert.ok(ids.has(o.source), `${name}: bulb source`);
    assert.ok(topoOrder(netOf(c)), `${name}: no loop`);
    const l = layoutCircuit(c);
    for (const nd of [...l.inputs, ...l.gates, ...l.outputs]) assert.ok(Number.isFinite(nd.x) && Number.isFinite(nd.y), `${name}: placed`);
  }
});

test("isles: every islander in a picture has a switch in the matching circuit", () => {
  const pairs: [B.Islander[], CircuitSpec][] = [
    [B.bashPeople, B.bash], [B.rubyPeople, B.ruby], [B.countPeople, B.countCircuit], [B.threePeople, B.threeCircuit],
    [B.twoPeople, B.twoCircuit], [B.circle3People, B.circle3], [B.circle4People, B.circle4], [B.manyPeople, B.manyCircuit],
    [B.fourPeople, B.fourCircuit], [B.pickPeople, B.pickOptions[0]],
  ];
  for (const [people, c] of pairs) {
    const sw = c.inputs.map((i) => i.id);
    for (const p of people) {
      assert.ok(sw.includes(p.sw), `${p.name}`);
      assert.equal(p.sw, p.name[0].toLowerCase(), `${p.name}'s switch is her initial`);
    }
  }
});

// ---------------------------------------------------------------------------
//  Claims as wires
// ---------------------------------------------------------------------------

test("isles 1: the keyed boxes are exactly those for 'at least one of Ariadne and Thalia is a chimera'", () => {
  const want = claimColumn(["a", "t"], (w) => w.a === 0 || w.t === 0);
  const hits = B.atLeastOneOptions.flatMap((c, k) => (out(c) === want ? [k] : []));
  assert.deepEqual(hits, B.atLeastOneAnswer);
});

test("isles 2: the keyed table is exactly 'exactly one of us three is a chimera'", () => {
  const want = claimColumn(["d", "e", "h"], (w) => oracles(w, ["d", "e", "h"]) === 2);
  const hits = B.exactlyOneTableOptions.flatMap((o, k) => (o.table.outputs.claim === want ? [k] : []));
  assert.deepEqual(hits, [B.exactlyOneTableAnswer]);
  assert.equal(new Set(B.exactlyOneTableOptions.map((o) => o.table.outputs.claim)).size, 4);
});

test("isles 3: the keyed boxes are exactly those for 'if Phoebe is an oracle, then so is Selene'", () => {
  const want = claimColumn(["p", "s"], (w) => ifThen(w.p === 1, w.s === 1));
  const hits = B.ifThenOptions.flatMap((c, k) => (out(c) === want ? [k] : []));
  assert.deepEqual(hits, B.ifThenAnswer);
});

test("isles 4-6: each fits or claim target is the stated rule, and its gate limit is the fewest possible", () => {
  // 4. Phoebe: "Selene is a chimera." Lit when Phoebe's type agrees with her claim.
  assert.equal(B.phoebeFits.target, tableOf(B.phoebeFits.inputs, (w) => (w.p === 1) === (w.s === 0)));
  // 5. Thalia: "Ariadne and I are both oracles."
  assert.equal(B.thaliaFits.target, tableOf(B.thaliaFits.inputs, (w) => (w.t === 1) === (w.a === 1 && w.t === 1)));
  // 6. Ariadne: "Exactly one of us three is an oracle."
  assert.equal(B.exactlyOneOracle.target, tableOf(B.exactlyOneOracle.inputs, (w) => oracles(w, ["a", "c", "d"]) === 1));
  for (const p of [B.phoebeFits, B.thaliaFits, B.exactlyOneOracle]) {
    assert.equal(fewestGates(p.inputs, [p.target], p.gates, p.maxGates), p.maxGates, p.target);
  }
});

// ---------------------------------------------------------------------------
//  The bash
// ---------------------------------------------------------------------------

test("isles 7: the bash circuit's wires are Doris's claim and the two agreements, and its bulb the consistency", () => {
  const sw = ["d", "e"];
  const claims = { d: (w: W) => w.d !== w.e, e: (w: W) => w.d === 1 };
  const net = netOf(B.bash);
  const col = (wire: string) => wireColumn(net, wire).join("");
  assert.equal(col("dc"), claimColumn(sw, claims.d));
  assert.equal(col("df"), consistency(sw, { d: claims.d }));
  assert.equal(col("ef"), consistency(sw, { e: claims.e }));
  assert.equal(out(B.bash), consistency(sw, claims));
  assert.deepEqual(B.bashTags.map((t) => t.wire), ["dc", "df", "ef"]);
});

// ---------------------------------------------------------------------------
//  Find the islanders: each circuit checks its puzzle, and one setting fits
// ---------------------------------------------------------------------------

test("isles 8: the ruby circuit is the puzzle's checking circuit, and exactly one setting fits", () => {
  const sw = ["c", "h", "d"];   // c up: the ruby is in the Coral box
  const want = consistency(sw, {
    d: (w) => w.c === 0 && w.h === 0,                      // "The ruby is in the Amber box, and Hebe is a chimera."
    h: (w) => ifThen(w.d === 0, w.c === 1),                // "If Daphne is a chimera, then the ruby is in the Coral box."
  });
  assert.equal(out(B.ruby), want);
  assert.deepEqual(rowsOf(want).map((r) => bitsOfRow(sw, r)), ["110"]);
  // At the answer Hebe's if-part holds, so the answer does not rest on an if-part failing.
  assert.equal(rowSetting(sw, rowsOf(want)[0]).d, 0);
});

test("isles 9: the counting circuit checks its puzzle, exactly one setting fits, and the count is needed", () => {
  const sw = ["c", "d", "e"];
  const claims: Record<string, Claim> = {
    c: (w) => w.d === 1 || w.c === 1,                      // "At least one of Doris and me is an oracle."
    d: (w) => w.c === w.e,                                 // "Clio and Electra are the same kind."
    e: (w) => w.d === 1 && w.e === 1,                      // "Doris and I are both oracles."
  };
  const told: Claim = (w) => oracles(w, sw) < 3;           // at least one of the three is a chimera
  const want = consistency(sw, claims, told);
  assert.equal(out(B.countCircuit), want);
  assert.deepEqual(rowsOf(want).map((r) => bitsOfRow(sw, r)), ["100"]);
  assert.equal(rowsOf(consistency(sw, claims)).length, 2);
});

test("isles 10: the three-speaker circuit checks its puzzle, and exactly one setting fits", () => {
  const sw = ["a", "d", "e"];
  const want = consistency(sw, {
    a: (w) => oracles(w, sw) === 2,                        // "Exactly one of us three is a chimera."
    d: (w) => w.a === 0,                                   // "Ariadne is a chimera."
    e: (w) => w.a === 1 || w.d === 1,                      // "At least one of Ariadne and Daphne is an oracle."
  });
  assert.equal(out(B.threeCircuit), want);
  assert.deepEqual(rowsOf(want).map((r) => bitsOfRow(sw, r)), ["101"]);
});

// ---------------------------------------------------------------------------
//  Every setting that fits
// ---------------------------------------------------------------------------

test("isles 11-14: each circuit checks its puzzle, with the recorded settings", () => {
  const cases: [string, CircuitSpec, string[], Record<string, Claim>, string[]][] = [
    ["two", B.twoCircuit, ["a", "s"], {
      a: (w) => oracles(w, ["a", "s"]) === 1,              // "Exactly one of us two is an oracle."
      s: (w) => w.a === 1 && w.s === 1,                    // "Ariadne and I are both oracles."
    }, ["00", "10"]],
    ["circle of three", B.circle3, ["a", "c", "d"], {
      a: (w) => w.c === 0, c: (w) => w.d === 0, d: (w) => w.a === 0,
    }, []],
    ["circle of four", B.circle4, ["a", "c", "d", "e"], {
      a: (w) => w.c === 0, c: (w) => w.d === 0, d: (w) => w.e === 0, e: (w) => w.a === 0,
    }, ["0101", "1010"]],
    ["three answers", B.manyCircuit, ["p", "s", "t"], {
      p: (w) => w.s === 1 && w.p === 1,                    // "Selene and I are both oracles."
      s: (w) => w.t === 1 || w.s === 1,                    // "At least one of Thalia and me is an oracle."
      t: (w) => ifThen(w.p === 1, w.t === 1),              // "If Phoebe is an oracle, then so am I."
    }, ["011", "110", "111"]],
  ];
  for (const [name, c, sw, claims, settings] of cases) {
    const want = consistency(sw, claims);
    assert.equal(out(c), want, name);
    assert.deepEqual(rowsOf(want).map((r) => bitsOfRow(sw, r)), settings, name);
    assert.deepEqual(rowsMatching(netOf(c), { out: 1 }), rowsOf(want), name);
  }
});

test("isles 12-13: the circle words in the pictures say 'the next one is a chimera'", () => {
  for (const people of [B.circle3People, B.circle4People]) {
    people.forEach((p, k) => assert.equal(p.says, `${people[(k + 1) % people.length].name} is a chimera.`));
  }
});

// ---------------------------------------------------------------------------
//  Build the checking circuit
// ---------------------------------------------------------------------------

test("isles 15: the three bulbs are Ariadne fits, Thalia fits, and both", () => {
  const sw = B.threeBulbs.inputs;
  const a: Claim = (w) => w.a !== w.t;                       // "Thalia and I are different kinds."
  const t: Claim = (w) => w.a === 1 || w.t === 1;            // "At least one of us two is an oracle."
  assert.deepEqual(B.threeBulbs.target, {
    af: consistency(sw, { a }),
    tf: consistency(sw, { t }),
    both: consistency(sw, { a, t }),
  });
  assert.equal(rowsOf(B.threeBulbs.target.both).length, 1);
});

test("isles 16: exactly the keyed circuit checks the Hebe and Electra puzzle", () => {
  const sw = ["h", "e"];
  const want = consistency(sw, {
    h: (w) => w.e === 1 && w.h === 1,                      // "Electra and I are both oracles."
    e: (w) => w.h !== w.e,                                 // "Hebe and I are different kinds."
  }, (w) => oracles(w, sw) === 1);                         // exactly one of the two is a chimera
  const hits = B.pickOptions.flatMap((c, k) => (out(c) === want ? [k] : []));
  assert.deepEqual(hits, [B.pickAnswer]);
  assert.equal(rowsOf(want).length, 1);
  assert.equal(new Set(B.pickOptions.map(out)).size, B.pickOptions.length, "the wrong options have different tables");
});

// ---------------------------------------------------------------------------
//  Radios
// ---------------------------------------------------------------------------

// The reports (one per pair of radios next to each other in the ring, "1" for
// "same channel") could all be true exactly when some choice of channels,
// two channels to pick from, makes them true.
function radioColumn(radios: number): string {
  let col = "";
  for (let r = 0; r < 1 << radios; r++) {
    const said = [...Array(radios)].map((_, k) => (r >> (radios - 1 - k)) & 1);
    let possible = false;
    for (let ch = 0; ch < 1 << radios; ch++) {
      const c = [...Array(radios)].map((_, k) => (ch >> k) & 1);
      if (said.every((s, k) => s === (c[k] === c[(k + 1) % radios] ? 1 : 0))) possible = true;
    }
    col += possible ? "1" : "0";
  }
  return col;
}

test("isles 17 and 19: the radio targets are 'the reports could all be true', with the fewest gates", () => {
  assert.equal(B.radios3.target, radioColumn(3));
  assert.equal(B.radios4.target, radioColumn(4));
  assert.deepEqual(B.radios3.inputs.map((i) => i.id), B.radios3.ids);
  assert.deepEqual(B.radios4.inputs.map((i) => i.id), B.radios4.ids);
  // The pattern behind them: an odd number of "same" reports for three radios, an even number for four.
  assert.equal(B.radios3.target, tableOf(B.radios3.ids, (w) => (w.ab + w.bc + w.ca) % 2 === 1));
  assert.equal(B.radios4.target, tableOf(B.radios4.ids, (w) => (w.ab + w.bc + w.cd + w.da) % 2 === 0));
  assert.equal(fewestGates(B.radios3.ids, [B.radios3.target], B.radios3.gates, B.radios3.maxGates + 1), B.radios3.maxGates);
  assert.equal(fewestGates(B.radios4.ids, [B.radios4.target], B.radios4.gates, B.radios4.maxGates), B.radios4.maxGates);
});

// ---------------------------------------------------------------------------
//  Harder
// ---------------------------------------------------------------------------

test("isles 18: the four-speaker circuit checks its puzzle, and exactly one setting fits", () => {
  const sw = ["a", "c", "d", "e"];
  const claims: Record<string, Claim> = {
    a: (w) => w.c === 1,                                   // "Clio is an oracle."
    c: (w) => w.d === 1 || w.e === 1,                      // "At least one of Daphne and Electra is an oracle."
    d: (w) => ifThen(w.a === 1, w.c === 1),                // "If Ariadne is an oracle, then so is Clio."
    e: (w) => oracles(w, ["c", "d"]) === 1,                // "Exactly one of Clio and Daphne is an oracle."
  };
  const want = consistency(sw, claims);
  assert.equal(out(B.fourCircuit), want);
  assert.deepEqual(rowsOf(want).map((r) => bitsOfRow(sw, r)), ["1110"]);
  // Every sentence is needed: drop any one and a second setting fits.
  for (const who of sw) {
    const rest = Object.fromEntries(Object.entries(claims).filter(([k]) => k !== who));
    assert.ok(rowsOf(consistency(sw, rest)).length > 1, who);
  }
  // At the answer Daphne's if-part holds.
  assert.equal(rowSetting(sw, rowsOf(want)[0]).a, 1);
});

test("isles 20: the one-gate puzzle's consistency needs exactly one gate", () => {
  const sw = B.oneGate.inputs;
  const want = consistency(sw, {
    a: (w) => w.p === w.a,                                 // "Phoebe and I are the same kind."
    p: (w) => w.a === 1 || w.t === 1,                      // "At least one of Ariadne and Thalia is an oracle."
    t: (w) => w.a === 1 && w.t === 1,                      // "Ariadne and I are both oracles."
  });
  assert.equal(B.oneGate.target, want);
  assert.deepEqual(rowsOf(want).map((r) => bitsOfRow(sw, r)), ["110", "111"]);
  assert.equal(fewestGates(sw, [B.oneGate.target], B.oneGate.gates, 2), B.oneGate.maxGates);
});
