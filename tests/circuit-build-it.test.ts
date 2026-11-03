// Keys of logic-gates/build-it.mdx ("Build It Yourself").
// Run from Site/ with:  npm test
//
// Every target is rebuilt here from the rule as the page words it, by trying
// every row. Each `fewest` is then proved both ways: some circuit with that
// many gates exists, and none with fewer, by trying every smaller circuit.
// No circuit is written down.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Bit, GateType } from "../src/components/games/circuits/model.ts";
import { rowCount, rowSetting } from "../src/components/games/circuits/problems/engine.ts";
import * as B from "../src/components/games/circuits/problems/banks/build-it.ts";
import { fewestGates } from "./circuit-search.ts";

type W = Record<string, Bit>;
const ids = (b: B.Build) => b.inputs.map((i) => (typeof i === "string" ? i : i.id));
const column = (switches: string[], f: (w: W) => unknown) => {
  let col = "";
  for (let r = 0; r < rowCount(switches); r++) col += f(rowSetting(switches, r)) ? "1" : "0";
  return col;
};
// The number shown by switches worth 2^(k-1), ..., 2, 1, first switch first.
const value = (w: W, bits: string[]) => bits.reduce((n, b) => 2 * n + w[b], 0);
const up = (w: W, who: string[]) => who.filter((x) => w[x] === 1).length;
const targets = (b: B.Build) =>
  typeof b.target === "string" ? [b.target] : b.outputs ? b.outputs.map((o) => (b.target as Record<string, string>)[o.id]) : Object.values(b.target);

// ---------------------------------------------------------------------------
//  A faster exact search (as in circuit-any-table.test.ts) for the
//  four-switch problems, checked against circuit-search.ts below.
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

test("build-it: the faster search agrees with circuit-search.ts on random tables", () => {
  let seed = 5;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const P: GateType[] = ["NOT", "AND", "OR", "XOR"];
  for (let it = 0; it < 60; it++) {
    const n = it < 30 ? 2 : 3;
    let t = "";
    for (let r = 0; r < 1 << n; r++) t += rnd() < 0.5 ? "1" : "0";
    const lim = n === 2 ? 5 : 4;
    assert.equal(smallest(n, [t], P, lim), fewestGates(["a", "b", "c"].slice(0, n), [t], P, lim), t);
  }
});

// ---------------------------------------------------------------------------
//  Every target, from the rule as the page words it
// ---------------------------------------------------------------------------
const xyz = ["x", "y", "z"], pqrs = ["p", "q", "r", "s"];
const cases: [string, B.Build, Record<string, string> | string][] = [];
const add = (name: string, b: B.Build, sw: string[], fs: Record<string, (w: W) => unknown> | ((w: W) => unknown)) =>
  cases.push([name, b, typeof fs === "function" ? column(sw, fs) : Object.fromEntries(Object.entries(fs).map(([k, f]) => [k, column(sw, f)]))]);

