// Circuits and keys for logic-gates/nand.mdx (book Section 6.6: one gate is
// enough, NAND, with NOR from the section's exercise).
//
// Kept in TypeScript rather than inline in the MDX so that
// tests/circuit-nand.test.ts can import them and check every key by walking
// the full truth table. No solution to a build problem appears here or
// anywhere else in the repo: the test proves each build problem can be done
// within its limit, and that the limit is the fewest possible, by searching
// every smaller circuit.

import type { CircuitSpec, GateType } from "../../model.ts";

type G = CircuitSpec["gates"][number];
const two = (gates: G[], last: string): CircuitSpec => ({
  inputs: [{ id: "a" }, { id: "b" }],
  gates,
  outputs: [{ id: "out", label: "bulb", source: last }],
});
const three = (gates: G[], last: string): CircuitSpec => ({
  inputs: [{ id: "a" }, { id: "b" }, { id: "c" }],
  gates,
  outputs: [{ id: "out", label: "bulb", source: last }],
});
const nand = (id: string, x: string, y: string): G => ({ id, type: "NAND", inputs: [x, y] });
const nor = (id: string, x: string, y: string): G => ({ id, type: "NOR", inputs: [x, y] });

const NAND_ONLY: GateType[] = ["NAND"];
const NOR_ONLY: GateType[] = ["NOR"];

// =============================================================================
//  Reading NAND circuits
// =============================================================================

// ---- 1. Two NANDs, one table (fill) -------------------------------------------
export const twoNands = two([nand("p", "a", "b"), nand("q", "p", "b")], "q");
export const twoNandsTags = [{ wire: "p", label: "p", place: "above" as const }];

// ---- 2. Read the wires (predict) -------------------------------------------------
export const readWires = three([nand("p", "a", "b"), nand("q", "p", "c"), nand("r", "q", "a")], "r");
export const readWiresSwitches = "101";
export const readWiresTags = [
  { wire: "p", label: "p", place: "above" as const },
  { wire: "q", label: "q", place: "above" as const },
];

// ---- 3. Which one is an OR? (pick) ----------------------------------------------
export const whichOrOptions: CircuitSpec[] = [
  two([nand("g", "a", "b"), nand("h", "g", "g")], "h"),                                   // AND
  two([nand("n", "a", "a"), nand("g", "n", "b")], "g"),                                   // a, or b down
  two([nand("n", "a", "a"), nand("m", "b", "b"), nand("g", "n", "m")], "g"),              // OR
  two([nand("n", "a", "a"), nand("m", "b", "b"), nand("g", "n", "m"), nand("h", "g", "g")], "h"), // neither
];
export const whichOrAnswer = 2;

// ---- 4. The one dark setting (find, hidden bulb) ---------------------------------
export const oneDark = three(
  [nand("n", "b", "b"), nand("p", "a", "n"), nand("u", "p", "p"), nand("r", "u", "c")],
  "r",
);
export const oneDarkGoal = { out: 0 } as const;

// ---- 5. Always lit (pick all) ------------------------------------------------------
export const alwaysLitOptions: CircuitSpec[] = [
  two([nand("n", "a", "a"), nand("g", "a", "n")], "g"),
  two([nand("g", "a", "b"), nand("h", "g", "a")], "h"),
  two([nand("g", "a", "b"), nand("h", "g", "g"), nand("k", "g", "h")], "k"),
  two([nand("n", "a", "a"), nand("m", "b", "b"), nand("g", "n", "m")], "g"),
];
export const alwaysLitAnswer = [0, 2];

// ---- 6. What is in the box? (sightings, pick) ------------------------------------------
export const boxSightings = [
  { switches: "00", bulb: "1" },
  { switches: "01", bulb: "1" },
  { switches: "11", bulb: "1" },
];
export const boxOptions: CircuitSpec[] = [
  two([nand("g", "a", "b")], "g"),                                                                     // NAND
  two([nand("n", "a", "a"), nand("m", "b", "b"), nand("g", "n", "m"), nand("h", "g", "g")], "h"),     // neither up
  two([nand("g", "a", "b"), nand("h", "a", "g"), nand("k", "b", "g"), nand("o", "h", "k")], "o"),     // differ
  two([nand("g", "a", "b"), nand("h", "a", "g")], "h"),                                                // if a then b
];
export const boxAnswer = 3;

