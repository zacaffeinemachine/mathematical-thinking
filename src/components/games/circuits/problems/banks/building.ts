// Circuits and keys for logic-gates/building.mdx (book Section 6.2: building
// AND from NOT and OR, XOR from AND, OR and NOT, and why AND and OR alone can
// never flip a wire).
//
// Kept in TypeScript rather than inline in the MDX so that
// tests/circuit-building.test.ts can import them and check every key by
// walking the full truth table. No solution to a build problem appears here
// or anywhere else in the repo: the test proves each build problem can be
// done within its limit, and not with fewer gates, by searching every circuit.

import type { CircuitSpec, GateType } from "../../model.ts";

const two = [{ id: "a" }, { id: "b" }];
const three = [{ id: "a" }, { id: "b" }, { id: "c" }];
const bulb = (source: string) => [{ id: "out", label: "bulb", source }];

// ===========================================================================
//  Reading disguised circuits
// ===========================================================================

// ---- 1. No OR inside (fill the table) ---------------------------------------
// Flip both, AND them, flip the result: it behaves like OR.
export const noOrInside: CircuitSpec = {
  inputs: two,
  gates: [
    { id: "na", type: "NOT", inputs: ["a"] },
    { id: "nb", type: "NOT", inputs: ["b"] },
    { id: "p", type: "AND", inputs: ["na", "nb"] },
    { id: "n", type: "NOT", inputs: ["p"] },
  ],
  outputs: bulb("n"),
};
export const noOrInsideTags = [{ wire: "p", label: "p", place: "below" as const }];

// ---- 2. Which gate is this? ----------------------------------------------------
// NOT on one input, then XOR, then NOT: the two flips cancel, so it is XOR.
export const twoFlips: CircuitSpec = {
  inputs: two,
  gates: [
    { id: "na", type: "NOT", inputs: ["a"] },
    { id: "x", type: "XOR", inputs: ["na", "b"] },
    { id: "n", type: "NOT", inputs: ["x"] },
  ],
  outputs: bulb("n"),
};
const single = (type: GateType): CircuitSpec => ({
  inputs: two,
  gates: [{ id: "g", type, inputs: ["a", "b"] }],
  outputs: bulb("g"),
});
export const twoFlipsOptions: CircuitSpec[] = [
  single("OR"),
  {
    inputs: two,
    gates: [
      { id: "x", type: "XOR", inputs: ["a", "b"] },
      { id: "n", type: "NOT", inputs: ["x"] },
    ],
    outputs: bulb("n"),
  },
  single("AND"),
  single("XOR"),
];
export const twoFlipsAnswer = 3;

// ---- 3. Read the wires (predict) ------------------------------------------------
export const readOrNot: CircuitSpec = {
  inputs: three,
  gates: [
    { id: "na", type: "NOT", inputs: ["a"] },
    { id: "nb", type: "NOT", inputs: ["b"] },
    { id: "p", type: "OR", inputs: ["na", "nb"] },
    { id: "q", type: "OR", inputs: ["p", "c"] },
    { id: "n", type: "NOT", inputs: ["q"] },
  ],
  outputs: bulb("n"),
};
export const readOrNotSwitches = "110";
export const readOrNotTags = [
  { wire: "p", label: "p", place: "above" as const },
  { wire: "q", label: "q", place: "above" as const },
];

// ---- 4. A box of ORs and NOTs (pick the table) ------------------------------------
export const orNotBox: CircuitSpec = {
  inputs: three,
  gates: [
    { id: "na", type: "NOT", inputs: ["a"] },
    { id: "o1", type: "OR", inputs: ["b", "c"] },
    { id: "n1", type: "NOT", inputs: ["o1"] },
    { id: "o2", type: "OR", inputs: ["na", "n1"] },
    { id: "n2", type: "NOT", inputs: ["o2"] },
  ],
  outputs: bulb("n2"),
};
export const orNotBoxOptions = ["01111111", "00010101", "00000111", "11111000"].map((col) => ({
  table: { inputs: ["a", "b", "c"], outputs: { bulb: col } },
}));
export const orNotBoxAnswer = 2;

// ---- 5. Every setting (find all) ------------------------------------------------------
export const everyOrNot: CircuitSpec = {
  inputs: three,
  gates: [
    { id: "o1", type: "OR", inputs: ["a", "b"] },
    { id: "n1", type: "NOT", inputs: ["o1"] },
    { id: "o2", type: "OR", inputs: ["n1", "c"] },
    { id: "n2", type: "NOT", inputs: ["o2"] },
  ],
  outputs: bulb("n2"),
};
export const everyOrNotCount = 3;

// ---- 6. Always lit (pick all) -----------------------------------------------------------
const oneSwitch = (gates: CircuitSpec["gates"], last: string): CircuitSpec => ({
  inputs: [{ id: "a" }],
  gates,
  outputs: bulb(last),
});
export const alwaysLitOptions: CircuitSpec[] = [
  oneSwitch([{ id: "n", type: "NOT", inputs: ["a"] }, { id: "g", type: "OR", inputs: ["a", "n"] }], "g"),
  oneSwitch([{ id: "n", type: "NOT", inputs: ["a"] }, { id: "g", type: "AND", inputs: ["a", "n"] }], "g"),
  oneSwitch([{ id: "g", type: "XOR", inputs: ["a", "a"] }], "g"),
  oneSwitch([{ id: "n", type: "NOT", inputs: ["a"] }, { id: "g", type: "XOR", inputs: ["a", "n"] }], "g"),
  oneSwitch([{ id: "n", type: "NOT", inputs: ["a"] }, { id: "g", type: "AND", inputs: ["a", "n"] }, { id: "m", type: "NOT", inputs: ["g"] }], "m"),
  oneSwitch([{ id: "g", type: "OR", inputs: ["a", "a"] }, { id: "m", type: "NOT", inputs: ["g"] }], "m"),
];
export const alwaysLitAnswer = [0, 3, 4];

