// Keys of logic-gates/design-problems.mdx (book Section 6.4), checked by
// walking complete truth tables. Run from Site/ with:  npm test
//
// For every build problem this file
//   1. recomputes the target from the statement's own words, written a second
//      way, independently of the bank;
//   2. proves the problem can be done within its limits, and that the gate
//      limit (and the depth limit, where there is one) is the fewest
//      possible, by an exhaustive search of small circuits.
// No solution circuit for a build problem is written down anywhere.
//
// The search below extends tests/circuit-search.ts (which has no depth limit,
// no per-type limit and 32 rows at most). It is kept in this file so the
// shared helper stays untouched.

import { test } from "node:test";
import assert from "node:assert/strict";

import type { GateType } from "../src/components/games/circuits/model.ts";
import { circuitDepth, columnsOf, evaluateNet, netOf, rowSetting, rowsMatching, tableOf, tableOfNet, type Net } from "../src/components/games/circuits/problems/engine.ts";
import * as B from "../src/components/games/circuits/problems/banks/design-problems.ts";

// ---------------------------------------------------------------------------
//  Exhaustive search
// ---------------------------------------------------------------------------

type Opts = { maxDepth?: number; maxPerType?: Partial<Record<GateType, number>> };

// The fewest gates from `palette` (two inputs each, NOT one) computing every
// target column, trying every circuit with at most `limit` gates. Returns
// Infinity if there is none. Columns are held as bitmasks over the rows.
//
// The search only skips circuits that cannot be the smallest:
//  - a gate computing a column already present is never needed (wire the
//    earlier copy instead: no more gates, no more depth, no more of a type);
//  - gates are tried in one fixed order: a gate that does not read the gate
//    added just before it must have a larger column than that gate (any
//    circuit can be listed this way, since two neighbouring gates that do not
//    feed each other can swap places);
//  - in a smallest circuit every gate feeds a bulb or another gate, so the
//    number of gates still unused and not on a bulb can be at most what the
//    remaining gates can absorb;
//  - when the remaining gates equal the missing bulbs, each must make a bulb.
export function fewest(inputs: string[], targets: string[], palette: GateType[], limit: number, opts: Opts = {}): number {
  const n = inputs.length, R = 1 << n;
  const big = R > 32;
  type W = number | bigint;
  const FULL: W = big ? (1n << BigInt(R)) - 1n : R === 32 ? 0xffffffff : (1 << R) - 1;
  const one = (r: number): W => (big ? 1n << BigInt(r) : (1 << r) >>> 0);
  const or = (a: W, b: W): W => (big ? (a as bigint) | (b as bigint) : ((a as number) | (b as number)) >>> 0);
  const op = (t: GateType, a: W, b: W): W => {
    if (big) {
      const x = a as bigint, y = b as bigint, F = FULL as bigint;
      return t === "NOT" ? ~x & F : t === "AND" ? x & y : t === "OR" ? x | y : t === "XOR" ? x ^ y : t === "NAND" ? ~(x & y) & F : ~(x | y) & F;
    }
    const x = a as number, y = b as number, F = FULL as number;
    return (t === "NOT" ? ~x & F : t === "AND" ? x & y : t === "OR" ? x | y : t === "XOR" ? x ^ y : t === "NAND" ? ~(x & y) & F : ~(x | y) & F) >>> 0;
  };
  const maskOf = (col: string): W => [...col].reduce<W>((m, ch, r) => (ch === "1" ? or(m, one(r)) : m), big ? 0n : 0);
  const want = targets.map(maskOf);
  const base: W[] = inputs.map((_, i) => {
    let m: W = big ? 0n : 0;
    for (let r = 0; r < R; r++) if ((r >> (n - 1 - i)) & 1) m = or(m, one(r));
    return m;
  });
  const maxD = opts.maxDepth ?? Infinity;
  const per = opts.maxPerType ?? {};
  const wantSet = new Set<W>(want);

  for (let L = 0; L <= limit; L++) {
    const fns: W[] = [...base];
    const dep: number[] = base.map(() => 0);
    const uses: number[] = base.map(() => 0);
    const count: Partial<Record<GateType, number>> = {};
    const has = new Set<W>(fns);
    let found = false;
    const dfs = (g: number) => {
      let t = 0;
      for (const w of wantSet) if (!has.has(w)) t++;
      if (t === 0) { found = true; return; }
      const r = L - g;
      if (t > r) return;
      let loose = 0;
      for (let k = n; k < fns.length; k++) if (uses[k] === 0 && !wantSet.has(fns[k])) loose++;
      if (loose > r + t) return;
      const N = fns.length, last = N - 1;
      for (const ty of palette) {
        if (per[ty] !== undefined && (count[ty] ?? 0) >= per[ty]!) continue;
        for (let i = 0; i < N; i++) {
          const jEnd = ty === "NOT" ? i + 1 : N;
          for (let j = i; j < jEnd; j++) {
            const f = op(ty, fns[i], fns[j]);
            if (has.has(f)) continue;
            if (t === r && !wantSet.has(f)) continue;
            if (g > 0 && i !== last && j !== last && !(f > fns[last])) continue;
            const d = Math.max(dep[i], dep[j]) + 1;
            if (d > maxD) continue;
            fns.push(f); dep.push(d); uses.push(0); has.add(f);
            uses[i]++; if (j !== i) uses[j]++;
            count[ty] = (count[ty] ?? 0) + 1;
            dfs(g + 1);
            count[ty]!--;
            uses[i]--; if (j !== i) uses[j]--;
            fns.pop(); dep.pop(); uses.pop(); has.delete(f);
            if (found) return;
          }
        }
      }
    };
    dfs(0);
    if (found) return L;
  }
  return Infinity;
}

