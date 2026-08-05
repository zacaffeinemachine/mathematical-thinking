// ---------------------------------------------------------------------
//  Domino logic — the board model and its simulation.
// ---------------------------------------------------------------------
//
//  A board is a grid of cells. A wave of toppling spreads from the
//  sources, one cell per tick, through orthogonally adjacent cells.
//  Everything the student can build is made from five cell kinds:
//
//    tile   a standing domino; topples when a neighbour topples, and
//           passes the fall on to its own neighbours
//    srcA   the A input; topples at tick 0 exactly when A is 1
//    srcB   the B input; topples at tick 0 exactly when B is 1
//    power  a run that topples at tick 0 no matter what the inputs do.
//           This is the "1 for free" — the only way to get a 1 out of a
//           board whose inputs are both 0
//    knock  a tile laid so that it falls SIDEWAYS. It does not pass the
//           fall on. Instead it ejects the cell it points at, removing
//           it from the board. A run whose tile has been ejected stops
//           dead at the gap
//    out    the output sensor. The board's output is 1 exactly when this
//           cell topples
//
//  Ejection is a race, and that is the point rather than a defect: a
//  knock only saves a cell if it fires BEFORE the wave gets there. Path
//  lengths decide who wins, so a working gate has to be timed as well as
//  wired.
// ---------------------------------------------------------------------

export type Dir = "up" | "down" | "left" | "right";

export type CellKind =
  | "empty"
  | "tile"
  | "srcA"
  | "srcB"
  | "power"
  | "knock"
  | "out";

export interface Cell {
  kind: CellKind;
  /** Only meaningful when kind === "knock": which neighbour it ejects. */
  dir?: Dir;
}

export interface Board {
  width: number;
  height: number;
  /** Row-major, length width * height. */
  cells: Cell[];
}

export type Bit = 0 | 1;

export const DIRS: Record<Dir, { dx: number; dy: number }> = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const DIR_ORDER: Dir[] = ["up", "right", "down", "left"];

// --- construction ------------------------------------------------------

export function emptyBoard(width: number, height: number): Board {
  return {
    width,
    height,
    cells: Array.from({ length: width * height }, () => ({
      kind: "empty" as CellKind,
    })),
  };
}

export function idx(b: Board, x: number, y: number): number {
  return y * b.width + x;
}

export function inBounds(b: Board, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < b.width && y < b.height;
}

export function cellAt(b: Board, x: number, y: number): Cell {
  return b.cells[idx(b, x, y)] ?? { kind: "empty" };
}

export function withCell(b: Board, x: number, y: number, cell: Cell): Board {
  if (!inBounds(b, x, y)) return b;
  const cells = b.cells.slice();
  cells[idx(b, x, y)] = cell;
  return { ...b, cells };
}

/**
 * Parse a board from an array of equal-length strings. One character per
 * cell — this is how every preset board in `presets.ts` is authored, so
 * the layout is legible in the source.
 *
 *   .  empty        #  tile         O  out
 *   A  input A      B  input B      P  power (self-starting run)
 *   ^ > v <  a knock, pointing up / right / down / left
 */
export function parseBoard(rows: string[]): Board {
  const height = rows.length;
  const width = height === 0 ? 0 : rows[0].length;
  for (const r of rows) {
    if (r.length !== width) {
      throw new Error(
        `parseBoard: ragged rows — expected width ${width}, got ${r.length} in "${r}"`,
      );
    }
  }
  const cells: Cell[] = [];
  for (const row of rows) {
    for (const ch of row) {
      switch (ch) {
        case ".": cells.push({ kind: "empty" }); break;
        case "#": cells.push({ kind: "tile" }); break;
        case "A": cells.push({ kind: "srcA" }); break;
        case "B": cells.push({ kind: "srcB" }); break;
        case "P": cells.push({ kind: "power" }); break;
        case "O": cells.push({ kind: "out" }); break;
        case "^": cells.push({ kind: "knock", dir: "up" }); break;
        case ">": cells.push({ kind: "knock", dir: "right" }); break;
        case "v": cells.push({ kind: "knock", dir: "down" }); break;
        case "<": cells.push({ kind: "knock", dir: "left" }); break;
        default:
          throw new Error(`parseBoard: unknown character "${ch}"`);
      }
    }
  }
  return { width, height, cells };
}

// --- simulation --------------------------------------------------------