// =============================================================================
//  Build problems (targets and limits; every limit is the fewest possible)
// =============================================================================

export interface Build {
  inputs: string[];
  outputs?: string[];
  target: string | Record<string, string>;
  gates: GateType[];
  maxGates: number;
  maxFanIn?: number;
}

// ---- the four gates from NAND ---------------------------------------------------------
export const buildNot: Build = { inputs: ["a"], target: "10", gates: NAND_ONLY, maxGates: 1 };
export const buildAnd: Build = { inputs: ["a", "b"], target: "0001", gates: NAND_ONLY, maxGates: 2 };
export const buildOr: Build = { inputs: ["a", "b"], target: "0111", gates: NAND_ONLY, maxGates: 3 };

// ---- small jobs ---------------------------------------------------------------------------
export const alwaysDark: Build = { inputs: ["a"], target: "00", gates: NAND_ONLY, maxGates: 3 };
export const ifThen: Build = { inputs: ["a", "b"], target: "1101", gates: NAND_ONLY, maxGates: 2 };
export const upDownLock: Build = { inputs: ["a", "b"], target: "0010", gates: NAND_ONLY, maxGates: 3 };
export const threeKeys: Build = { inputs: ["a", "b", "c"], target: "00000001", gates: NAND_ONLY, maxGates: 4 };
// c up: the bulb copies a. c down: the bulb copies b.
export const chooser: Build = { inputs: ["a", "b", "c"], target: "00100111", gates: NAND_ONLY, maxGates: 4 };

// =============================================================================
//  NOR only
// =============================================================================

// ---- reading a NOR circuit (fill) ------------------------------------------------------------
export const norFill = two([nor("p", "a", "a"), nor("q", "p", "b")], "q");
export const norFillTags = [{ wire: "p", label: "p", place: "below" as const }];

export const norOr: Build = { inputs: ["a", "b"], target: "0111", gates: NOR_ONLY, maxGates: 2 };
export const norAnd: Build = { inputs: ["a", "b"], target: "0001", gates: NOR_ONLY, maxGates: 3 };
export const norIfThen: Build = { inputs: ["a", "b"], target: "1101", gates: NOR_ONLY, maxGates: 3 };

// =============================================================================
//  Harder
// =============================================================================

export const nandXor: Build = { inputs: ["a", "b"], target: "0110", gates: NAND_ONLY, maxGates: 4 };
export const agreeDiffer: Build = {
  inputs: ["a", "b"],
  outputs: ["same", "differ"],
  target: { same: "1001", differ: "0110" },
  gates: NAND_ONLY,
  maxGates: 5,
};
export const fireAlarm: Build = { inputs: ["a", "b", "c"], outputs: ["bell"], target: "01111111", gates: NAND_ONLY, maxGates: 6 };
export const majority: Build = { inputs: ["a", "b", "c"], target: "00010111", gates: NAND_ONLY, maxGates: 6 };
export const norXor: Build = { inputs: ["a", "b"], target: "0110", gates: NOR_ONLY, maxGates: 5 };
export const wideMajority: Build = { inputs: ["a", "b", "c"], target: "00010111", gates: NAND_ONLY, maxGates: 4, maxFanIn: 3 };

// ---- sightings drawn in build statements (checked against the targets) ----------
export const chooserSightings = [
  { switches: "101", bulb: "1" },
  { switches: "011", bulb: "0" },
  { switches: "010", bulb: "1" },
];
export const majoritySightings = [
  { switches: "110", bulb: "1" },
  { switches: "100", bulb: "0" },
  { switches: "011", bulb: "1" },
];
