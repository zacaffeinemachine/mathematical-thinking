// Circuits and keys for logic-gates/design-problems.mdx (book Section 6.4:
// design problems, size and depth, circuits with several bulbs).
//
// Kept in TypeScript rather than inline in the MDX so that
// tests/circuit-design-problems.test.ts can import them and check every key
// by walking the full truth table. No solution to a build problem appears
// here or anywhere else in the repo: the test proves each build problem can
// be done within its limits, and that each limit is the fewest possible, by
// searching every small circuit.
//
// Row order is the engine's: the first input is the slowest column.

import type { CircuitSpec, GateType } from "../../model.ts";
import { tableOf } from "../engine.ts";

const ALL4: GateType[] = ["NOT", "AND", "OR", "XOR"];
const BASIC: GateType[] = ["NOT", "AND", "OR"];
const not = (x: number) => x ^ 1;

// A build problem: switches, bulbs, the target table and the limits.
export interface Build {
  inputs: string[];
  outputs?: string[];
  target: string | Record<string, string>;
  gates: GateType[];
  maxGates: number;
  maxDepth?: number;
  maxPerType?: Partial<Record<GateType, number>>;
}

// ---- 1. The garage door (predict) ---------------------------------------------
// The wish: keep closing only when both strips are clear. s, t are 1 when pressed.
// The apprentice wired "keep closing when a strip is clear": !s || !t.
export const garage: CircuitSpec = {
  inputs: [{ id: "s" }, { id: "t" }],
  gates: [
    { id: "p", type: "NOT", inputs: ["s"] },
    { id: "q", type: "NOT", inputs: ["t"] },
    { id: "o", type: "OR", inputs: ["p", "q"] },
  ],
  outputs: [{ id: "close", source: "o" }],
};
export const garageSwitches = "10";
export const garageTags = [
  { wire: "p", label: "p", place: "above" as const },
  { wire: "q", label: "q", place: "below" as const },
];

// ---- 2. Two codes, one door (build) ----------------------------------------------
// Opens for up, up, down, down and for up, down, down, down.
export const twoCodes: Build = {
  inputs: ["a", "b", "c", "d"],
  target: tableOf(["a", "b", "c", "d"], (v) => v.a & not(v.c) & not(v.d)) as string,
  gates: BASIC,
  maxGates: 3,
};

// ---- 3. Buckle up (build) -----------------------------------------------------------
// a: driver seated, b: driver's belt buckled, c: passenger seated, d: passenger's belt buckled.
export const buckle: Build = {
  inputs: ["a", "b", "c", "d"],
  target: tableOf(["a", "b", "c", "d"], (v) => (v.a & not(v.b)) | (v.c & not(v.d))) as string,
  gates: ALL4,
  maxGates: 5,
};

// ---- 4. The apprentice's override (find a setting) ------------------------------------
// p: run requested, e: emergency stop pressed, g: cover closed, k: maintenance key turned.
// The wish: run exactly when p, and not e, and (g or k).
// The apprentice wired (p & !e & g) || k.
export const apprentice: CircuitSpec = {
  inputs: [{ id: "p" }, { id: "e" }, { id: "g" }, { id: "k" }],
  gates: [
    { id: "n", type: "NOT", inputs: ["e"] },
    { id: "x", type: "AND", inputs: ["p", "n"] },
    { id: "y", type: "AND", inputs: ["x", "g"] },
    { id: "z", type: "OR", inputs: ["y", "k"] },
  ],
  outputs: [{ id: "run", source: "z" }],
};
export const apprenticeFixed = { e: 1 } as const;

// ---- 5. The override, done right (build) -------------------------------------------------
export const override: Build = {
  inputs: ["p", "e", "g", "k"],
  outputs: ["run"],
  target: tableOf(["p", "e", "g", "k"], (v) => ({ run: v.p & not(v.e) & (v.g | v.k) })) as Record<string, string>,
  gates: ALL4,
  maxGates: 4,
};

