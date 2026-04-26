import type { Circuit } from "./model";

// Each circuit lays out coordinates manually so the SVG is
// self-explanatory: inputs on the left, outputs on the right, gates
// flowing left-to-right roughly in topological order.

// --- single-gate showcases --------------------------------------------

export const notGate: Circuit = {
  width: 280,
  height: 100,
  inputs: [{ id: "a", label: "a", x: 50, y: 50 }],
  gates: [
    { id: "g1", type: "NOT", x: 110, y: 50, inputs: ["a"] },
  ],
  outputs: [{ id: "out", label: "!a", x: 220, y: 50, source: "g1" }],
};

export const andGate: Circuit = {
  width: 280,
  height: 130,
  inputs: [
    { id: "a", label: "a", x: 40, y: 45 },
    { id: "b", label: "b", x: 40, y: 85 },
  ],
  gates: [{ id: "g1", type: "AND", x: 110, y: 65, inputs: ["a", "b"] }],
  outputs: [{ id: "out", label: "a · b", x: 220, y: 65, source: "g1" }],
};

export const orGate: Circuit = {
  width: 280,
  height: 130,
  inputs: [
    { id: "a", label: "a", x: 40, y: 45 },
    { id: "b", label: "b", x: 40, y: 85 },
  ],
  gates: [{ id: "g1", type: "OR", x: 110, y: 65, inputs: ["a", "b"] }],
  outputs: [{ id: "out", label: "a + b + ab", x: 220, y: 65, source: "g1" }],
};

export const xorGate: Circuit = {
  width: 280,
  height: 130,
  inputs: [
    { id: "a", label: "a", x: 40, y: 45 },
    { id: "b", label: "b", x: 40, y: 85 },
  ],
  gates: [{ id: "g1", type: "XOR", x: 110, y: 65, inputs: ["a", "b"] }],
  outputs: [{ id: "out", label: "a + b", x: 220, y: 65, source: "g1" }],
};

export const nandGate: Circuit = {
  width: 280,
  height: 130,
  inputs: [
    { id: "a", label: "a", x: 40, y: 45 },
    { id: "b", label: "b", x: 40, y: 85 },
  ],
  gates: [{ id: "g1", type: "NAND", x: 110, y: 65, inputs: ["a", "b"] }],
  outputs: [{ id: "out", label: "!(ab)", x: 230, y: 65, source: "g1" }],
};

// --- compositions ------------------------------------------------------

// Always-zero gadget: a · !a
export const alwaysZero: Circuit = {
  width: 360,
  height: 130,
  inputs: [{ id: "a", label: "a", x: 40, y: 65 }],
  gates: [
    { id: "n1", type: "NOT", x: 100, y: 95, inputs: ["a"] },
    { id: "g1", type: "AND", x: 200, y: 65, inputs: ["a", "n1"] },
  ],
  outputs: [{ id: "out", label: "0", x: 310, y: 65, source: "g1" }],
};

// Always-one gadget: a + !a (using OR with !a as second input)
export const alwaysOne: Circuit = {
  width: 360,
  height: 130,
  inputs: [{ id: "a", label: "a", x: 40, y: 65 }],
  gates: [
    { id: "n1", type: "NOT", x: 100, y: 95, inputs: ["a"] },
    { id: "g1", type: "OR", x: 200, y: 65, inputs: ["a", "n1"] },
  ],
  outputs: [{ id: "out", label: "1", x: 310, y: 65, source: "g1" }],
};

// Three-input OR: (a OR b) OR c
export const orChain3: Circuit = {
  width: 420,
  height: 170,
  inputs: [
    { id: "a", label: "a", x: 40, y: 45 },
    { id: "b", label: "b", x: 40, y: 85 },
    { id: "c", label: "c", x: 40, y: 130 },
  ],
  gates: [
    { id: "g1", type: "OR", x: 130, y: 65, inputs: ["a", "b"] },
    { id: "g2", type: "OR", x: 250, y: 100, inputs: ["g1", "c"] },
  ],
  outputs: [{ id: "out", label: "a||b||c", x: 360, y: 100, source: "g2" }],
};

// AND from NOT and OR (De Morgan): !(!a || !b)
export const andFromNotOr: Circuit = {
  width: 460,
  height: 160,
  inputs: [
    { id: "a", label: "a", x: 30, y: 50 },
    { id: "b", label: "b", x: 30, y: 110 },
  ],
  gates: [
    { id: "n1", type: "NOT", x: 90, y: 50, inputs: ["a"] },
    { id: "n2", type: "NOT", x: 90, y: 110, inputs: ["b"] },
    { id: "g1", type: "OR", x: 200, y: 80, inputs: ["n1", "n2"] },
    { id: "n3", type: "NOT", x: 320, y: 80, inputs: ["g1"] },
  ],
  outputs: [{ id: "out", label: "ab", x: 410, y: 80, source: "n3" }],
};

// XOR from AND, OR, NOT: (a & !b) | (!a & b)
export const xorFromBasics: Circuit = {
  width: 480,
  height: 200,
  inputs: [
    { id: "a", label: "a", x: 30, y: 60 },
    { id: "b", label: "b", x: 30, y: 140 },
  ],
  gates: [
    { id: "nb", type: "NOT", x: 90, y: 100, inputs: ["b"] },
    { id: "na", type: "NOT", x: 90, y: 160, inputs: ["a"] },
    { id: "and1", type: "AND", x: 200, y: 60, inputs: ["a", "nb"] },
    { id: "and2", type: "AND", x: 200, y: 140, inputs: ["na", "b"] },
    { id: "or1", type: "OR", x: 320, y: 100, inputs: ["and1", "and2"] },
  ],
  outputs: [{ id: "out", label: "a ⊕ b", x: 430, y: 100, source: "or1" }],
};

