// Circuits and keys for logic-gates/any-table.mdx (book Section 6.5, The
// Design Challenge: spike detectors, the recipe, every table can be built,
// OR and NOT are enough, the majority vote and its smaller circuit).
//
// Kept in TypeScript so that tests/circuit-any-table.test.ts can check every
// key by walking the full truth table. No solution to a build problem appears
// here or anywhere else in the repo: the test proves each build problem can
// be done within its limit, and that the limit is the fewest possible, by
// searching every small circuit.
//
// Row order: the first switch is the leftmost column and changes slowest.

import type { CircuitSpec, GateType } from "../../model.ts";

const NAO: GateType[] = ["NOT", "AND", "OR"];
const NAOX: GateType[] = ["NOT", "AND", "OR", "XOR"];
const ON: GateType[] = ["OR", "NOT"];
const AO: GateType[] = ["AND", "OR"];

const ab = [{ id: "a" }, { id: "b" }];
const abc = [{ id: "a" }, { id: "b" }, { id: "c" }];
const abcd = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];

// ---- 1. A board of detectors (predict) ------------------------------------------
// The four spike detectors of two switches, each to its own bulb, in a
// scrambled order. Exactly one bulb is lit on every row.
export const board: CircuitSpec = {
  width: 480,
  height: 300,
  inputs: [{ id: "a", x: 40, y: 70 }, { id: "b", x: 40, y: 230 }],
  gates: [
    { id: "na", type: "NOT", inputs: ["a"], x: 110, y: 120 },
    { id: "nb", type: "NOT", inputs: ["b"], x: 110, y: 190 },
    { id: "w", type: "AND", inputs: ["na", "b"], x: 250, y: 45 },
    { id: "x", type: "AND", inputs: ["a", "b"], x: 250, y: 115 },
    { id: "y", type: "AND", inputs: ["a", "nb"], x: 250, y: 185 },
    { id: "z", type: "AND", inputs: ["na", "nb"], x: 250, y: 255 },
  ],
  outputs: [
    { id: "w", source: "w", x: 420, y: 45 },
    { id: "x", source: "x", x: 420, y: 115 },
    { id: "y", source: "y", x: 420, y: 185 },
    { id: "z", source: "z", x: 420, y: 255 },
  ],
};
export const boardSwitches = "10";

// ---- 2. Which row opens it? (find one, hidden) -------------------------------------
export const whichRow: CircuitSpec = {
  inputs: abcd,
  gates: [
    { id: "na", type: "NOT", inputs: ["a"] },
    { id: "nc", type: "NOT", inputs: ["c"] },
    { id: "p", type: "AND", inputs: ["na", "b"] },
    { id: "q", type: "AND", inputs: ["nc", "d"] },
    { id: "r", type: "AND", inputs: ["p", "q"] },
  ],
  outputs: [{ id: "out", label: "bulb", source: "r" }],
};
export const whichRowAnswer = "0101";

// ---- 3 to 5. Spike detectors (build) --------------------------------------------------
export const spike01 = { inputs: ["a", "b"], target: "0100", gates: NAO, maxGates: 2 };
export const spike01Sightings = [
  { switches: "00", bulb: "0" },
  { switches: "01", bulb: "1" },
  { switches: "10", bulb: "0" },
  { switches: "11", bulb: "0" },
];
export const spike101 = { inputs: ["a", "b", "c"], target: "00000100", gates: NAO, maxGates: 3 };
export const allDown = { inputs: ["a", "b", "c", "d"], target: "1000000000000000", gates: NAO, maxGates: 4, recipe: 7 };

// ---- 6. Count before you build (pick a number) ------------------------------------------
export const countTable = { inputs: ["a", "b", "c"], column: "10010100" }; // winning rows 000, 011, 101
export const countOptions = [8, 9, 11, 14];
export const countAnswer = 2;

// ---- 7. Read the recipe backwards (find all) ----------------------------------------------
// A circuit made by the recipe, with detectors for 001, 100 and 110.
export const backwards: CircuitSpec = {
  width: 770,
  height: 350,
  inputs: [{ id: "a", x: 40, y: 60 }, { id: "b", x: 40, y: 170 }, { id: "c", x: 40, y: 280 }],
  gates: [
    { id: "na", type: "NOT", inputs: ["a"], x: 110, y: 100 },
    { id: "nb", type: "NOT", inputs: ["b"], x: 110, y: 210 },
    { id: "nc", type: "NOT", inputs: ["c"], x: 110, y: 320 },
    { id: "p3", type: "AND", inputs: ["a", "b"], x: 250, y: 60 },
    { id: "p2", type: "AND", inputs: ["a", "nb"], x: 250, y: 170 },
    { id: "p1", type: "AND", inputs: ["na", "nb"], x: 250, y: 280 },
    { id: "d3", type: "AND", inputs: ["p3", "nc"], x: 380, y: 60 },
    { id: "d2", type: "AND", inputs: ["p2", "nc"], x: 380, y: 170 },
    { id: "d1", type: "AND", inputs: ["p1", "c"], x: 380, y: 280 },
    { id: "o1", type: "OR", inputs: ["d3", "d2"], x: 500, y: 115 },
    { id: "o2", type: "OR", inputs: ["o1", "d1"], x: 610, y: 200 },
  ],
  outputs: [{ id: "out", label: "bulb", source: "o2", x: 700, y: 200 }],
};
export const backwardsRows = ["001", "100", "110"];