// ---- 6. A safe with a siren (build, two bulbs) ---------------------------------------------
// Code up, down, up on a, b, c. e: the enter button is held down.
export const safe: Build = {
  inputs: ["a", "b", "c", "e"],
  outputs: ["door", "siren"],
  target: tableOf(["a", "b", "c", "e"], (v) => {
    const right = v.a & not(v.b) & v.c;
    return { door: v.e & right, siren: v.e & not(right) };
  }) as Record<string, string>,
  gates: ALL4,
  maxGates: 5,
};

// ---- 7. Crossroads (build, two bulbs) ---------------------------------------------------------
// n, s, e, w: that car light is green.
export const crossroads: Build = {
  inputs: ["n", "s", "e", "w"],
  outputs: ["walk", "clash"],
  target: tableOf(["n", "s", "e", "w"], (v) => ({
    walk: not(v.n | v.s | v.e | v.w),
    clash: (v.n | v.s) & (v.e | v.w),
  })) as Record<string, string>,
  gates: ALL4,
  maxGates: 5,
};

// ---- 8. One microphone, three requests (build, three bulbs) ---------------------------------------
// a: host asks, b: guest asks, c: audience asks.
export const microphone: Build = {
  inputs: ["a", "b", "c"],
  outputs: ["host", "guest", "crowd"],
  target: tableOf(["a", "b", "c"], (v) => ({
    host: v.a,
    guest: not(v.a) & v.b,
    crowd: not(v.a) & not(v.b) & v.c,
  })) as Record<string, string>,
  gates: BASIC,
  maxGates: 5,
};

// ---- 9. The toy-packing inspector (build, three bulbs) -------------------------------------------
// a, b: the order asks for a hat, a flag. c, d: the toy has a hat, a flag.
export const inspector: Build = {
  inputs: ["a", "b", "c", "d"],
  outputs: ["green", "amber", "red"],
  target: tableOf(["a", "b", "c", "d"], (v) => {
    const mistakes = (v.a ^ v.c) + (v.b ^ v.d);
    return { green: mistakes === 0, amber: mistakes === 1, red: mistakes === 2 };
  }) as Record<string, string>,
  gates: ALL4,
  maxGates: 6,
};

// ---- 10. Can everybody find a partner? (build, six switches) ----------------------------------------------------
// Children A, B, C, D. a: A with B, b: A with C, c: A with D, d: B with C, e: B with D, f: C with D.
export const partners: Build = {
  inputs: ["a", "b", "c", "d", "e", "f"],
  // The four children split into two pairs in one of three ways: AB with CD, AC with BD, AD with BC.
  target: tableOf(["a", "b", "c", "d", "e", "f"], (v) => {
    const splits = [[v.a, v.f], [v.b, v.e], [v.c, v.d]];
    return splits.some(([p, q]) => p === 1 && q === 1);
  }) as string,
  gates: ["AND", "OR"],
  maxGates: 5,
};

// The patterns reachable from all white. A pattern is a number 0 to 15 with a
// as its highest bit. A move flips a row (a b, or c d) or a column (a c, or b d).
function reachableTiles(): Set<number> {
  const moves = [0b1100, 0b0011, 0b1010, 0b0101];
  const seen = new Set([0]);
  const queue = [0];
  while (queue.length) {
    const p = queue.shift()!;
    for (const m of moves) if (!seen.has(p ^ m)) { seen.add(p ^ m); queue.push(p ^ m); }
  }
  return seen;
}

// ---- 11. The four-tile puzzle (build) --------------------------------------------------------------------------------
// Tiles a b in the top row, c d in the bottom row. 1 is black.
export const tiles: Build = {
  inputs: ["a", "b", "c", "d"],
  outputs: ["can"],
  // Lit on the patterns that moves can reach from all white, found by trying moves.
  target: { can: tableOf(["a", "b", "c", "d"], (v) => reachableTiles().has(v.a * 8 + v.b * 4 + v.c * 2 + v.d)) as string },
  gates: ALL4,
  maxGates: 4,
};

