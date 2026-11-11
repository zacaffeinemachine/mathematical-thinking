// Switches, bulbs, targets and the sealed adder box for logic-gates/adders.mdx
// ("Adding Numbers"): circuits that add two numbers of 1 and 2 bits, and a
// 3-bit adder built from a box that adds 2-bit numbers. (A 3-bit adder built
// from gates alone was dropped: it takes too many gates to be a good exercise.)
//
// A number of n bits sits on n switches a_(n-1), ..., a_1, a_0, where a_i is
// worth 2^i: a_0 is worth 1, a_1 is worth 2, a_2 is worth 4. Ids carry the
// letter and the index (a2, a1, a0), labels use subscripts (a₂, a₁, a₀). The
// sum sits on n + 1 bulbs s_n, ..., s_0, the same way.
//
// Every builder lays the switches and bulbs out as a written sum: the a row,
// then the b row with a "+" in the carry column, and the bulb row along the
// bottom, so that a_i, b_i and s_i share a column.
//
// tests/circuit-adders.test.ts rebuilds every target and the box's table from
// the rule as the page words it, and proves the two `fewest` counts by
// searching every smaller circuit. The 3-bit problem has six switches, too
// many for the search (its tables are 32-bit masks), so it carries no
// `fewest`. No solution circuit is written down anywhere.

import type { GateType } from "../../model.ts";

type Cell = string | null | { text: string };

export interface AdderBuild {
  inputs: { id: string; label: string }[];
  outputs: { id: string; label: string }[];
  target: Record<string, string>;
  gates: GateType[];
  grid: { rows: Cell[][]; bulbs: (string | null)[] };
  fewest?: number;
}

// The shape CircuitBuilder's `boxes` prop takes (BoxPart there).
export interface AdderBox {
  type: string;
  title: string;
  inputs: string[];
  outputs: string[];
  table: string[];
  gap: number;
  max: number;
  required: boolean;
}

const PALETTE: GateType[] = ["NOT", "AND", "OR", "XOR"];
export const SUB = ["₀", "₁", "₂", "₃", "₄"];

// Indices of an n-bit number, most valuable first: 3 -> [2, 1, 0].
export const indices = (n: number) => Array.from({ length: n }, (_, k) => n - 1 - k);

const named = (letter: string, n: number) => indices(n).map((i) => ({ id: `${letter}${i}`, label: `${letter}${SUB[i]}` }));

// Every row of the table: the a-switches then the b-switches, first slowest.
// Bit i of the sum goes to s_i.
function sumColumns(n: number, out = "s"): Record<string, string> {
  const cols: Record<string, string> = {};
  for (const i of indices(n + 1)) cols[`${out}${i}`] = "";
  for (let r = 0; r < 1 << (2 * n); r++) {
    const total = (r >> n) + (r & ((1 << n) - 1));
    for (const i of indices(n + 1)) cols[`${out}${i}`] += (total >> i) & 1 ? "1" : "0";
  }
  return cols;
}

const adder = (n: number, fewest?: number): AdderBuild => ({
  inputs: [...named("a", n), ...named("b", n)],
  outputs: named("s", n + 1),
  target: sumColumns(n),
  gates: PALETTE,
  grid: {
    rows: [
      [null, ...indices(n).map((i) => `a${i}`)],
      [{ text: "+" }, ...indices(n).map((i) => `b${i}`)],
    ],
    bulbs: indices(n + 1).map((i) => `s${i}`),
  },
  ...(fewest === undefined ? {} : { fewest }),
});

// 1. Two 1-bit numbers. 2. Two 2-bit numbers.
export const one = adder(1, 2);
export const two = adder(2, 7);

// 3. One bit more. The box adds the 2-bit number on its pins x₁, x₀ to the
// one on y₁, y₀ and shows the sum on z₂, z₁, z₀. One box, which must be used.
const boxCols = sumColumns(2, "z");
export const box2: AdderBox = {
  type: "adder2",
  title: "2-bit adder",
  inputs: ["x₁", "x₀", "y₁", "y₀"],
  outputs: ["z₂", "z₁", "z₀"],
  table: indices(3).map((i) => boxCols[`z${i}`]),
  gap: 2,
  max: 1,
  required: true,
};
export const stepUp = adder(3);
