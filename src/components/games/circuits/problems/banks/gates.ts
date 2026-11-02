// Circuits and keys for logic-gates/gates.mdx (book Section 6.1: the four
// gates, their tables, and chaining two-input gates for three inputs).
//
// Kept in TypeScript rather than inline in the MDX so that
// tests/circuit-problems.test.ts can import them and check every key by
// walking the full truth table. No solution to a build problem appears here
// or anywhere else in the repo: the test proves each build problem can be
// done within its limits by searching every small circuit.

import type { CircuitSpec, GateType } from "../../model.ts";

// ---- 1. What is in the box? ---------------------------------------------------
// Three sightings of one sealed box with one gate inside.
export const boxSightings = [
  { switches: "11", bulb: "0" },
  { switches: "01", bulb: "1" },
  { switches: "00", bulb: "0" },
];
const one = (type: GateType, ins: string[]): CircuitSpec => ({
  inputs: [{ id: "a" }, { id: "b" }],
  gates: [{ id: "g", type, inputs: ins }],
  outputs: [{ id: "out", label: "bulb", source: "g" }],
});
export const boxOptions: CircuitSpec[] = [
  one("AND", ["a", "b"]),
  one("OR", ["a", "b"]),
  one("XOR", ["a", "b"]),
  one("NOT", ["a"]),
];
export const boxAnswer = 2; // XOR. AND fails 01, OR fails 11, NOT a fails 00.

// ---- 2. Read the wires --------------------------------------------------------
export const readWires: CircuitSpec = {
  inputs: [{ id: "a" }, { id: "b" }, { id: "c" }],
  gates: [
    { id: "p", type: "XOR", inputs: ["a", "b"] },
    { id: "q", type: "AND", inputs: ["b", "c"] },
    { id: "r", type: "OR", inputs: ["p", "q"] },
  ],
  outputs: [{ id: "out", label: "bulb", source: "r" }],
};
export const readWiresSwitches = "111";
export const readWiresTags = [
  { wire: "p", label: "p", place: "above" as const },
  { wire: "q", label: "q", place: "below" as const },
];

// ---- 3. A gate in disguise ------------------------------------------------------
export const disguised: CircuitSpec = {
  inputs: [{ id: "a" }, { id: "b" }],
  gates: [
    { id: "n", type: "NOT", inputs: ["b"] },
    { id: "x", type: "XOR", inputs: ["a", "n"] },
  ],
  outputs: [{ id: "out", label: "bulb", source: "x" }],
};
export const disguisedTags = [{ wire: "n", label: "p", place: "below" as const }];

// ---- 4. Which table? -------------------------------------------------------------
export const whichTableCircuit: CircuitSpec = {
  inputs: [{ id: "a" }, { id: "b" }],
  gates: [
    { id: "n", type: "NOT", inputs: ["a"] },
    { id: "o", type: "OR", inputs: ["n", "b"] },
  ],
  outputs: [{ id: "out", label: "bulb", source: "o" }],
};
export const whichTableOptions = ["1011", "1101", "0010", "0111"].map((col) => ({
  table: { inputs: ["a", "b"], outputs: { bulb: col } },
}));
export const whichTableAnswer = 1;

// ---- 5. One lit, one dark ---------------------------------------------------------
export const litAndDark: CircuitSpec = {
  inputs: [{ id: "a" }, { id: "b" }, { id: "c" }],
  gates: [
    { id: "g1", type: "AND", inputs: ["a", "b"] },
    { id: "g2", type: "XOR", inputs: ["b", "c"] },
  ],
  outputs: [
    { id: "left", source: "g1" },
    { id: "right", source: "g2" },
  ],
};
export const litAndDarkGoal = { left: 1, right: 0 } as const;

// ---- 6. Three keys (build) -----------------------------------------------------------
export const threeKeys = {
  inputs: ["a", "b", "c"],
  target: "00000001",
  gates: ["AND"] as GateType[],
  maxGates: 2,
};

// ---- 7. A stuck switch -----------------------------------------------------------------
export const stuck: CircuitSpec = {
  inputs: [{ id: "a" }, { id: "b" }, { id: "c" }],
  gates: [
    { id: "x1", type: "XOR", inputs: ["a", "b"] },
    { id: "x2", type: "XOR", inputs: ["b", "c"] },
    { id: "g", type: "AND", inputs: ["x1", "x2"] },
  ],
  outputs: [{ id: "out", label: "bulb", source: "g" }],
};
export const stuckFixed = { b: 0 } as const;

// ---- 8. Both down (build) -----------------------------------------------------------------
export const bothDown = {
  inputs: ["a", "b"],
  target: "1000",
  gates: ["NOT", "AND", "OR"] as GateType[],
  maxGates: 2,
};

// ---- 9. Every setting ---------------------------------------------------------------------
export const everySetting: CircuitSpec = {
  inputs: [{ id: "a" }, { id: "b" }, { id: "c" }],
  gates: [
    { id: "g1", type: "AND", inputs: ["a", "b"] },
    { id: "n", type: "NOT", inputs: ["c"] },
    { id: "g2", type: "OR", inputs: ["g1", "n"] },
  ],
  outputs: [{ id: "out", label: "bulb", source: "g2" }],
};
export const everySettingCount = 5;

// ---- 10. Agree and disagree (build) ---------------------------------------------------------
export const agreeDisagree = {
  inputs: ["a", "b"],
  outputs: ["same", "differ"],
  target: { same: "1001", differ: "0110" },
  gates: ["NOT", "AND", "OR", "XOR"] as GateType[],
  maxGates: 2,
};

// ---- 11. At least one, three ways -------------------------------------------------------------
const three = (gates: CircuitSpec["gates"], last: string): CircuitSpec => ({
  inputs: [{ id: "a" }, { id: "b" }, { id: "c" }],
  gates,
  outputs: [{ id: "out", label: "bulb", source: last }],
});
export const atLeastOneOptions: CircuitSpec[] = [
  three([{ id: "g1", type: "OR", inputs: ["a", "b"] }, { id: "g2", type: "OR", inputs: ["g1", "c"] }], "g2"),
  three([{ id: "g1", type: "XOR", inputs: ["a", "b"] }, { id: "g2", type: "OR", inputs: ["g1", "c"] }], "g2"),
  three([{ id: "g1", type: "OR", inputs: ["b", "c"] }, { id: "g2", type: "OR", inputs: ["a", "g1"] }], "g2"),
  three([{ id: "g1", type: "OR", inputs: ["a", "b"] }, { id: "g2", type: "XOR", inputs: ["g1", "c"] }], "g2"),
  three([{ id: "g1", type: "OR", inputs: ["a", "b"] }, { id: "g2", type: "OR", inputs: ["b", "c"] }, { id: "g3", type: "OR", inputs: ["g1", "g2"] }], "g3"),
  three([{ id: "g1", type: "OR", inputs: ["a", "b"] }, { id: "g2", type: "OR", inputs: ["b", "c"] }, { id: "g3", type: "AND", inputs: ["g1", "g2"] }], "g3"),
];
export const atLeastOneAnswer = [0, 2, 4];

// ---- 12. A staircase with four switches (build) -------------------------------------------------
export const fourStairs = {
  inputs: ["a", "b", "c", "d"],
  // dark with every switch down, and any single flip changes the bulb
  target: "0110100110010110",
  gates: ["XOR"] as GateType[],
  maxGates: 3,
};