// ---- 12. The bargain box (pick tables) -----------------------------------------------------------------------------------
// Which tables can be built from XOR and NOT gates alone?
export const bargainColumns = ["0111", "1001", "1111", "0001", "1110", "1010"];
export const bargainOptions = bargainColumns.map((col) => ({ table: { inputs: ["a", "b"], outputs: { bulb: col } } }));
export const bargainAnswer = [1, 2, 5];

// ---- 13. One borrowed AND (build) ---------------------------------------------------------------------------------------------
export const borrowed: Build = {
  inputs: ["a", "b"],
  target: "0111",
  gates: ["NOT", "AND", "XOR"],
  maxGates: 3,
  maxPerType: { AND: 1 },
};

// ---- 14. Six detectors, three beats (build) -------------------------------------------------------------------------------------
export const sixDetectors: Build = {
  inputs: ["a", "b", "c", "d", "e", "f"],
  target: tableOf(["a", "b", "c", "d", "e", "f"], (v) => v.a | v.b | v.c | v.d | v.e | v.f) as string,
  gates: ["OR"],
  maxGates: 5,
  maxDepth: 3,
};

// ---- 15. Eight detectors (pick circuits) ----------------------------------------------------------------------------------------------
const EIGHT = ["a", "b", "c", "d", "e", "f", "g", "h"];
const eight = (gates: CircuitSpec["gates"], last: string): CircuitSpec => ({
  inputs: EIGHT.map((id) => ({ id })),
  gates,
  outputs: [{ id: "bell", source: last }],
});
const g2 = (id: string, type: GateType, x: string, y: string) => ({ id, type, inputs: [x, y] });
export const eightOptions: CircuitSpec[] = [
  // A: a chain
  eight([g2("g1", "OR", "a", "b"), g2("g2", "OR", "g1", "c"), g2("g3", "OR", "g2", "d"), g2("g4", "OR", "g3", "e"), g2("g5", "OR", "g4", "f"), g2("g6", "OR", "g5", "g"), g2("g7", "OR", "g6", "h")], "g7"),
  // B: a tournament on neighbours
  eight([g2("g1", "OR", "a", "b"), g2("g2", "OR", "c", "d"), g2("g3", "OR", "e", "f"), g2("g4", "OR", "g", "h"), g2("g5", "OR", "g1", "g2"), g2("g6", "OR", "g3", "g4"), g2("g7", "OR", "g5", "g6")], "g7"),
  // C: a tournament with an AND in the final
  eight([g2("g1", "OR", "a", "b"), g2("g2", "OR", "c", "d"), g2("g3", "OR", "e", "f"), g2("g4", "OR", "g", "h"), g2("g5", "OR", "g1", "g2"), g2("g6", "OR", "g3", "g4"), g2("g7", "AND", "g5", "g6")], "g7"),
  // D: a tournament with other pairings
  eight([g2("g1", "OR", "a", "e"), g2("g2", "OR", "b", "f"), g2("g3", "OR", "c", "g"), g2("g4", "OR", "d", "h"), g2("g5", "OR", "g1", "g3"), g2("g6", "OR", "g2", "g4"), g2("g7", "OR", "g5", "g6")], "g7"),
  // E: two chains of four, then one OR
  eight([g2("g1", "OR", "a", "b"), g2("g2", "OR", "g1", "c"), g2("g3", "OR", "g2", "d"), g2("g4", "OR", "e", "f"), g2("g5", "OR", "g4", "g"), g2("g6", "OR", "g5", "h"), g2("g7", "OR", "g3", "g6")], "g7"),
  // F: a tournament that reads g twice and forgets h
  eight([g2("g1", "OR", "a", "b"), g2("g2", "OR", "c", "d"), g2("g3", "OR", "e", "f"), g2("g4", "OR", "g", "g"), g2("g5", "OR", "g1", "g2"), g2("g6", "OR", "g3", "g4"), g2("g7", "OR", "g5", "g6")], "g7"),
];
export const eightAnswer = [1, 3];

