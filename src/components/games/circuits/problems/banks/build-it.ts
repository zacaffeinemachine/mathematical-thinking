// Switches, bulbs, targets and fewest counts for logic-gates/build-it.mdx
// ("Build It Yourself"): build problems from everyday life, games, numbers
// and the islanders, every one of them built by hand in CircuitBuilder.
//
// No problem has a gate limit. Each carries `fewest`, the smallest number of
// gates any circuit for it can use. A right circuit with more gates is told
// that fewer will do, and one with exactly that many is told it is the
// fewest. tests/circuit-build-it.test.ts rebuilds every target from the rule
// as the page words it, row by row, and proves each `fewest` by searching
// every smaller circuit. No solution circuit is written down anywhere.
//
// Themes already used on pages 1 to 7 (seat belts, garage doors, safes,
// crossroads, votes, staircases, spotlights) are deliberately absent.

import type { GateType } from "../../model.ts";

export interface Build {
  inputs: (string | { id: string; label: string })[];
  outputs?: { id: string; label: string }[];
  target: string | Record<string, string>;
  gates: GateType[];
  fewest: number;
}

export interface Islander {
  name: string;
  sw: string;         // the switch letter (her initial), up for an oracle
  says?: string;
}

const PALETTE: GateType[] = ["NOT", "AND", "OR", "XOR"];
const bulbs = (...names: [string, string][]) => names.map(([id, label]) => ({ id, label }));
const build = (inputs: Build["inputs"], target: Build["target"], fewest: number, outputs?: Build["outputs"]): Build =>
  ({ inputs, target, gates: PALETTE, fewest, ...(outputs ? { outputs } : {}) });

// ===========================================================================
//  At home and in town
// ===========================================================================

// 1. The porch light. d: it is dark. m: something moves.
export const porch = build(["d", "m"], { lamp: "0001" }, 1, bulbs(["lamp", "lamp"]));

// 2. The fridge alarm. o: door open. t: open for a minute. w: inside warm.
export const fridge = build(["o", "t", "w"], { beep: "00000111" }, 2, bulbs(["beep", "beep"]));

// 3. The bathroom fan. l: light on. d: air damp. w: window open.
export const fan = build(["l", "d", "w"], { fan: "00101010" }, 3, bulbs(["fan", "fan"]));

// 4. The sprinkler. d: soil dry. r: raining. t: test button pressed.
export const sprinkler = build(["d", "r", "t"], { water: "01011101" }, 3, bulbs(["water", "water"]));

// 5. The lift. d: doors shut. f: lift on the upper floor. r: upper floor asked for.
export const lift = build(["d", "f", "r"], { motor: "00000110" }, 2, bulbs(["motor", "motor"]));

// 6. The cat flap. c: cat at the flap. d: dog nearby. n: night.
export const catFlap = build(["c", "d", "n"], { in: "00001100", out: "00001000" }, 4, bulbs(["in", "in"], ["out", "out"]));

// 7. The traffic light. A count from 0 to 3 on a (worth 2) and b (worth 1).
//    0 red, 1 red and amber, 2 green, 3 amber.
export const traffic = build(["a", "b"], { red: "1100", amber: "0101", green: "0010" }, 3,
  bulbs(["red", "red"], ["amber", "amber"], ["green", "green"]));

// ===========================================================================
//  Games
// ===========================================================================

// 8. The die. x worth 4, y worth 2, z worth 1. The dots are wired in four
// groups (drawn in BuildPictures.tsx): A the diagonal pair that shows two, B
// the other diagonal pair, C the middle pair of the outer columns, M the
// middle dot. M is lit for an odd number, A from 2 up, B from 4 up, C from 6 up.
export function dieGroups(n: number): Record<"A" | "B" | "C" | "M", boolean> {
  return { M: n % 2 === 1, A: n >= 2, B: n >= 4, C: n >= 6 };
}
export const die = build(["x", "y", "z"], { M: "01010101", A: "00111111", B: "00001111", C: "00000011" }, 2,
  bulbs(["A", "A"], ["B", "B"], ["C", "C"], ["M", "M"]));

