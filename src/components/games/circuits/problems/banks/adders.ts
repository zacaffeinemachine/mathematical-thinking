// Switches, bulbs, targets and the sealed adder box for logic-gates/adders.mdx
// ("Adding Numbers"): circuits that add two numbers of 1, 2 and 3 bits, and
// a 3-bit adder built from a box that adds 2-bit numbers.
//
// A number of n bits sits on n switches worth 2^(n-1), ..., 4, 2, 1. Switch
// ids carry the letter and the worth (a4, a2, a1), labels use subscripts
// (a₄, a₂, a₁). The sum sits on n + 1 bulbs labelled with their worth.
//
// tests/circuit-adders.test.ts rebuilds every target and the box's table from
// the rule as the page words it, and proves the two `fewest` counts by
// searching every smaller circuit. The 3-bit problems have six switches, too
// many for the search (its tables are 32-bit masks), so they carry no
// `fewest`. No solution circuit is written down anywhere.

import type { GateType } from "../../model.ts";

export interface AdderBuild {
  inputs: { id: string; label: string }[];
  outputs: { id: string; label: string }[];
  target: Record<string, string>;
  gates: GateType[];
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
const SUB: Record<number, string> = { 1: "₁", 2: "₂", 4: "₄", 8: "₈" };

// Worths of an n-bit number, most valuable first: 3 -> [4, 2, 1].
export const worths = (n: number) => Array.from({ length: n }, (_, i) => 2 ** (n - 1 - i));

const switches = (letter: string, n: number) => worths(n).map((w) => ({ id: `${letter}${w}`, label: `${letter}${SUB[w]}` }));
const sumBulbs = (n: number) => worths(n + 1).map((w) => ({ id: `s${w}`, label: String(w) }));

// Every row of the table: the a-switches then the b-switches, first slowest.
function sumColumns(n: number): Record<string, string> {
  const cols: Record<string, string> = {};
  for (const w of worths(n + 1)) cols[`s${w}`] = "";
  for (let r = 0; r < 1 << (2 * n); r++) {
    const total = (r >> n) + (r & ((1 << n) - 1));
    for (const w of worths(n + 1)) cols[`s${w}`] += total & w ? "1" : "0";
  }
  return cols;
}

const adder = (n: number, fewest?: number): AdderBuild => ({
  inputs: [...switches("a", n), ...switches("b", n)],
  outputs: sumBulbs(n),
  target: sumColumns(n),
  gates: PALETTE,
  ...(fewest === undefined ? {} : { fewest }),
});

// 1. Two 1-bit numbers. 2. Two 2-bit numbers. 3. Two 3-bit numbers.
export const one = adder(1, 2);
export const two = adder(2, 7);
export const three = adder(3);

// 4. One step up. The box adds two 2-bit numbers: the top two pins take the
// first number and the bottom two the second, each labelled with its worth,
// and the sum comes out on pins worth 4, 2 and 1. One box, which must be used.
const boxCols = sumColumns(2);
export const box2: AdderBox = {
  type: "adder2",
  title: "2-bit adder",
  inputs: ["2", "1", "2", "1"],
  outputs: ["4", "2", "1"],
  table: worths(3).map((w) => boxCols[`s${w}`]),
  gap: 2,
  max: 1,
  required: true,
};
export const stepUp = adder(3);