// ---- 16. Sixteen switches (pick a number) ---------------------------------------------------------------------------------------------
export const sixteenDepths = [15, 8, 5, 4, 3];
export const sixteenOptions = sixteenDepths.map((d) => ({ caption: `depth ${d}` }));
export const sixteenAnswer = 3; // depth 4

// ---- 17. Has anything been tampered with? (build, six switches) -----------------------------------------------------------------------
// Panel one a, b, c. Panel two x, y, z. Lit when the panels differ anywhere.
export const tamper: Build = {
  inputs: ["a", "b", "c", "x", "y", "z"],
  target: tableOf(["a", "b", "c", "x", "y", "z"], (v) => (v.a ^ v.x) | (v.b ^ v.y) | (v.c ^ v.z)) as string,
  gates: ALL4,
  maxGates: 5,
  maxDepth: 3,
};
// The follow-up: two panels of four switches. What is the smallest depth?
export const tamperFourDepths = [3, 4, 5, 7];
export const tamperFourOptions = tamperFourDepths.map((d) => ({ caption: `depth ${d}` }));
export const tamperFourAnswer = 0; // depth 3

// ---- 18. Three friends, one tandem (build) ---------------------------------------------------------------------------------------------------
export const tandem: Build = {
  inputs: ["a", "b", "c"],
  outputs: ["book"],
  target: { book: tableOf(["a", "b", "c"], (v) => v.a + v.b + v.c === 2) as string },
  gates: ALL4,
  maxGates: 4,
};

// ---- 19. Swap the spotlights (build, two bulbs) -----------------------------------------------------------------------------------------------
// a, b: the two lighting commands. s: the swap switch.
export const spotlights: Build = {
  inputs: ["a", "b", "s"],
  outputs: ["left", "right"],
  target: tableOf(["a", "b", "s"], (v) => ({ left: v.s ? v.b : v.a, right: v.s ? v.a : v.b })) as Record<string, string>,
  gates: ALL4,
  maxGates: 4,
};

// ---- 20. The chair breaks the tie (build) -----------------------------------------------------------------------------------------------------
// a, b, c: members' votes. t: the chair's vote.
export const chair: Build = {
  inputs: ["a", "b", "c", "t"],
  outputs: ["pass"],
  target: {
    pass: tableOf(["a", "b", "c", "t"], (v) => {
      const yes = v.a + v.b + v.c + v.t;
      return yes > 2 || (yes === 2 && v.t === 1);
    }) as string,
  },
  gates: ALL4,
  maxGates: 6,
};

// ---- 21. The extra footbridge (build) ----------------------------------------------------------------------------------------------------------
// Campsite S, islands U and V, refuge T. a: S-U, b: U-T, c: S-V, d: V-T, e: U-V.
export const footbridge: Build = {
  inputs: ["a", "b", "c", "d", "e"],
  outputs: ["safe"],
  target: {
    // Lit when the open bridges join the campsite to the refuge, found by walking the map.
    safe: tableOf(["a", "b", "c", "d", "e"], (v) => {
      const bridges: [string, string, number][] = [["S", "U", v.a], ["U", "T", v.b], ["S", "V", v.c], ["V", "T", v.d], ["U", "V", v.e]];
      const seen = new Set(["S"]);
      for (let grew = true; grew; ) {
        grew = false;
        for (const [x, y, open] of bridges) {
          if (!open) continue;
          if (seen.has(x) && !seen.has(y)) { seen.add(y); grew = true; }
          if (seen.has(y) && !seen.has(x)) { seen.add(x); grew = true; }
        }
      }
      return seen.has("T");
    }) as string,
  },
  gates: ["AND", "OR"],
  maxGates: 7,
};