// 9. Odd one out. r, s, t: the thumbs of Ruth, Sam and Tom, up or down.
export const oddOne = build(["r", "s", "t"], { ruth: "00011000", sam: "00100100", tom: "01000010" }, 5,
  bulbs(["ruth", "Ruth"], ["sam", "Sam"], ["tom", "Tom"]));

// ===========================================================================
//  Numbers
// ===========================================================================

// 10. The next number. x worth 4, y worth 2, z worth 1; after 7 comes 0.
export const nextNumber = build(["x", "y", "z"], { X: "00011110", Y: "01100110", Z: "10101010" }, 4,
  bulbs(["X", "X"], ["Y", "Y"], ["Z", "Z"]));

// 11. Thirty-one days. The month on p (worth 8), q (4), r (2), s (1).
export const longMonths = build(["p", "q", "r", "s"], { long: "0101010110101000" }, 4, bulbs(["long", "31 days"]));

// 12. How many are up? Bulb "2" worth 2 and bulb "1" worth 1.
export const countUp = build(["a", "b", "c"], { two: "00010111", one: "01101001" }, 5, bulbs(["two", "2"], ["one", "1"]));

// 13. Threes. x worth 4, y worth 2, z worth 1: lit for 0, 3 and 6.
export const threes = build(["x", "y", "z"], { out: "10010010" }, 5);

// Bars lit in each digit 0 to 9 of a seven-bar display: a top, b top right,
// c bottom right, d bottom, e bottom left, f top left, g middle.
export const DIGIT_BARS = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];

// 14. One bar of a clock. The digit on p (8), q (4), r (2), s (1); the bottom
//     left bar, lit for 0, 2, 6 and 8, and dark for 10 to 15.
export const bar = build(["p", "q", "r", "s"], { bar: "1010001010000000" }, 5, bulbs(["bar", "bar"]));

// ===========================================================================
//  Islanders
// ===========================================================================

// 15. I am a chimera.
export const chimeraPeople: Islander[] = [{ name: "Daphne", sw: "d", says: "I am a chimera." }];
export const iAmChimera = build(["d"], "00", 1);

// 16. Same kind. Electra: "Hebe and I are the same kind."
export const sameKindPeople: Islander[] = [
  { name: "Electra", sw: "e", says: "Hebe and I are the same kind." },
  { name: "Hebe", sw: "h" },
];
export const sameKind = build(["e", "h"], "0101", 0);

// 17. An even number. Ariadne: "An even number of us four are oracles."
//     The bulb is lit when she fits.
export const evenPeople: Islander[] = [
  { name: "Ariadne", sw: "a", says: "An even number of us four are oracles." },
  { name: "Clio", sw: "c" },
  { name: "Daphne", sw: "d" },
  { name: "Electra", sw: "e" },
];
export const evenFits = build(["a", "c", "d", "e"], "0110100101101001", 2);

// ===========================================================================
//  Harder
// ===========================================================================

// 18. Line them up. Top lit when at least one switch is up, middle when at
//     least two, bottom when all three.
export const lineUp = build(["a", "b", "c"], { top: "01111111", middle: "00010111", bottom: "00000001" }, 6,
  bulbs(["top", "top"], ["middle", "middle"], ["bottom", "bottom"]));

// 19. Which is bigger? Ann's number on a (2), b (1); Ben's on c (2), d (1).
export const bigger = build(["a", "b", "c", "d"], { ann: "0000100011001110" }, 6, bulbs(["ann", "Ann wins"]));

// 20. Rock, paper, scissors. Ann's hand on a, b and Ben's on c, d:
//     down down rock, down up paper, up down scissors, up up no hand.
export const rps = build(["a", "b", "c", "d"], { ann: "0010100001000000" }, 6, bulbs(["ann", "Ann wins"]));

// 21. Wolf, goat and cabbage. Up: on the far bank.
export const river = build(["f", "w", "g", "c"], { safe: "1110110000110111" }, 6, bulbs(["safe", "safe"]));