// The switches a column really depends on: flipping that switch alone changes
// the column on some row.
function essential(inputs: string[], col: string): number {
  const n = inputs.length;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const bit = 1 << (n - 1 - i);
    let dep = false;
    for (let r = 0; r < col.length && !dep; r++) if (col[r] !== col[r ^ bit]) dep = true;
    if (dep) k++;
  }
  return k;
}
// Two lower bounds for one bulb that depends on k switches, with gates of at
// most two inputs.
//  Size: the gates behind the bulb, with the k switches, form a connected
//  picture. With m gates there are k + m points and at most 2m wires, and a
//  connected picture on k + m points needs at least k + m - 1 wires. So m >= k - 1.
//  Depth: a wire at depth d depends on at most 2^d switches, since each gate
//  merges at most two wires. So 2^depth >= k.
const sizeBound = (k: number) => k - 1;
const depthBound = (k: number) => Math.ceil(Math.log2(k));

// A sanity check of the search against the shared helper's known answers.
test("design page: the search agrees with known small cases", () => {
  assert.equal(fewest(["a", "b"], ["1000"], ["NOT", "AND", "OR"], 3), 2);
  assert.equal(fewest(["a", "b"], ["0110"], ["NOT", "AND", "OR"], 6), 4);
  assert.equal(fewest(["a", "b", "c", "d"], ["0110100110010110"], ["XOR"], 4), 3);
  assert.equal(fewest(["a", "b", "c", "d"], ["0110100110010110"], ["XOR"], 4, { maxDepth: 2 }), 3);
  assert.equal(fewest(["a", "b", "c", "d"], ["0001000100011111"], ["AND", "OR"], 3), 3);
  assert.equal(fewest(["a", "b"], ["0111"], ["NOT", "XOR"], 6), Infinity);
  // A chain of three ORs over four switches has depth 3; depth 2 still needs three gates.
  assert.equal(fewest(["a", "b", "c", "d"], ["0111111111111111"], ["OR"], 4, { maxDepth: 1 }), Infinity);
});

const col = (t: string | Record<string, string>, k: string) => (typeof t === "string" ? t : t[k]);
const cols = (b: B.Build) => (typeof b.target === "string" ? [b.target] : (b.outputs ?? Object.keys(b.target)).map((o) => col(b.target, o)));

// Every build problem: it can be done within its limits, and not with fewer gates.
function fewestIs(name: string, b: B.Build) {
  const opts = { maxDepth: b.maxDepth, maxPerType: b.maxPerType };
  assert.equal(fewest(b.inputs, cols(b), b.gates, b.maxGates, opts), b.maxGates, `${name}: can be done in ${b.maxGates}, not fewer`);
}

// ---------------------------------------------------------------------------
//  1. The garage door
// ---------------------------------------------------------------------------

test("design page 1: the apprentice's door keeps closing on the shown setting, where the wish says stop", () => {
  const ins = ["s", "t"];
  const wish = tableOf(ins, (v) => v.s === 0 && v.t === 0) as string;   // keep closing only when both strips are clear
  const r = parseInt(B.garageSwitches, 2);
  const v = evaluateNet(netOf(B.garage), rowSetting(ins, r));
  assert.equal(v.o, 1);
  assert.equal(wish[r], "0");
  // The two tagged wires carry different values, so the tags are not a giveaway.
  assert.notEqual(v.p, v.q);
});

// ---------------------------------------------------------------------------
//  Build problems: targets as the statements word them
// ---------------------------------------------------------------------------

