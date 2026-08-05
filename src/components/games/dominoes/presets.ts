// ---------------------------------------------------------------------
//  Preset domino boards: the four demonstrations and the lab tasks.
// ---------------------------------------------------------------------
//
//  Every board here is authored as a picture. Legend (see model.ts):
//
//     .  empty     #  tile      O  out
//     A  input A   B  input B   P  power (a run that topples on its own)
//     ^ > v <      a knock, pointing up / right / down / left
//
//  Each demo and each task solution is checked against its intended
//  truth table by `verify.mjs`, which runs the simulation over all four
//  input rows. Do not hand-edit a board without re-running that script:
//  these gates depend on timing races, so moving a single tile can flip
//  a row silently.
// ---------------------------------------------------------------------

import { parseBoard, type Bit, type Board, type CellKind } from "./model";

export interface Demo {
  id: string;
  title: string;
  board: Board;
  /** Expected output on rows (0,0), (0,1), (1,0), (1,1). */
  table: Bit[];
  /** Which inputs the board actually reads — controls which knobs show. */
  inputs: Array<"A" | "B">;
  caption: string;
}

// --- 0. A plain run, close up ------------------------------------------

export const runDemo: Demo = {
  id: "run",
  title: "One run of dominoes",
  board: parseBoard(["A##############O"]),
  table: [0, 0, 1, 1],
  inputs: ["A"],
  caption:
    "Nothing logical here yet — just a line of tiles and a push at one end. Toppled means 1, still standing means 0, and everything on this page is built out of runs like this one.",
};

// --- 1. OR: two runs merging into one continuation ---------------------

export const orDemo: Demo = {
  id: "or",
  title: "OR — two runs, one continuation",
  board: parseBoard([
    "A####......",
    "....#......",
    "....#####O.",
    "....#......",
    "B####......",
  ]),
  table: [0, 1, 1, 1],
  inputs: ["A", "B"],
  caption:
    "Run two lines of dominoes into a single continuation. If the left line topples, the continuation topples. If the right line topples, the continuation topples. If neither does, nothing happens. That is the generous committee, in wood, with no current anywhere.",
};

// --- 2. The push-only wall ---------------------------------------------

export const pushOnlyDemo: Demo = {
  id: "push-only",
  title: "The wall — nothing happens when nothing arrives",
  board: parseBoard([
    "...#######...",
    "...#.....#...",
    "A###.....#...",
    "...#.....#...",
    "B###.....#...",
    "...#######...",
    ".........#O..",
  ]),
  table: [0, 1, 1, 1],
  inputs: ["A", "B"],
  caption:
    "A deliberately elaborate arrangement — loops, branches, a long way round. Set both inputs to 0 and press play: nothing moves, so the output is 0. That is true of every board on this page so far, and it is not an accident of the layout.",
};

// --- 3. NOT: a run that topples on its own, and a knock ----------------

export const notDemo: Demo = {
  id: "not",
  title: "NOT — a free run, knocked out of its own path",
  board: parseBoard([
    "P#######O",
    ".....^...",
    ".....#...",
    ".....A...",
  ]),
  table: [1, 1, 0, 0],
  inputs: ["A"],
  caption:
    "The top run topples on its own, whatever the input does. A's line ends in a tile laid sideways, which does not pass the fall on but ejects the tile above it. With A at 0 the free run reaches the output; with A at 1 the run arrives at a gap and stops. Notice what had to be brought in from outside to make a flipper: a signal that is 1 for free.",
};

// --- 4. AND, by way of De Morgan --------------------------------------

export const andDemo: Demo = {
  id: "and",
  title: "AND — a flipped B, blocking A",
  board: parseBoard([
    "...B...........",
    "...v...........",
    "P######........",
    "......#........",
    "......#........",
    "......#........",
    "#####.#........",
    "#...#.#........",
    "#...#.#........",
    "#...#.v........",
    "A...##########O",
  ]),
  table: [0, 0, 0, 1],
  inputs: ["A", "B"],
  caption:
    "The free run across the middle is a NOT gate for B, exactly as above. Its output travels down and ends in a knock that ejects a tile from A's path. So A gets through to the output only when B failed to be flipped — that is, only when B toppled. A's line takes the long way round the left for a reason: the block has to be in place before A's wave arrives.",
};