// Three-input XOR chain: (a XOR b) XOR c
export const xorChain3: Circuit = {
  width: 460,
  height: 170,
  inputs: [
    { id: "a", label: "a", x: 30, y: 45 },
    { id: "b", label: "b", x: 30, y: 85 },
    { id: "c", label: "c", x: 30, y: 130 },
  ],
  gates: [
    { id: "x1", type: "XOR", x: 130, y: 65, inputs: ["a", "b"] },
    { id: "x2", type: "XOR", x: 280, y: 100, inputs: ["x1", "c"] },
  ],
  outputs: [{ id: "out", label: "bulb", x: 400, y: 100, source: "x2" }],
};

// Concrete recipe table from the chapter:
//   out = 1 on rows (0,0), (1,0), (1,1).
//   recipe = (!a & !b) | (a & !b) | (a & b)
export const recipeWalkthrough: Circuit = {
  width: 720,
  height: 360,
  inputs: [
    { id: "a", label: "a", x: 30, y: 70 },
    { id: "b", label: "b", x: 30, y: 290 },
  ],
  gates: [
    { id: "na", type: "NOT", x: 110, y: 130, inputs: ["a"] },
    { id: "nb", type: "NOT", x: 110, y: 230, inputs: ["b"] },
    { id: "s00", type: "AND", x: 320, y: 70, inputs: ["na", "nb"], label: "spike (0,0)" },
    { id: "s10", type: "AND", x: 320, y: 180, inputs: ["a", "nb"], label: "spike (1,0)" },
    { id: "s11", type: "AND", x: 320, y: 290, inputs: ["a", "b"], label: "spike (1,1)" },
    { id: "or1", type: "OR", x: 480, y: 125, inputs: ["s00", "s10"] },
    { id: "or2", type: "OR", x: 590, y: 210, inputs: ["or1", "s11"] },
  ],
  outputs: [{ id: "out", label: "out", x: 690, y: 210, source: "or2" }],
};

// Majority-of-three: (a & b) | (a & c) | (b & c) — the "nicer" circuit
export const majority3: Circuit = {
  width: 660,
  height: 340,
  inputs: [
    { id: "a", label: "a", x: 30, y: 60 },
    { id: "b", label: "b", x: 30, y: 170 },
    { id: "c", label: "c", x: 30, y: 280 },
  ],
  gates: [
    { id: "ab", type: "AND", x: 220, y: 80, inputs: ["a", "b"] },
    { id: "ac", type: "AND", x: 220, y: 170, inputs: ["a", "c"] },
    { id: "bc", type: "AND", x: 220, y: 260, inputs: ["b", "c"] },
    { id: "or1", type: "OR", x: 380, y: 125, inputs: ["ab", "ac"] },
    { id: "or2", type: "OR", x: 510, y: 195, inputs: ["or1", "bc"] },
  ],
  outputs: [{ id: "out", label: "majority", x: 620, y: 195, source: "or2" }],
};

// NAND builds NOT: tie both inputs together
export const nandNot: Circuit = {
  width: 280,
  height: 130,
  inputs: [{ id: "a", label: "a", x: 40, y: 65 }],
  gates: [{ id: "g1", type: "NAND", x: 130, y: 65, inputs: ["a", "a"] }],
  outputs: [{ id: "out", label: "!a", x: 240, y: 65, source: "g1" }],
};

// NAND builds AND: NAND followed by a NAND-as-NOT
export const nandAnd: Circuit = {
  width: 420,
  height: 140,
  inputs: [
    { id: "a", label: "a", x: 30, y: 50 },
    { id: "b", label: "b", x: 30, y: 100 },
  ],
  gates: [
    { id: "g1", type: "NAND", x: 110, y: 75, inputs: ["a", "b"] },
    { id: "g2", type: "NAND", x: 250, y: 75, inputs: ["g1", "g1"] },
  ],
  outputs: [{ id: "out", label: "ab", x: 360, y: 75, source: "g2" }],
};

// NAND builds OR: !a NAND !b. NOT replaced by NAND-tied.
export const nandOr: Circuit = {
  width: 460,
  height: 180,
  inputs: [
    { id: "a", label: "a", x: 30, y: 60 },
    { id: "b", label: "b", x: 30, y: 130 },
  ],
  gates: [
    { id: "na", type: "NAND", x: 110, y: 60, inputs: ["a", "a"] },
    { id: "nb", type: "NAND", x: 110, y: 130, inputs: ["b", "b"] },
    { id: "g1", type: "NAND", x: 250, y: 95, inputs: ["na", "nb"] },
  ],
  outputs: [{ id: "out", label: "a||b", x: 380, y: 95, source: "g1" }],
};

// Staircase 2-switch, the XOR
export const staircase2: Circuit = {
  width: 320,
  height: 130,
  inputs: [
    { id: "a", label: "top", x: 50, y: 45 },
    { id: "b", label: "bot", x: 50, y: 85 },
  ],
  gates: [{ id: "g1", type: "XOR", x: 150, y: 65, inputs: ["a", "b"] }],
  outputs: [{ id: "out", label: "bulb", x: 260, y: 65, source: "g1" }],
};