test("design page 2: two codes, one door", () => {
  const open = [0b1100, 0b1000];   // up up down down, up down down down
  assert.equal(B.twoCodes.target, Array.from({ length: 16 }, (_, r) => (open.includes(r) ? "1" : "0")).join(""));
  fewestIs("two codes", B.twoCodes);
});

test("design page 3: buckle up", () => {
  const t = tableOf(B.buckle.inputs, (v) => {
    const driverWarn = v.a === 1 && v.b === 0, passengerWarn = v.c === 1 && v.d === 0;
    return driverWarn || passengerWarn;
  });
  assert.equal(B.buckle.target, t);
  fewestIs("buckle up", B.buckle);
});

test("design page 4: with the emergency stop pressed, the apprentice's panel can still run the train", () => {
  const ins = ["p", "e", "g", "k"];
  const rows = rowsMatching(netOf(B.apprentice), { run: 1 }).filter((r) => rowSetting(ins, r).e === B.apprenticeFixed.e);
  assert.ok(rows.length > 0);
  // and on every such row the wish says the train must not run
  for (const r of rows) assert.equal(col(B.override.target, "run")[r], "0");
});

test("design page 5: the override, done right", () => {
  const t = tableOf(B.override.inputs, (v) => ({ run: v.p === 1 && v.e === 0 && (v.g === 1 || v.k === 1) }));
  assert.deepEqual(B.override.target, t);
  // The apprentice's circuit is wrong somewhere, the key alone must never run the train.
  assert.notEqual(columnsOf(B.apprentice).run, col(B.override.target, "run"));
  fewestIs("override", B.override);
});

test("design page 6: a safe with a siren", () => {
  const t = tableOf(B.safe.inputs, (v) => {
    const codeRight = v.a === 1 && v.b === 0 && v.c === 1;
    return { door: v.e === 1 && codeRight, siren: v.e === 1 && !codeRight };
  });
  assert.deepEqual(B.safe.target, t);
  // Door and siren never both sound, and with the button up neither does.
  const T = B.safe.target as Record<string, string>;
  for (let r = 0; r < 16; r++) {
    assert.ok(!(T.door[r] === "1" && T.siren[r] === "1"));
    if ((r & 1) === 0) assert.ok(T.door[r] === "0" && T.siren[r] === "0");
  }
  fewestIs("safe", B.safe);
});

test("design page 7: crossroads", () => {
  const t = tableOf(B.crossroads.inputs, (v) => ({
    walk: v.n + v.s + v.e + v.w === 0,
    clash: (v.n === 1 || v.s === 1) && (v.e === 1 || v.w === 1),
  }));
  assert.deepEqual(B.crossroads.target, t);
  fewestIs("crossroads", B.crossroads);
});

test("design page 8: one microphone, three requests", () => {
  const t = tableOf(B.microphone.inputs, (v) => {
    const who = v.a ? "host" : v.b ? "guest" : v.c ? "crowd" : "none";
    return { host: who === "host", guest: who === "guest", crowd: who === "crowd" };
  });
  assert.deepEqual(B.microphone.target, t);
  // never two microphones at once
  const T = B.microphone.target as Record<string, string>;
  for (let r = 0; r < 8; r++) assert.ok(+T.host[r] + +T.guest[r] + +T.crowd[r] <= 1);
  fewestIs("microphone", B.microphone);
});

test("design page 9: the toy-packing inspector", () => {
  const t = tableOf(B.inspector.inputs, (v) => {
    let wrong = 0;
    if (v.a !== v.c) wrong++;
    if (v.b !== v.d) wrong++;
    return { green: wrong === 0, amber: wrong === 1, red: wrong === 2 };
  });
  assert.deepEqual(B.inspector.target, t);
  const T = B.inspector.target as Record<string, string>;
  for (let r = 0; r < 16; r++) assert.equal(+T.green[r] + +T.amber[r] + +T.red[r], 1);
  fewestIs("inspector", B.inspector);
});

test("design page 10: can everybody find a partner", () => {
  // Recompute by trying every way to put the four children into two pairs.
  const ids = ["A", "B", "C", "D"];
  const pairOf: Record<string, string> = { AB: "a", AC: "b", AD: "c", BC: "d", BD: "e", CD: "f" };
  const t = tableOf(B.partners.inputs, (v) => {
    const willing = (x: string, y: string) => v[pairOf[[x, y].sort().join("")]] === 1;
    const [first, ...rest] = ids;
    return rest.some((mate) => {
      const [p, q] = rest.filter((x) => x !== mate);
      return willing(first, mate) && willing(p, q);
    });
  });
  assert.equal(B.partners.target, t);
  // "Everybody has some willing pair" is not enough: A with each of B, C, D only.
  const onlyA = parseInt("111000", 2);
  assert.equal((B.partners.target as string)[onlyA], "0");
  // The second sighting on the page: only A with B and C with D.
  assert.equal((B.partners.target as string)[parseInt("100001", 2)], "1");
  // Five gates is the fewest: the bulb depends on all six switches.
  assert.equal(essential(B.partners.inputs, B.partners.target as string), 6);
  assert.equal(sizeBound(6), B.partners.maxGates);
  assert.equal(fewest(B.partners.inputs, cols(B.partners), B.partners.gates, B.partners.maxGates), B.partners.maxGates);
});