export const DEMOS: Demo[] = [runDemo, orDemo, pushOnlyDemo, notDemo, andDemo];

// --- lab tasks ---------------------------------------------------------

export interface Task {
  id: string;
  title: string;
  goal: string;
  /** Terminals and any given scenery; every non-empty cell is locked. */
  start: Board;
  /** Palette entries the student may place, besides the eraser. */
  palette: CellKind[];
  table: Bit[];
  inputs: Array<"A" | "B">;
  hint: string;
  /** A worked board that passes. Verified by verify.mjs. */
  solution: Board;
}

export const TASKS: Task[] = [
  {
    id: "task-or",
    title: "Task 1 — OR",
    goal: "Make the output topple when A topples, when B topples, and when both do. Leave it standing when neither does.",
    start: parseBoard([
      "A..........",
      "...........",
      ".........O.",
      "...........",
      "B..........",
    ]),
    palette: ["tile"],
    table: [0, 1, 1, 1],
    inputs: ["A", "B"],
    hint: "You need nothing but plain tiles. Run a line from each input and let the two lines meet.",
    solution: parseBoard([
      "A####......",
      "....#......",
      "....#####O.",
      "....#......",
      "B####......",
    ]),
  },
  {
    id: "task-and-not",
    title: "Task 2 — A and not B",
    goal: "Topple the output exactly when A topples and B does not.",
    start: parseBoard([
      "A..........",
      "...........",
      ".........O.",
      "...........",
      "B..........",
    ]),
    palette: ["tile", "knock"],
    table: [0, 0, 1, 0],
    inputs: ["A", "B"],
    hint: "A sideways tile does not pass the fall on — it ejects the tile it points at, leaving a gap. Have B's line end in one, aimed at a tile in A's path. Watch the timing: B has to get there first, so give A the longer walk.",
    solution: parseBoard([
      "A######....",
      "......#....",
      "......###O.",
      ".......^...",
      "B#######...",
    ]),
  },
  {
    id: "task-not",
    title: "Task 3 — NOT",
    goal: "Topple the output exactly when A does NOT topple. (B is unused here.)",
    start: parseBoard([
      "........O",
      ".........",
      ".........",
      ".....A...",
    ]),
    palette: ["tile", "knock", "power"],
    table: [1, 1, 0, 0],
    inputs: ["A"],
    hint: "Try it first with tiles and knocks alone, and watch what happens on the row where A is 0: nothing moves, so the output cannot be 1. The free run in the palette is the way out — and it is the only piece on this page that does something when no input arrives.",
    solution: parseBoard([
      "P#######O",
      ".....^...",
      ".....#...",
      ".....A...",
    ]),
  },
  {
    id: "task-and",
    title: "Task 4 — AND",
    goal: "Topple the output exactly when A and B both topple. This is the hard one.",
    start: parseBoard([
      "...B...........",
      "...............",
      "...............",
      "...............",
      "...............",
      "...............",
      "...............",
      "...............",
      "...............",
      "...............",
      "A.............O",
    ]),
    palette: ["tile", "knock", "power"],
    table: [0, 0, 0, 1],
    inputs: ["A", "B"],
    hint: "Build a NOT for B out of a free run, as in Task 3. Then use its output the way Task 2 used B: a knock that ejects a tile from A's path. A gets through only when B's flip failed, which is exactly when B toppled. Give A a long detour so the block lands in time.",
    solution: parseBoard([
      "...B...........",
      "...v...........",
      "P######........",
      "......#........",
      "......#........",
      "......#........",
      "#####.#........",
      "#...#.#........",
      "#...#.#........",
      "#...#.v........",
      "A...##########O",
    ]),
  },
];

/** Cells the student may not edit: everything given in the start board. */
export function lockedMask(task: Task): boolean[] {
  return task.start.cells.map((c) => c.kind !== "empty");
}