export interface SimResult {
  /** Tick at which each cell toppled, or -1 if it never did. */
  toppledAt: number[];
  /** Tick at which each cell was ejected, or -1 if it never was. */
  ejectedAt: number[];
  /** Output bit: 1 iff some `out` cell toppled. */
  out: Bit;
  /** Last tick on which anything happened. */
  lastTick: number;
}

/** A cell that a wave can knock over. Sources topple on their own terms. */
function isToppleable(kind: CellKind): boolean {
  return kind === "tile" || kind === "knock" || kind === "out";
}

/** A cell that passes the fall on. A knock falls sideways, so it does not. */
function propagates(kind: CellKind): boolean {
  return (
    kind === "tile" ||
    kind === "out" ||
    kind === "srcA" ||
    kind === "srcB" ||
    kind === "power"
  );
}

/** Sources may not be ejected — you cannot knock away an input. */
function isEjectable(kind: CellKind): boolean {
  return isToppleable(kind);
}

/**
 * Run the board to completion for one assignment of the inputs.
 *
 * One tick per cell of travel. Within a tick, every knock that toppled
 * fires BEFORE the next tick's topples are computed, so a knock landing
 * on tick t saves its target from a wave that would have arrived at
 * t + 1 — but not from one that already arrived at t or earlier.
 */
export function simulate(board: Board, a: Bit, b: Bit): SimResult {
  const n = board.cells.length;
  const toppledAt = new Array<number>(n).fill(-1);
  const ejectedAt = new Array<number>(n).fill(-1);

  let frontier: number[] = [];
  board.cells.forEach((cell, i) => {
    const fires =
      cell.kind === "power" ||
      (cell.kind === "srcA" && a === 1) ||
      (cell.kind === "srcB" && b === 1);
    if (fires) {
      toppledAt[i] = 0;
      frontier.push(i);
    }
  });

  let tick = 0;
  let lastTick = frontier.length > 0 ? 0 : -1;
  // width * height is a hard bound on how long a wave can travel.
  const maxTicks = n + 2;

  while (frontier.length > 0 && tick < maxTicks) {
    // 1. Every knock that toppled on this tick ejects its target.
    for (const i of frontier) {
      const cell = board.cells[i];
      if (cell.kind !== "knock" || !cell.dir) continue;
      const x = i % board.width;
      const y = Math.floor(i / board.width);
      const { dx, dy } = DIRS[cell.dir];
      const tx = x + dx;
      const ty = y + dy;
      if (!inBounds(board, tx, ty)) continue;
      const t = idx(board, tx, ty);
      // Too late if it has already gone over; sources cannot be ejected.
      if (toppledAt[t] !== -1) continue;
      if (!isEjectable(board.cells[t].kind)) continue;
      if (ejectedAt[t] === -1) ejectedAt[t] = tick;
    }

    // 2. Then the wave advances one cell.
    const next: number[] = [];
    for (const i of frontier) {
      if (!propagates(board.cells[i].kind)) continue;
      const x = i % board.width;
      const y = Math.floor(i / board.width);
      for (const d of DIR_ORDER) {
        const { dx, dy } = DIRS[d];
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(board, nx, ny)) continue;
        const j = idx(board, nx, ny);
        if (toppledAt[j] !== -1 || ejectedAt[j] !== -1) continue;
        if (!isToppleable(board.cells[j].kind)) continue;
        toppledAt[j] = tick + 1;
        next.push(j);
      }
    }

    if (next.length > 0) lastTick = tick + 1;
    frontier = next;
    tick += 1;
  }

  let out: Bit = 0;
  board.cells.forEach((cell, i) => {
    if (cell.kind === "out" && toppledAt[i] !== -1) out = 1;
  });

  return { toppledAt, ejectedAt, out, lastTick: Math.max(lastTick, 0) };
}

/** The board's full behaviour: output on each of the four input rows. */
export function truthTable(board: Board): Bit[] {
  const rows: Array<[Bit, Bit]> = [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
  ];
  return rows.map(([a, b]) => simulate(board, a, b).out);
}

export const ROW_LABELS: Array<[Bit, Bit]> = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];

/** True when the board realises the wanted table on all four rows. */
export function matchesTable(board: Board, want: Bit[]): boolean {
  const got = truthTable(board);
  return got.every((v, i) => v === want[i]);
}

/** Does this board contain a self-starting run? */
export function usesPower(board: Board): boolean {
  return board.cells.some((c) => c.kind === "power");
}

export function countKind(board: Board, kind: CellKind): number {
  return board.cells.filter((c) => c.kind === kind).length;
}
