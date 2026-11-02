// Circuits, islanders and keys for logic-gates/isles.mdx (book Section 6.7,
// The Isles of Paradox: one switch per islander, up for an oracle; a wire
// for each claim; the agreement box, an XOR followed by a NOT, comparing each
// speaker's type with her claim; an AND of everything; then the bash).
//
// None of the puzzles here is in the book, on the Logical Thinking pages or on
// the Boolean Algebra puzzle page. tests/circuit-isles.test.ts encodes every
// puzzle again, from the sentences as the page prints them, finds its
// consistent settings by trying every row, and checks each circuit and key
// below against that. No solution to a build problem appears here or anywhere
// else in the repo: the test proves each build problem can be done within its
// limit, and not with fewer gates, by searching every small circuit.
//
// The checking circuits drawn on the page are built with the book's recipe and
// never with a shortcut. In particular "Y is a chimera" is drawn as a NOT on
// Y's switch, and each agreement box as an XOR then a NOT, so that no drawing
// on the page is the answer to one of the page's build problems.

import type { CircuitSpec, GateType } from "../../model.ts";

type Gate = CircuitSpec["gates"][number];

export interface Islander {
  name: string;
  sw: string;         // the switch letter, up for an oracle
  says?: string;      // her sentence, without quotation marks; absent if she says nothing
}

// The agreement box of the book: an XOR followed by a NOT. Its output is 1
// exactly when the speaker's type and the truth of her claim agree.
const agree = (id: string, type: string, claim: string): Gate[] => [
  { id: `${id}x`, type: "XOR", inputs: [type, claim] },
  { id, type: "NOT", inputs: [`${id}x`] },
];
const g = (id: string, type: GateType, inputs: string[]): Gate => ({ id, type, inputs });
// AND the given wires together with two-input gates, one after another.
const allOf = (prefix: string, wires: string[]): { gates: Gate[]; out: string } => {
  const gates: Gate[] = [];
  let acc = wires[0];
  for (let k = 1; k < wires.length; k++) {
    const id = k === wires.length - 1 ? `${prefix}` : `${prefix}${k}`;
    gates.push(g(id, "AND", [acc, wires[k]]));
    acc = id;
  }
  return { gates, out: acc };
};
const spec = (inputs: string[], gates: Gate[], outputs: CircuitSpec["outputs"]): CircuitSpec => ({
  inputs: inputs.map((id) => ({ id })),
  gates,
  outputs,
});
const one = (inputs: string[], gates: Gate[], source: string, label = "bulb"): CircuitSpec =>
  spec(inputs, gates, [{ id: "out", label, source }]);

// ===========================================================================
//  Claims as wires
// ===========================================================================

// ---- 1. At least one of them -----------------------------------------------
// Selene: "At least one of Ariadne and Thalia is a chimera."
const at = (gates: Gate[], last: string) => one(["a", "t"], gates, last);
export const atLeastOneOptions: CircuitSpec[] = [
  at([g("na", "NOT", ["a"]), g("nt", "NOT", ["t"]), g("y", "AND", ["na", "nt"])], "y"),
  at([g("na", "NOT", ["a"]), g("nt", "NOT", ["t"]), g("y", "OR", ["na", "nt"])], "y"),
  at([g("y", "XOR", ["a", "t"])], "y"),
  at([g("y", "NAND", ["a", "t"])], "y"),
];
export const atLeastOneAnswer = [1, 3];

// ---- 2. Exactly one chimera, as a table --------------------------------------
// Daphne: "Exactly one of us three is a chimera." Switches d, e, h.
export const exactlyOneTableOptions = ["01101000", "00010110", "01101001", "11111110"].map((col) => ({
  table: { inputs: ["d", "e", "h"], outputs: { claim: col } },
}));
export const exactlyOneTableAnswer = 1;

// ---- 3. An if-then claim ------------------------------------------------------
// Thalia: "If Phoebe is an oracle, then so is Selene."
const ps = (gates: Gate[], last: string) => one(["p", "s"], gates, last);
export const ifThenOptions: CircuitSpec[] = [
  ps([g("np", "NOT", ["p"]), g("y", "OR", ["np", "s"])], "y"),
  ps([g("ns", "NOT", ["s"]), g("y", "OR", ["p", "ns"])], "y"),
  ps([g("y", "AND", ["p", "s"])], "y"),
  ps([g("ns", "NOT", ["s"]), g("w", "AND", ["p", "ns"]), g("y", "NOT", ["w"])], "y"),
];
export const ifThenAnswer = [0, 3];

// ---- 4. Phoebe fits (build) ---------------------------------------------------
// Phoebe: "Selene is a chimera." Bulb lit when Phoebe's type agrees with her claim.
export const phoebeFits = {
  inputs: ["p", "s"],
  target: "0110",
  gates: ["NOT", "AND", "OR", "XOR"] as GateType[],
  maxGates: 1,
};

