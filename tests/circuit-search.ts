// Exhaustive search for the smallest circuit, for tests of build problems.
// Not a test file itself (the npm test glob is tests/*.test.ts).
//
// Use it to prove that a CircuitBuilder problem can be done within its gate
// limit, and that the limit is not loose:
//   assert.equal(fewestGates(["a", "b"], ["1000"], ["NOT", "AND", "OR"], 3), 2);
// Gates have two inputs (NOT one). Outputs may also be wired straight from a
// switch. Every circuit up to `limit` gates is tried, so keep limit small
// (5 is fine for 4 switches and 2 gate types; it grows fast after that).

import type { GateType } from "../src/components/games/circuits/model.ts";

// The smallest number of gates from `palette` (two inputs each, NOT one) that
// produces every target column, by trying every circuit up to `limit` gates.
// A truth table is held as a bitmask over the rows. Returns Infinity if none.
export function fewestGates(inputs: string[], targets: string[], palette: GateType[], limit: number): number {
  const n = inputs.length, R = 1 << n, FULL = R === 32 ? 0xffffffff : (1 << R) - 1;
  const maskOf = (col: string) => [...col].reduce((m, ch, r) => (ch === "1" ? m | (1 << r) : m), 0) >>> 0;
  const want = targets.map(maskOf);
  const base = inputs.map((_, i) => { let m = 0; for (let r = 0; r < R; r++) if ((r >> (n - 1 - i)) & 1) m |= 1 << r; return m >>> 0; });
  const op = (t: GateType, a: number, b: number) => {
    switch (t) {
      case "NOT": return (~a & FULL) >>> 0;
      case "AND": return (a & b) >>> 0;
      case "OR": return (a | b) >>> 0;
      case "XOR": return (a ^ b) >>> 0;
      case "NAND": return (~(a & b) & FULL) >>> 0;
      case "NOR": return (~(a | b) & FULL) >>> 0;
    }
  };
  let best = Infinity;
  const dfs = (nodes: number[], used: number) => {
    if (want.every((w) => nodes.includes(w))) { best = Math.min(best, used); return; }
    if (used >= limit || used + 1 >= best) return;
    for (const t of palette) {
      for (let i = 0; i < nodes.length; i++) {
        if (t === "NOT") { dfs([...nodes, op(t, nodes[i], 0)], used + 1); continue; }
        for (let j = i; j < nodes.length; j++) dfs([...nodes, op(t, nodes[i], nodes[j])], used + 1);
      }
    }
  };
  dfs(base, 0);
  return best;
}

