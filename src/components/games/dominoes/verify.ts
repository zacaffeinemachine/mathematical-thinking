// ---------------------------------------------------------------------
//  Exhaustive check of every preset board on this page.
// ---------------------------------------------------------------------
//
//  These gates work by timing races — a knock only blocks a run if it
//  fires before the wave arrives. Moving one tile can flip one row of
//  one truth table with no other visible effect, so every demo board and
//  every task solution is run over all four input rows here.
//
//  Run it from Site/:
//
//    npx tsc src/components/games/dominoes/{model,presets,verify}.ts \
//        --outDir /tmp/dominoverify --module esnext --target es2022 \
//        --moduleResolution bundler
//    node /tmp/dominoverify/verify.js
//
//  Exits non-zero if anything disagrees with its intended table.
// ---------------------------------------------------------------------

import { simulate, truthTable, type Bit, type Board } from "./model";
import { DEMOS, TASKS, lockedMask } from "./presets";

const ROWS: Array<[Bit, Bit]> = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];

let failures = 0;

function show(t: Bit[]): string {
  return t.join("");
}

function checkTable(label: string, board: Board, want: Bit[]): void {
  const got = truthTable(board);
  if (show(got) === show(want)) {
    console.log(`  ok    ${label}  table=${show(got)}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL  ${label}  want=${show(want)} got=${show(got)}`);
  ROWS.forEach(([a, b], i) => {
    if (got[i] !== want[i]) {
      console.log(`          row A=${a} B=${b}: want ${want[i]}, got ${got[i]}`);
    }
  });
}

/** A board whose output never topples on any row is almost certainly a
 *  wiring mistake rather than an intended constant-0 gate. */
function checkReachability(label: string, board: Board): void {
  const anyOut = ROWS.some(([a, b]) => simulate(board, a, b).out === 1);
  if (!anyOut) {
    failures += 1;
    console.log(`  FAIL  ${label}: output never topples on any input row`);
  }
}

console.log("demos");
for (const d of DEMOS) {
  checkTable(d.id, d.board, d.table);
  checkReachability(d.id, d.board);
}

console.log("task solutions");
for (const t of TASKS) {
  checkTable(t.id, t.solution, t.table);
  checkReachability(t.id, t.solution);

  // The solution must be reachable from the start board: same size, and
  // every locked cell must survive unchanged.
  const locked = lockedMask(t);
  if (
    t.solution.width !== t.start.width ||
    t.solution.height !== t.start.height
  ) {
    failures += 1;
    console.log(`  FAIL  ${t.id}: solution board is a different size`);
    continue;
  }
  const clobbered = locked.some(
    (isLocked, i) =>
      isLocked &&
      (t.solution.cells[i].kind !== t.start.cells[i].kind ||
        t.solution.cells[i].dir !== t.start.cells[i].dir),
  );
  if (clobbered) {
    failures += 1;
    console.log(`  FAIL  ${t.id}: solution moves a locked terminal`);
  } else {
    console.log(`  ok    ${t.id} solution keeps every locked cell`);
  }

  // The palette must be enough to build the solution.
  const allowed = new Set<string>([...t.palette, "empty"]);
  const needed = new Set<string>();
  t.solution.cells.forEach((c, i) => {
    if (!locked[i] && c.kind !== "empty") needed.add(c.kind);
  });
  const missing = [...needed].filter((k) => !allowed.has(k));
  if (missing.length > 0) {
    failures += 1;
    console.log(`  FAIL  ${t.id}: solution needs ${missing.join(", ")}, not in palette`);
  } else {
    console.log(`  ok    ${t.id} solution stays inside its palette`);
  }
}

console.log(failures === 0 ? "\nall boards verified" : `\n${failures} failure(s)`);
if (failures > 0) throw new Error(`${failures} board(s) failed verification`);