// ---- 5. Thalia fits (build) ---------------------------------------------------
// Thalia: "Ariadne and I are both oracles."
export const thaliaFits = {
  inputs: ["a", "t"],
  target: "1011",
  gates: ["NOT", "AND", "OR", "XOR"] as GateType[],
  maxGates: 2,
};

// ---- 6. Exactly one oracle (build) ----------------------------------------------
// Ariadne: "Exactly one of us three is an oracle." Switches a, c, d.
export const exactlyOneOracle = {
  inputs: ["a", "c", "d"],
  target: "01101000",
  gates: ["NOT", "AND", "OR", "XOR"] as GateType[],
  maxGates: 4,
};

// ===========================================================================
//  The bash
// ===========================================================================

// ---- 7. Fill in the bash --------------------------------------------------------
// Doris: "Electra and I are different kinds."  Electra: "Doris is an oracle."
export const bashPeople: Islander[] = [
  { name: "Doris", sw: "d", says: "Electra and I are different kinds." },
  { name: "Electra", sw: "e", says: "Doris is an oracle." },
];
export const bash: CircuitSpec = one(
  ["d", "e"],
  [
    g("dc", "XOR", ["d", "e"]),
    ...agree("df", "d", "dc"),
    ...agree("ef", "e", "d"),
    g("all", "AND", ["df", "ef"]),
  ],
  "all",
);
export const bashTags = [
  { wire: "dc", label: "Doris claim", place: "above" as const },
  { wire: "df", label: "Doris fits", place: "above" as const },
  { wire: "ef", label: "Electra fits", place: "below" as const },
];

// ===========================================================================
//  Find the islanders (one setting)
// ===========================================================================

// ---- 8. The ruby ------------------------------------------------------------------
// Switches c (up: the ruby is in the Coral box), h (Hebe), d (Daphne), in that
// order because it draws with the fewest crossings.
// Daphne: "The ruby is in the Amber box, and Hebe is a chimera."
// Hebe:   "If Daphne is a chimera, then the ruby is in the Coral box."
// Hebe's box is the if-then recipe with P = !d and Q = c, so it is d OR c.
export const rubyPeople: Islander[] = [
  { name: "Daphne", sw: "d", says: "The ruby is in the Amber box, and Hebe is a chimera." },
  { name: "Hebe", sw: "h", says: "If Daphne is a chimera, then the ruby is in the Coral box." },
];
export const ruby: CircuitSpec = one(
  ["c", "h", "d"],
  [
    g("nc", "NOT", ["c"]),
    g("nh", "NOT", ["h"]),
    g("dc", "AND", ["nc", "nh"]),
    ...agree("df", "d", "dc"),
    g("hc", "OR", ["d", "c"]),
    ...agree("hf", "h", "hc"),
    g("all", "AND", ["df", "hf"]),
  ],
  "all",
);

// ---- 9. At least one chimera ------------------------------------------------------
// Clio: "At least one of Doris and me is an oracle."
// Doris: "Clio and Electra are the same kind."
// Electra: "Doris and I are both oracles."
// We are told that at least one of the three is a chimera.
export const countPeople: Islander[] = [
  { name: "Clio", sw: "c", says: "At least one of Doris and me is an oracle." },
  { name: "Doris", sw: "d", says: "Clio and Electra are the same kind." },
  { name: "Electra", sw: "e", says: "Doris and I are both oracles." },
];
const countAll = allOf("all", ["cf", "df", "ef", "k"]);
export const countCircuit: CircuitSpec = one(
  ["c", "d", "e"],
  [
    g("cc", "OR", ["c", "d"]),
    ...agree("cf", "c", "cc"),
    g("dx", "XOR", ["c", "e"]),
    g("dc", "NOT", ["dx"]),
    ...agree("df", "d", "dc"),
    g("ec", "AND", ["d", "e"]),
    ...agree("ef", "e", "ec"),
    g("k1", "AND", ["c", "d"]),
    g("k2", "AND", ["k1", "e"]),
    g("k", "NOT", ["k2"]),
    ...countAll.gates,
  ],
  countAll.out,
);