add("1 porch light", B.porch, ["d", "m"], { lamp: (w) => w.d && w.m });
add("2 fridge alarm", B.fridge, ["o", "t", "w"], { beep: (w) => w.o && (w.t || w.w) });
add("3 bathroom fan", B.fan, ["l", "d", "w"], { fan: (w) => (w.l || w.d) && !w.w });
add("4 sprinkler", B.sprinkler, ["d", "r", "t"], { water: (w) => (w.d && !w.r) || w.t });
add("5 lift", B.lift, ["d", "f", "r"], { motor: (w) => w.d && w.f !== w.r });
add("6 cat flap", B.catFlap, ["c", "d", "n"], { in: (w) => w.c && !w.d, out: (w) => w.c && !w.d && !w.n });
const light = (w: W) => value(w, ["a", "b"]);
add("7 traffic light", B.traffic, ["a", "b"], {
  red: (w) => light(w) === 0 || light(w) === 1,
  amber: (w) => light(w) === 1 || light(w) === 3,
  green: (w) => light(w) === 2,
});
add("8 die", B.die, xyz, {
  A: (w) => B.dieGroups(value(w, xyz)).A, B: (w) => B.dieGroups(value(w, xyz)).B,
  C: (w) => B.dieGroups(value(w, xyz)).C, M: (w) => B.dieGroups(value(w, xyz)).M,
});
const oddOut = (me: string, others: string[]) => (w: W) => others.every((o) => w[o] !== w[me]);
add("9 odd one out", B.oddOne, ["r", "s", "t"], {
  ruth: oddOut("r", ["s", "t"]), sam: oddOut("s", ["r", "t"]), tom: oddOut("t", ["r", "s"]),
});
const next = (w: W) => (value(w, xyz) + 1) % 8;
add("10 next number", B.nextNumber, xyz, { X: (w) => next(w) & 4, Y: (w) => next(w) & 2, Z: (w) => next(w) & 1 });
add("11 thirty-one days", B.longMonths, pqrs, { long: (w) => [1, 3, 5, 7, 8, 10, 12].includes(value(w, pqrs)) });
const ups = (w: W) => up(w, ["a", "b", "c"]);
add("12 how many are up", B.countUp, ["a", "b", "c"], { two: (w) => ups(w) & 2, one: (w) => ups(w) & 1 });
add("13 threes", B.threes, xyz, { out: (w) => value(w, xyz) % 3 === 0 });
add("14 one bar", B.bar, pqrs, { bar: (w) => value(w, pqrs) <= 9 && B.DIGIT_BARS[value(w, pqrs)].includes("e") });
add("15 I am a chimera", B.iAmChimera, ["d"], (w) => (w.d === 1) === (w.d === 0));
add("16 same kind", B.sameKind, ["e", "h"], (w) => (w.e === 1) === (w.e === w.h));
const four = ["a", "c", "d", "e"];
add("17 an even number", B.evenFits, four, (w) => (w.a === 1) === (up(w, four) % 2 === 0));
add("18 line them up", B.lineUp, ["a", "b", "c"], { top: (w) => ups(w) >= 1, middle: (w) => ups(w) >= 2, bottom: (w) => ups(w) >= 3 });
add("19 which is bigger", B.bigger, ["a", "b", "c", "d"], { ann: (w) => value(w, ["a", "b"]) > value(w, ["c", "d"]) });
// 0 rock, 1 paper, 2 scissors, 3 no hand. Paper beats rock, scissors beats paper, rock beats scissors.
const beats: [number, number][] = [[1, 0], [2, 1], [0, 2]];
add("20 rock paper scissors", B.rps, ["a", "b", "c", "d"], {
  ann: (w) => beats.some(([x, y]) => value(w, ["a", "b"]) === x && value(w, ["c", "d"]) === y),
});
// Up: on the far bank. Without the farmer, the wolf eats the goat and the goat eats the cabbage.
add("21 wolf, goat and cabbage", B.river, ["f", "w", "g", "c"], {
  safe: (w) => !((w.w === w.g && w.f !== w.g) || (w.g === w.c && w.f !== w.g)),
});

test("build-it: every target is the rule its statement words", () => {
  for (const [name, b, want] of cases) assert.deepEqual(b.target, want, name);
  assert.equal(cases.length, 21);
});

test("build-it: switch and bulb ids are distinct, and every bulb has a target", () => {
  for (const [name, b] of cases) {
    const outs = (b.outputs ?? [{ id: "out", label: "out" }]).map((o) => o.id);
    assert.equal(new Set([...ids(b), ...outs]).size, ids(b).length + outs.length, name);
    if (typeof b.target !== "string") assert.deepEqual(Object.keys(b.target).sort(), [...outs].sort(), name);
  }
});

test("build-it: every fewest count is exactly the fewest gates possible", () => {
  for (const [name, b] of cases) {
    const n = b.inputs.length;
    assert.equal(smallest(n, targets(b), b.gates, b.fewest + 1), b.fewest, name);
    if (n <= 3 && b.fewest <= 4) assert.equal(fewestGates(ids(b), targets(b), b.gates, b.fewest + 1), b.fewest, `${name} (circuit-search)`);
  }
});

test("build-it: the die pictures show the faces of a real die", () => {
  // Pips per face: the groups hold 2, 2, 2 and 1 dots.
  for (let n = 0; n <= 7; n++) {
    const g = B.dieGroups(n);
    assert.equal(2 * (+g.A + +g.B + +g.C) + +g.M, n, `face ${n}`);
  }
});

test("build-it: each islander's switch is her initial", () => {
  for (const people of [B.chimeraPeople, B.sameKindPeople, B.evenPeople]) for (const p of people) assert.equal(p.sw, p.name[0].toLowerCase());
});
