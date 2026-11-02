// Circuits and keys for logic-gates/if-then.mdx (book Section 6.3: If Then
// Circuits). The recipe of the section: "if P then Q" is wired as
// (!P) || Q, a bulb that goes dark on the one pattern where the if-part
// holds and the then-part fails.
//
// Kept in TypeScript so that tests/circuit-if-then.test.ts can import every
// circuit and key and check it by walking the full truth table. No solution
// to a build problem appears here or anywhere else in the repo: the test
// proves each build problem can be done within its limit, and not with one
// gate fewer, by searching every small circuit.

import type { CircuitSpec, GateType } from "../../model.ts";

const ALL: GateType[] = ["NOT", "AND", "OR", "XOR"];

// A circuit on the given switches whose one bulb (label "bulb") reads `last`.
const box = (inputs: string[], gates: CircuitSpec["gates"], last: string, bulb = "bulb"): CircuitSpec => ({
  inputs: inputs.map((id) => ({ id })),
  gates,
  outputs: [{ id: "out", label: bulb, source: last }],
});

// ============================================================================
//  Reading an if-then box
// ============================================================================

// ---- 1. Rain and coat (predict) ----------------------------------------------
// "If it rains, I take my coat."
export const rainCoat = box(["rain", "coat"], [
  { id: "n", type: "NOT", inputs: ["rain"] },
  { id: "o", type: "OR", inputs: ["n", "coat"] },
], "o");
export const rainCoatSwitches = "10";
export const rainCoatTags = [{ wire: "n", label: "p", place: "above" as const }];

// ---- 2. The other way round (fill) ---------------------------------------------
// The box for "if b is up, then a is up".
export const converseBox = box(["a", "b"], [
  { id: "n", type: "NOT", inputs: ["b"] },
  { id: "o", type: "OR", inputs: ["a", "n"] },
], "o");
export const converseTags = [{ wire: "n", label: "p", place: "below" as const }];

// ---- 3. Which claim is in the box? (pick) ----------------------------------------
export const sightings = [
  { switches: "00", bulb: "1" },
  { switches: "01", bulb: "0" },
  { switches: "10", bulb: "1" },
];
export const sightingClaims = [
  "if a is up, then b is up",
  "if b is up, then a is up",
  "a is up unless b is up",
  "a is up if and only if b is up",
];
export const sightingAnswer = 1;

// ============================================================================
//  Rules from everyday life (build)
// ============================================================================

// Build problems: inputs, the target column, the palette and the gate limit.
// Each limit is the fewest possible (checked in the test).
export const pool = { inputs: ["child", "adult"], target: "1101", gates: ALL, maxGates: 2 };
export const shop = { inputs: ["open", "sign"], target: "1011", gates: ALL, maxGates: 2 };
export const saw = { inputs: ["running", "open"], target: "1110", gates: ALL, maxGates: 2 };
export const match = { inputs: ["rain", "played"], target: "0111", gates: ALL, maxGates: 1 };
export const lights = { inputs: ["someone", "light"], target: "1011", gates: ALL, maxGates: 2 };

// ============================================================================
//  The four relatives
// ============================================================================

// ---- 9. One claim, drawn four ways (pick, select all) ----------------------------
// Which boxes check "if b is down, then a is down"?
export const contraOptions: CircuitSpec[] = [
  // not a, or b
  box(["a", "b"], [
    { id: "n", type: "NOT", inputs: ["a"] },
    { id: "o", type: "OR", inputs: ["n", "b"] },
  ], "o"),
  // not b, or a
  box(["a", "b"], [
    { id: "n", type: "NOT", inputs: ["b"] },
    { id: "o", type: "OR", inputs: ["a", "n"] },
  ], "o"),
  // the recipe word for word: if-part !b, then-part !a, flip the if-part, OR
  box(["a", "b"], [
    { id: "n1", type: "NOT", inputs: ["b"] },
    { id: "n2", type: "NOT", inputs: ["n1"] },
    { id: "n3", type: "NOT", inputs: ["a"] },
    { id: "o", type: "OR", inputs: ["n3", "n2"] },
  ], "o"),
  // flip of "a up and b down"
  box(["a", "b"], [
    { id: "n", type: "NOT", inputs: ["b"] },
    { id: "g", type: "AND", inputs: ["a", "n"] },
    { id: "f", type: "NOT", inputs: ["g"] },
  ], "f"),
  // not a, or not b
  box(["a", "b"], [
    { id: "n1", type: "NOT", inputs: ["a"] },
    { id: "n2", type: "NOT", inputs: ["b"] },
    { id: "o", type: "OR", inputs: ["n1", "n2"] },
  ], "o"),
];
export const contraAnswer = [0, 2, 3];