test("design page 11: the four-tile puzzle", () => {
  // Recompute: the patterns reachable from all white are those with an even number of black tiles.
  const t = tableOf(B.tiles.inputs, (v) => (v.a + v.b + v.c + v.d) % 2 === 0);
  assert.deepEqual(B.tiles.target, { can: t });
  fewestIs("tiles", B.tiles);
});

test("design page 12: the bargain box, the keyed tables are exactly those XOR and NOT can build", () => {
  // Every column two switches can give through XOR and NOT gates, by closure.
  const start = ["0011", "0101"];
  const seen = new Set(start);
  const flip = (c: string) => [...c].map((x) => (x === "1" ? "0" : "1")).join("");
  const xor = (c: string, d: string) => [...c].map((x, i) => (x === d[i] ? "0" : "1")).join("");
  for (let grew = true; grew; ) {
    grew = false;
    const now = [...seen];
    for (const c of now) {
      const cands = [flip(c), ...now.map((d) => xor(c, d))];
      for (const e of cands) if (!seen.has(e)) { seen.add(e); grew = true; }
    }
  }
  assert.equal(seen.size, 8);
  // Problem 16 says the OR table cannot be built from XOR and NOT alone.
  assert.ok(!seen.has("0111"));
  const hits = B.bargainColumns.map((c, k) => [k, seen.has(c)] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, B.bargainAnswer);
  // Each buildable column has an even number of 1s, each other one an odd number.
  for (const c of B.bargainColumns) assert.equal(seen.has(c), [...c].filter((x) => x === "1").length % 2 === 0);
});

test("design page 13: one borrowed AND gives OR in three gates", () => {
  assert.equal(B.borrowed.target, tableOf(B.borrowed.inputs, (v) => v.a === 1 || v.b === 1));
  fewestIs("borrowed", B.borrowed);
  // and without the AND it cannot be done at all
  assert.equal(fewest(B.borrowed.inputs, [B.borrowed.target as string], ["NOT", "XOR"], 6), Infinity);
});

// ---------------------------------------------------------------------------
//  Speed
// ---------------------------------------------------------------------------

test("design page 14: six detectors, five ORs in depth 3, and depth 2 is impossible", () => {
  assert.equal(B.sixDetectors.target, tableOf(B.sixDetectors.inputs, (v) => Object.values(v).some((x) => x === 1)));
  const k = essential(B.sixDetectors.inputs, B.sixDetectors.target as string);
  assert.equal(sizeBound(k), B.sixDetectors.maxGates);
  assert.equal(depthBound(k), B.sixDetectors.maxDepth);
  fewestIs("six detectors", B.sixDetectors);
});

test("design page 15: eight detectors, the keyed alarms are exactly the right ones with depth at most 3", () => {
  const ins = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const want = tableOf(ins, (v) => ins.some((x) => v[x] === 1));
  const facts = B.eightOptions.map((c) => ({ right: columnsOf(c).bell === want, depth: circuitDepth(netOf(c)), gates: c.gates.length }));
  const hits = facts.map((f, k) => [k, f.right && f.depth <= 3] as const).filter(([, ok]) => ok).map(([k]) => k);
  assert.deepEqual(hits, B.eightAnswer);
  // Every option uses seven gates, so size does not give the answer away.
  for (const f of facts) assert.equal(f.gates, 7);
  // The distractors fail for different reasons: too deep but right, or wrong.
  assert.deepEqual(facts.map((f) => [f.right, f.depth]), [[true, 7], [true, 3], [false, 3], [true, 3], [true, 4], [false, 3]]);
});

// The book's tournament: combine wires in pairs, layer by layer.
function tournament(type: GateType, wires: string[]): Net {
  const gates: Net["gates"] = [];
  let layer = [...wires], k = 0;
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      if (i + 1 === layer.length) { next.push(layer[i]); continue; }
      const id = `t${k++}`;
      gates.push({ id, type, inputs: [layer[i], layer[i + 1]] });
      next.push(id);
    }
    layer = next;
  }
  return { inputs: wires, gates, outputs: [{ id: "out", source: layer[0] }] };
}