// ---- 10. Exactly one chimera, said aloud ------------------------------------------
// Ariadne: "Exactly one of us three is a chimera."
// Daphne:  "Ariadne is a chimera."
// Electra: "At least one of Ariadne and Daphne is an oracle."
// Ariadne's claim: an even number of oracles, and at least one of them.
export const threePeople: Islander[] = [
  { name: "Ariadne", sw: "a", says: "Exactly one of us three is a chimera." },
  { name: "Daphne", sw: "d", says: "Ariadne is a chimera." },
  { name: "Electra", sw: "e", says: "At least one of Ariadne and Daphne is an oracle." },
];
const threeAll = allOf("all", ["af", "df", "ef"]);
export const threeCircuit: CircuitSpec = one(
  ["a", "d", "e"],
  [
    g("x1", "XOR", ["a", "d"]),
    g("x2", "XOR", ["x1", "e"]),
    g("ev", "NOT", ["x2"]),
    g("o1", "OR", ["a", "d"]),
    g("o2", "OR", ["o1", "e"]),
    g("ac", "AND", ["ev", "o2"]),
    ...agree("af", "a", "ac"),
    g("dc", "NOT", ["a"]),
    ...agree("df", "d", "dc"),
    g("ec", "OR", ["a", "d"]),
    ...agree("ef", "e", "ec"),
    ...threeAll.gates,
  ],
  threeAll.out,
);

// ===========================================================================
//  Every setting that fits
// ===========================================================================

// ---- 11. Two islanders, two answers ------------------------------------------------
// Ariadne: "Exactly one of us two is an oracle."  Selene: "Ariadne and I are both oracles."
export const twoPeople: Islander[] = [
  { name: "Ariadne", sw: "a", says: "Exactly one of us two is an oracle." },
  { name: "Selene", sw: "s", says: "Ariadne and I are both oracles." },
];
export const twoCircuit: CircuitSpec = one(
  ["a", "s"],
  [
    g("ac", "XOR", ["a", "s"]),
    ...agree("af", "a", "ac"),
    g("sc", "AND", ["a", "s"]),
    ...agree("sf", "s", "sc"),
    g("all", "AND", ["af", "sf"]),
  ],
  "all",
);

// ---- 12 and 13. Circles ----------------------------------------------------------------
// Each islander says "<the next one round the circle> is a chimera."
const circle = (sw: string[]): CircuitSpec => {
  const gates: Gate[] = [];
  const fits: string[] = [];
  sw.forEach((x, k) => {
    const next = sw[(k + 1) % sw.length];
    gates.push(g(`n${next}`, "NOT", [next]));
    gates.push(...agree(`${x}f`, x, `n${next}`));
    fits.push(`${x}f`);
  });
  const a = allOf("all", fits);
  return one(sw, [...gates, ...a.gates], a.out);
};
export const circle3People: Islander[] = [
  { name: "Ariadne", sw: "a", says: "Clio is a chimera." },
  { name: "Clio", sw: "c", says: "Daphne is a chimera." },
  { name: "Daphne", sw: "d", says: "Ariadne is a chimera." },
];
export const circle3 = circle(["a", "c", "d"]);
export const circle4People: Islander[] = [
  { name: "Ariadne", sw: "a", says: "Clio is a chimera." },
  { name: "Clio", sw: "c", says: "Daphne is a chimera." },
  { name: "Daphne", sw: "d", says: "Electra is a chimera." },
  { name: "Electra", sw: "e", says: "Ariadne is a chimera." },
];
export const circle4 = circle(["a", "c", "d", "e"]);

// ---- 14. Three answers ------------------------------------------------------------------
// Phoebe: "Selene and I are both oracles."
// Selene: "At least one of Thalia and me is an oracle."
// Thalia: "If Phoebe is an oracle, then so am I."
export const manyPeople: Islander[] = [
  { name: "Phoebe", sw: "p", says: "Selene and I are both oracles." },
  { name: "Selene", sw: "s", says: "At least one of Thalia and me is an oracle." },
  { name: "Thalia", sw: "t", says: "If Phoebe is an oracle, then so am I." },
];
const manyAll = allOf("all", ["pf", "sf", "tf"]);
export const manyCircuit: CircuitSpec = one(
  ["p", "s", "t"],
  [
    g("pc", "AND", ["p", "s"]),
    ...agree("pf", "p", "pc"),
    g("sc", "OR", ["s", "t"]),
    ...agree("sf", "s", "sc"),
    g("np", "NOT", ["p"]),
    g("tc", "OR", ["np", "t"]),
    ...agree("tf", "t", "tc"),
    ...manyAll.gates,
  ],
  manyAll.out,
);

// ===========================================================================
//  Build the checking circuit
// ===========================================================================

// ---- 15. Three bulbs (build) -------------------------------------------------------------
// Ariadne: "Thalia and I are different kinds."  Thalia: "At least one of us two is an oracle."
// Bulbs: Ariadne fits, Thalia fits, both fit.
export const threeBulbsPeople: Islander[] = [
  { name: "Ariadne", sw: "a", says: "Thalia and I are different kinds." },
  { name: "Thalia", sw: "t", says: "At least one of us two is an oracle." },
];
export const threeBulbs = {
  inputs: ["a", "t"],
  outputs: [
    { id: "af", label: "Ariadne" },
    { id: "tf", label: "Thalia" },
    { id: "both", label: "both" },
  ],
  target: { af: "1010", tf: "1101", both: "1000" },
  gates: ["NOT", "AND", "OR", "XOR"] as GateType[],
};