// ---- 10. Which sentences share this box? (pick sentences, select all) -------------
// The box for "if the dog is inside, then the cat is outside".
export const petBox = box(["dog", "cat"], [
  { id: "g", type: "AND", inputs: ["dog", "cat"] },
  { id: "f", type: "NOT", inputs: ["g"] },
], "f");
export const petSentences = [
  "If the cat is inside, then the dog is outside.",
  "If the dog is outside, then the cat is inside.",
  "If the cat is outside, then the dog is inside.",
  "The dog and the cat are never both inside.",
  "The dog is inside unless the cat is inside.",
];
export const petAnswer = [0, 3];

// ---- 11. A claim and its converse (find) ------------------------------------------
export const claimConverse: CircuitSpec = {
  inputs: [{ id: "a" }, { id: "b" }],
  gates: [
    { id: "n1", type: "NOT", inputs: ["a"] },
    { id: "o1", type: "OR", inputs: ["n1", "b"] },
    { id: "n2", type: "NOT", inputs: ["b"] },
    { id: "o2", type: "OR", inputs: ["n2", "a"] },
  ],
  outputs: [
    { id: "claim", source: "o1" },
    { id: "converse", source: "o2" },
  ],
};
export const claimConverseGoal = { claim: 1, converse: 0 } as const;

// ============================================================================
//  Bigger halves (three switches)
// ============================================================================

export const laser = { inputs: ["laser", "goggles", "gloves"], target: "11110001", gates: ALL, maxGates: 3 };
export const late = { inputs: ["late", "note", "parent"], target: "11110111", gates: ALL, maxGates: 3 };

// ---- 14. Every way to break it (find all) -----------------------------------------
// "If a is up, then b and c disagree."
export const disagreeBox = box(["a", "b", "c"], [
  { id: "x", type: "XOR", inputs: ["b", "c"] },
  { id: "n", type: "NOT", inputs: ["a"] },
  { id: "o", type: "OR", inputs: ["n", "x"] },
], "o");
export const disagreeGoal = { out: 0 } as const;

// ---- 15. Read the wires (predict) ---------------------------------------------------
// "If a or b is up, then c is down."
export const orDownBox = box(["a", "b", "c"], [
  { id: "p", type: "OR", inputs: ["a", "b"] },
  { id: "np", type: "NOT", inputs: ["p"] },
  { id: "q", type: "NOT", inputs: ["c"] },
  { id: "o", type: "OR", inputs: ["np", "q"] },
], "o");
export const orDownSwitches = "011";
export const orDownTags = [
  { wire: "p", label: "p", place: "above" as const },
  { wire: "q", label: "q", place: "below" as const },
];

// ============================================================================
//  An if-then inside an if-then
// ============================================================================

// ---- 16. The one dark setting (find, hidden) -----------------------------------------
// "If a is up, then: if b is up, then c is up", wired word for word.
export const nestedBox = box(["a", "b", "c"], [
  { id: "nb", type: "NOT", inputs: ["b"] },
  { id: "inner", type: "OR", inputs: ["nb", "c"] },
  { id: "na", type: "NOT", inputs: ["a"] },
  { id: "o", type: "OR", inputs: ["na", "inner"] },
], "o");
export const nestedGoal = { out: 0 } as const;