test("design page 16: sixteen switches, an odd-number detector needs depth 4, and depth 4 is reached", () => {
  const ins = Array.from({ length: 16 }, (_, i) => `s${i}`);
  // Lower bound: the answer changes whenever any one switch flips, so it depends on all 16.
  assert.equal(depthBound(16), 4);
  // Reached: the tournament of XORs, checked on all 65536 rows.
  const net = tournament("XOR", ins);
  assert.equal(circuitDepth(net), 4);
  const out = tableOfNet(net).out;
  for (let r = 0; r < 1 << 16; r++) {
    let ones = 0;
    for (let x = r; x; x &= x - 1) ones++;
    assert.equal(out[r], ones % 2);
  }
  assert.equal(B.sixteenDepths[B.sixteenAnswer], 4);
  assert.equal(new Set(B.sixteenDepths).size, B.sixteenDepths.length);
});

test("design page 17: tampering, three-switch panels in five gates and depth 3, four-switch panels in depth 3", () => {
  const t = tableOf(B.tamper.inputs, (v) => v.a !== v.x || v.b !== v.y || v.c !== v.z);
  assert.equal(B.tamper.target, t);
  const k = essential(B.tamper.inputs, t as string);
  assert.equal(k, 6);
  assert.equal(sizeBound(k), B.tamper.maxGates);
  assert.equal(depthBound(k), B.tamper.maxDepth);
  // Existence within both limits, searched with XOR and OR only (a smaller palette than the page's).
  assert.equal(fewest(B.tamper.inputs, [t as string], ["XOR", "OR"], 5, { maxDepth: 3 }), 5);

  // The follow-up with four switches a panel: eight switches, so depth at least 3.
  const ins8 = ["a", "b", "c", "d", "w", "x", "y", "z"];
  const want8 = tableOf(ins8, (v) => v.a !== v.w || v.b !== v.x || v.c !== v.y || v.d !== v.z) as string;
  assert.equal(essential(ins8, want8), 8);
  assert.equal(depthBound(8), 3);
  // Reached: four comparisons side by side, then the tournament of ORs on top.
  const tour = tournament("OR", ["q0", "q1", "q2", "q3"]);
  const net: Net = {
    inputs: ins8,
    gates: [0, 1, 2, 3].map((i) => ({ id: `q${i}`, type: "XOR" as GateType, inputs: [ins8[i], ins8[i + 4]] })).concat(tour.gates),
    outputs: tour.outputs,
  };
  assert.equal(circuitDepth(net), 3);
  assert.equal(tableOfNet(net).out.join(""), want8);
  assert.equal(B.tamperFourDepths[B.tamperFourAnswer], 3);
});

// ---------------------------------------------------------------------------
//  Harder
// ---------------------------------------------------------------------------

test("design page 18: three friends, one tandem", () => {
  const t = tableOf(B.tandem.inputs, (v) => [v.a, v.b, v.c].filter((x) => x === 1).length === 2);
  assert.deepEqual(B.tandem.target, { book: t });
  fewestIs("tandem", B.tandem);
});

test("design page 19: swap the spotlights", () => {
  const t = tableOf(B.spotlights.inputs, (v) => (v.s === 0 ? { left: v.a, right: v.b } : { left: v.b, right: v.a }));
  assert.deepEqual(B.spotlights.target, t);
  fewestIs("spotlights", B.spotlights);
});

test("design page 20: the chair breaks the tie", () => {
  const t = tableOf(B.chair.inputs, (v) => {
    const yes = v.a + v.b + v.c + v.t, no = 4 - yes;
    if (yes !== no) return yes > no;
    return v.t === 1;
  });
  assert.deepEqual(B.chair.target, { pass: t });
  // The three sightings printed on the page.
  for (const [sw, bulb] of [["1100", "0"], ["1001", "1"], ["1110", "1"]]) assert.equal((t as string)[parseInt(sw, 2)], bulb);
  fewestIs("chair", B.chair);
});

test("design page 21: the extra footbridge", () => {
  // Recompute from the four routes across the map.
  const t = tableOf(B.footbridge.inputs, (v) =>
    (v.a && v.b) || (v.c && v.d) || (v.a && v.e && v.d) || (v.c && v.e && v.b) ? 1 : 0);
  assert.deepEqual(B.footbridge.target, { safe: t });
  // Without the middle bridge, two routes. Lit on half the rows.
  assert.equal([...(t as string)].filter((x) => x === "1").length, 16);
  fewestIs("footbridge", B.footbridge);
});