// ---- 16. Which circuit checks the puzzle? ------------------------------------------------
// Hebe: "Electra and I are both oracles."  Electra: "Hebe and I are different kinds."
// We are told that exactly one of the two is a chimera.
export const pickPeople: Islander[] = [
  { name: "Hebe", sw: "h", says: "Electra and I are both oracles." },
  { name: "Electra", sw: "e", says: "Hebe and I are different kinds." },
];
const pick = (count: Gate[], hebeClaim: Gate[], electraClaim: Gate[]): CircuitSpec => {
  const a = allOf("all", count.length ? ["hf", "ef", "k"] : ["hf", "ef"]);
  return one(["h", "e"], [...hebeClaim, ...agree("hf", "h", "hc"), ...electraClaim, ...agree("ef", "e", "ec"), ...count, ...a.gates], a.out);
};
const hebeRight = [g("hc", "AND", ["h", "e"])];
const electraRight = [g("ec", "XOR", ["h", "e"])];
const countRight = [g("k", "XOR", ["h", "e"])];
export const pickOptions: CircuitSpec[] = [
  pick([], hebeRight, electraRight),                                                // the count is missing
  pick(countRight, hebeRight, electraRight),                                        // right
  pick([g("kx", "XOR", ["h", "e"]), g("k", "NOT", ["kx"])], hebeRight, electraRight), // the count says "same kind"
  pick(countRight, [g("hc", "OR", ["h", "e"])], electraRight),                      // Hebe's claim built with OR
];
export const pickAnswer = 1;

// ===========================================================================
//  Radios
// ===========================================================================

// ---- 17. Three radios (build) --------------------------------------------------------
// Switch ab is up when the report says radios A and B are on the same channel.
export const radios3 = {
  inputs: [
    { id: "ab", label: "AB" },
    { id: "bc", label: "BC" },
    { id: "ca", label: "CA" },
  ],
  ids: ["ab", "bc", "ca"],
  target: "01101001",
  gates: ["NOT", "AND", "OR", "XOR"] as GateType[],
  maxGates: 2,
};

// ===========================================================================
//  Harder
// ===========================================================================

// ---- 18. Four on the beach -------------------------------------------------------------
// Ariadne: "Clio is an oracle."
// Clio:    "At least one of Daphne and Electra is an oracle."
// Daphne:  "If Ariadne is an oracle, then so is Clio."
// Electra: "Exactly one of Clio and Daphne is an oracle."
export const fourPeople: Islander[] = [
  { name: "Ariadne", sw: "a", says: "Clio is an oracle." },
  { name: "Clio", sw: "c", says: "At least one of Daphne and Electra is an oracle." },
  { name: "Daphne", sw: "d", says: "If Ariadne is an oracle, then so is Clio." },
  { name: "Electra", sw: "e", says: "Exactly one of Clio and Daphne is an oracle." },
];
const fourAll = allOf("all", ["af", "cf", "df", "ef"]);
export const fourCircuit: CircuitSpec = one(
  ["a", "c", "d", "e"],
  [
    ...agree("af", "a", "c"),
    g("cc", "OR", ["d", "e"]),
    ...agree("cf", "c", "cc"),
    g("na", "NOT", ["a"]),
    g("dc", "OR", ["na", "c"]),
    ...agree("df", "d", "dc"),
    g("ec", "XOR", ["c", "d"]),
    ...agree("ef", "e", "ec"),
    ...fourAll.gates,
  ],
  fourAll.out,
);

// ---- 19. Four radios in a ring (build) --------------------------------------------------
export const radios4 = {
  inputs: [
    { id: "ab", label: "AB" },
    { id: "bc", label: "BC" },
    { id: "cd", label: "CD" },
    { id: "da", label: "DA" },
  ],
  ids: ["ab", "bc", "cd", "da"],
  target: "1001011001101001",
  gates: ["NOT", "AND", "OR", "XOR"] as GateType[],
  maxGates: 4,
};

// ---- 20. One gate is enough (build) ------------------------------------------------------
// Ariadne: "Phoebe and I are the same kind."
// Phoebe:  "At least one of Ariadne and Thalia is an oracle."
// Thalia:  "Ariadne and I are both oracles."
export const oneGatePeople: Islander[] = [
  { name: "Ariadne", sw: "a", says: "Phoebe and I are the same kind." },
  { name: "Phoebe", sw: "p", says: "At least one of Ariadne and Thalia is an oracle." },
  { name: "Thalia", sw: "t", says: "Ariadne and I are both oracles." },
];
export const oneGate = {
  inputs: ["a", "p", "t"],
  target: "00000011",
  gates: ["NOT", "AND", "OR", "XOR"] as GateType[],
  maxGates: 1,
};