// ===========================================================================
//  Building with a short palette (build problems)
// ===========================================================================

export interface Build {
  inputs: string[];
  target: string;
  gates: GateType[];
  maxGates: number;
}

// 7. One switch, bulb never lit, from NOT and OR.
export const alwaysDark: Build = { inputs: ["a"], target: "00", gates: ["NOT", "OR"], maxGates: 3 };
// 8. Lit unless both switches are up, from NOT and OR.
export const notBoth: Build = { inputs: ["a", "b"], target: "1110", gates: ["NOT", "OR"], maxGates: 3 };
// 9. Lit exactly when a is up and b is down, from XOR and AND.
export const upAndDown: Build = { inputs: ["a", "b"], target: "0010", gates: ["XOR", "AND"], maxGates: 2 };
// 10. OR from XOR and AND.
export const orFromXorAnd: Build = { inputs: ["a", "b"], target: "0111", gates: ["XOR", "AND"], maxGates: 3 };
// 11. AND from XOR and OR.
export const andFromXorOr: Build = { inputs: ["a", "b"], target: "0001", gates: ["XOR", "OR"], maxGates: 3 };
// 12. Lit when the switches agree, from XOR and NOT.
export const agreeXorNot: Build = { inputs: ["a", "b"], target: "1001", gates: ["XOR", "NOT"], maxGates: 2 };
// 13. Lit when the switches agree, from NOT, AND and OR.
export const agreeAndOrNot: Build = { inputs: ["a", "b"], target: "1001", gates: ["NOT", "AND", "OR"], maxGates: 4 };
// 14. XOR from NOT, AND and OR, one gate fewer than the book's five.
export const xorInFour: Build = { inputs: ["a", "b"], target: "0110", gates: ["NOT", "AND", "OR"], maxGates: 4 };
// 15. Three switches, lit exactly when all three are down, from NOT and AND.
export const allDown: Build = { inputs: ["a", "b", "c"], target: "10000000", gates: ["NOT", "AND"], maxGates: 5 };

// ---- harder ----
// 22. XOR from OR and NOT only.
export const xorOrNot: Build = { inputs: ["a", "b"], target: "0110", gates: ["NOT", "OR"], maxGates: 7 };
// 23. Three switches, lit exactly when all three are up, from OR and NOT.
export const allUpOrNot: Build = { inputs: ["a", "b", "c"], target: "00000001", gates: ["NOT", "OR"], maxGates: 6 };

// ===========================================================================
//  What a palette cannot build
// ===========================================================================

// ---- 16. A box of ANDs and ORs: which tables could it have? -----------------------------
export const andOrTables = ["0001", "0110", "0111", "1000", "0101", "1110"];
export const andOrTableOptions = andOrTables.map((col) => ({ table: { inputs: ["a", "b"], outputs: { bulb: col } } }));
export const andOrTableAnswer = [0, 2, 4];

// ---- 17. Catch the claim: a box of ANDs and ORs said to be XOR ----------------------------
// Settings as row numbers (a is the slow column): 0 both down, 1 a down b up, 2 a up b down, 3 both up.
export const catchXorRows = [0, 2, 1, 3];
export const catchXorOptions = [
  { caption: "both down" },
  { caption: "a up, b down" },
  { caption: "a down, b up" },
  { caption: "both up" },
];
export const catchXorAnswer = 3;
export const catchXorClaim = "0110";

// ---- 18. Catch the claim, three switches: said to light exactly when all are down ---------
export const catchNoneRows = [0, 4, 6, 7, 5];
export const catchNoneOptions = [
  { caption: "all three down" },
  { caption: "only a up" },
  { caption: "a and b up, c down" },
  { caption: "all three up" },
  { caption: "a and c up, b down" },
];
export const catchNoneAnswer = [0, 3];
export const catchNoneClaim = "10000000";

// ---- 19. A box of XORs and NOTs: which tables could it have? -------------------------------
// Three sightings, each the full table of a real XOR-and-NOT box.
export const xorNotSeen: Record<string, string> = { "box 1": "1001", "box 2": "1100", "box 3": "1111" };
export const xorNotTables = ["0001", "1010", "0111", "0000", "1110", "0101"];
export const xorNotTableOptions = xorNotTables.map((col) => ({ table: { inputs: ["a", "b"], outputs: { bulb: col } } }));
export const xorNotTableAnswer = [1, 3, 5];

// ---- 20. Which palettes can build OR? ---------------------------------------------------------
export const orPalettes: GateType[][] = [["NOT", "AND"], ["XOR", "AND"], ["XOR", "NOT"], ["NOT"]];
export const orPaletteOptions = [
  { caption: "NOT and AND" },
  { caption: "XOR and AND" },
  { caption: "XOR and NOT" },
  { caption: "NOT alone" },
];
export const orPaletteAnswer = [0, 1];

// ---- 21. Which palettes can build NOT? ----------------------------------------------------------
export const notPalettes: (GateType[] | null)[] = [["AND", "OR"], ["AND", "XOR"], ["OR", "XOR"], ["AND", "OR", "XOR"], null];
export const notPaletteOptions = [
  { caption: "AND and OR" },
  { caption: "AND and XOR" },
  { caption: "OR and XOR" },
  { caption: "AND, OR and XOR" },
  { caption: "none of these" },
];
export const notPaletteAnswer = 4;