// ---- 17. Same claim? (pick, select all) -------------------------------------------------
// Which boxes check the same claim as nestedBox?
export const sameClaimOptions: CircuitSpec[] = [
  // "if a and b are both up, then c is up"
  box(["a", "b", "c"], [
    { id: "g", type: "AND", inputs: ["a", "b"] },
    { id: "n", type: "NOT", inputs: ["g"] },
    { id: "o", type: "OR", inputs: ["n", "c"] },
  ], "o"),
  // "if a or b is up, then c is up"
  box(["a", "b", "c"], [
    { id: "g", type: "OR", inputs: ["a", "b"] },
    { id: "n", type: "NOT", inputs: ["g"] },
    { id: "o", type: "OR", inputs: ["n", "c"] },
  ], "o"),
  // "if b is up, then: if a is up, then c is up"
  box(["a", "b", "c"], [
    { id: "na", type: "NOT", inputs: ["a"] },
    { id: "inner", type: "OR", inputs: ["na", "c"] },
    { id: "nb", type: "NOT", inputs: ["b"] },
    { id: "o", type: "OR", inputs: ["nb", "inner"] },
  ], "o"),
  // "if (if a is up, then b is up), then c is up"
  box(["a", "b", "c"], [
    { id: "na", type: "NOT", inputs: ["a"] },
    { id: "inner", type: "OR", inputs: ["na", "b"] },
    { id: "ni", type: "NOT", inputs: ["inner"] },
    { id: "o", type: "OR", inputs: ["ni", "c"] },
  ], "o"),
];
export const sameClaimAnswer = [0, 2];

// ============================================================================
//  If and only if
// ============================================================================

// ---- 18. Which boxes say "if and only if"? (pick, select all) ---------------------------
export const iffOptions: CircuitSpec[] = [
  box(["a", "b"], [
    { id: "x", type: "XOR", inputs: ["a", "b"] },
    { id: "n", type: "NOT", inputs: ["x"] },
  ], "n"),
  box(["a", "b"], [
    { id: "x", type: "XOR", inputs: ["a", "b"] },
  ], "x"),
  box(["a", "b"], [
    { id: "n", type: "NOT", inputs: ["a"] },
    { id: "x", type: "XOR", inputs: ["n", "b"] },
  ], "x"),
  box(["a", "b"], [
    { id: "n1", type: "NOT", inputs: ["a"] },
    { id: "o1", type: "OR", inputs: ["n1", "b"] },
    { id: "n2", type: "NOT", inputs: ["b"] },
    { id: "o2", type: "OR", inputs: ["n2", "a"] },
    { id: "o", type: "OR", inputs: ["o1", "o2"] },
  ], "o"),
  box(["a", "b"], [
    { id: "n1", type: "NOT", inputs: ["a"] },
    { id: "n2", type: "NOT", inputs: ["b"] },
    { id: "x", type: "XOR", inputs: ["n1", "n2"] },
  ], "x"),
  box(["a", "b"], [
    { id: "n", type: "NOT", inputs: ["b"] },
    { id: "x", type: "XOR", inputs: ["a", "n"] },
  ], "x"),
];
export const iffAnswer = [0, 2, 5];

// ---- 19. Testing the vault lamp (build) ---------------------------------------------------
export const vault = { inputs: ["left", "right", "lamp"], target: "10101001", gates: ALL, maxGates: 3 };

// ============================================================================
//  Harder (build)
// ============================================================================

export const ifInIf = { inputs: ["a", "b", "c"], target: "01011101", gates: ALL, maxGates: 3 };
export const iffNoXor = { inputs: ["a", "b"], target: "1001", gates: ["NOT", "AND", "OR"] as GateType[], maxGates: 4 };
export const twoRules = { inputs: ["six", "move", "card"], target: "11010001", gates: ALL, maxGates: 4 };