// ---- 8. A friend's table (build, any circuit within the recipe's count) --------------------
export const friend = { inputs: ["a", "b", "c"], target: "01010110", gates: NAO, maxGates: 14 };

// ---- 9. Many circuits, one table (pick all) --------------------------------------------------
// The table: lit when a is up, or when b and c are both down.
export const manyTable = { inputs: ["a", "b", "c"], column: "10001111" };
const c3 = (gates: CircuitSpec["gates"], last: string): CircuitSpec => ({
  inputs: abc,
  gates,
  outputs: [{ id: "out", label: "bulb", source: last }],
});
export const manyOptions: CircuitSpec[] = [
  c3([
    { id: "o1", type: "OR", inputs: ["b", "c"] },
    { id: "n", type: "NOT", inputs: ["o1"] },
    { id: "o2", type: "OR", inputs: ["a", "n"] },
  ], "o2"),
  c3([
    { id: "o1", type: "AND", inputs: ["b", "c"] },
    { id: "n", type: "NOT", inputs: ["o1"] },
    { id: "o2", type: "OR", inputs: ["a", "n"] },
  ], "o2"),
  c3([
    { id: "nb", type: "NOT", inputs: ["b"] },
    { id: "nc", type: "NOT", inputs: ["c"] },
    { id: "g", type: "AND", inputs: ["nb", "nc"] },
    { id: "o", type: "OR", inputs: ["a", "g"] },
  ], "o"),
  c3([
    { id: "nb", type: "NOT", inputs: ["b"] },
    { id: "nc", type: "NOT", inputs: ["c"] },
    { id: "o1", type: "OR", inputs: ["a", "nb"] },
    { id: "o2", type: "OR", inputs: ["a", "nc"] },
    { id: "g", type: "AND", inputs: ["o1", "o2"] },
  ], "g"),
  c3([
    { id: "nb", type: "NOT", inputs: ["b"] },
    { id: "nc", type: "NOT", inputs: ["c"] },
    { id: "o1", type: "OR", inputs: ["a", "nb"] },
    { id: "g", type: "AND", inputs: ["o1", "nc"] },
  ], "g"),
  c3([
    { id: "o1", type: "OR", inputs: ["a", "b"] },
    { id: "o2", type: "OR", inputs: ["o1", "c"] },
    { id: "n", type: "NOT", inputs: ["o2"] },
  ], "n"),
];
export const manyAnswer = [0, 2, 3];

// ---- 10. Two winning rows (pick a number) -------------------------------------------------------
export const twoRowsTable = { inputs: ["a", "b", "c", "d"], column: "0000000000000011" }; // 1110 and 1111
export const twoRowsOptions = [7, 8, 9, 12];
export const twoRowsAnswer = 1;

// ---- 11. The same table, smaller (build) ----------------------------------------------------------
export const twoRowsBuild = { inputs: ["a", "b", "c", "d"], target: "0000000000000011", gates: NAO, maxGates: 2 };

// ---- 12 and 13. OR and NOT only (build) -------------------------------------------------------------
export const noAnd = { inputs: ["a", "b"], target: "0010", gates: ON, maxGates: 3 };
export const noAndSightings = [
  { switches: "00", bulb: "0" },
  { switches: "01", bulb: "0" },
  { switches: "10", bulb: "1" },
  { switches: "11", bulb: "0" },
];
export const spike101On = { inputs: ["a", "b", "c"], target: "00000100", gates: ON, maxGates: 5 };

// ---- 14. No NOT at all (pick all tables) ----------------------------------------------------------------
export const noNotColumns = ["00010111", "01101001", "00110111", "00110101", "00010110", "00000101"];
export const noNotOptions = noNotColumns.map((col) => ({ table: { inputs: ["a", "b", "c"], outputs: { bulb: col } } }));
export const noNotAnswer = [0, 2, 5];

// ---- 15 to 17. Votes with AND and OR (build) ----------------------------------------------------------------
export const twoOfFour = { inputs: ["a", "b", "c", "d"], target: "0001011101111111", gates: AO, maxGates: 7 };
export const threeOfFour = { inputs: ["a", "b", "c", "d"], target: "0000000100010111", gates: AO, maxGates: 7 };
// a chairs the meeting: the motion passes when the chair and at least one
// member say yes, or when all three members say yes.
export const chair = { inputs: ["a", "b", "c", "d"], target: "0000000101111111", gates: AO, maxGates: 6 };

// Sightings printed beside the vote problems, as [switches, bulb].
export const twoOfFourSightings = [["0101", 1], ["0010", 0]] as const;
export const threeOfFourSightings = [["1011", 1], ["1100", 0]] as const;
export const chairSightings = [["1001", 1], ["0111", 1], ["0110", 0]] as const;
export const exactlyOneSightings = [["010", 1], ["110", 0], ["000", 0]] as const;

// ---- 18 to 21. Beating the recipe (build, hard) ------------------------------------------------------------
export const majority = { inputs: ["a", "b", "c"], target: "00010111", gates: NAOX, maxGates: 4, book: 5, recipe: 14 };
export const exactlyOne = { inputs: ["a", "b", "c"], target: "01101000", gates: NAOX, maxGates: 4 };
export const friendSmall = { inputs: ["a", "b", "c"], target: "01010110", gates: NAOX, maxGates: 2 };
export const spike0110 = { inputs: ["a", "b", "c", "d"], target: "0000001000000000", gates: NAO, maxGates: 4, recipe: 5 };
