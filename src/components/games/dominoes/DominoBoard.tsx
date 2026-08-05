import { useMemo } from "react";
import {
  DIRS,
  DIR_ORDER,
  cellAt,
  idx,
  inBounds,
  type Board,
  type Cell,
  type Dir,
  type SimResult,
} from "./model";

// ---------------------------------------------------------------------
//  Drawing model — oblique (cabinet) projection
// ---------------------------------------------------------------------
//
//  Three world axes, projected onto the screen:
//
//     grid x  ->  (CW,  0)     across the page
//     grid y  ->  (SX, CH)     into the page: down and to the right
//     height  ->  (0,  -1)     straight up
//
//  The shear on the depth axis is not decoration. Without it, a tile in a
//  left-to-right run has its width along the depth axis and its height
//  along the vertical, both of which project to screen-vertical — so the
//  tile collapses to a zero-width sliver. Shearing depth is what lets a
//  domino be a solid object with a visible face whichever way its run
//  points.
//
//  A domino is a quad: a base segment lying on the ground across the run,
//  and that segment translated by an "up" vector that swings from
//  straight up (standing) to flat along the fall direction (fallen). One
//  unit of world length is cellPx on screen in x and in height, so the
//  vertical and horizontal scales agree.
//
//  Cells carry SUB dominoes strung along the run rather than one, because
//  a run only reads as a run when the tiles are closer together than they
//  are tall. Their fall times are staggered across the tick so the
//  cascade rolls instead of snapping cell to cell. Everything is painted
//  back row to front row, so nearer tiles occlude farther ones.
// ---------------------------------------------------------------------

const SUB = 3;            // dominoes per cell, along the run
const CH_FRAC = 0.46;     // depth axis: vertical component
const SX_FRAC = 0.40;     // depth axis: horizontal shear
const H_G = 0.55;         // domino height, in cells
const W_G = 0.55;         // domino width across the run, in cells
const FALL_TICKS = 0.85;  // how long one tile takes to go over
const THICK_G = 0.10;     // domino thickness, for the top face

export interface DominoBoardProps {
  board: Board;
  sim: SimResult | null;
  /** Continuous time, in ticks. Fractional — see useClock. */
  time: number;
  cellPx?: number;
  locked?: boolean[];
  onCellClick?: (x: number, y: number) => void;
  onCellDrag?: (x: number, y: number) => void;
  showGrid?: boolean;
  ariaLabel?: string;
}

function isPiece(c: Cell): boolean {
  return c.kind !== "empty";
}

function orientation(
  board: Board,
  sim: SimResult | null,
  i: number,
): { axis: "x" | "y"; fall: Dir } {
  const x = i % board.width;
  const y = Math.floor(i / board.width);

  if (sim) {
    const t = sim.toppledAt[i];
    if (t > 0) {
      for (const d of DIR_ORDER) {
        const { dx, dy } = DIRS[d];
        if (!inBounds(board, x + dx, y + dy)) continue;
        if (sim.toppledAt[idx(board, x + dx, y + dy)] === t - 1) {
          // Pushed from d, so it falls the opposite way.
          const fall: Dir =
            d === "left" ? "right" : d === "right" ? "left" : d === "up" ? "down" : "up";
          return { axis: dx !== 0 ? "x" : "y", fall };
        }
      }
    }
  }

  const cell = board.cells[i];
  if (cell.kind === "knock" && cell.dir) {
    return { axis: DIRS[cell.dir].dx !== 0 ? "x" : "y", fall: cell.dir };
  }

  const horiz =
    (inBounds(board, x - 1, y) && isPiece(cellAt(board, x - 1, y))) ||
    (inBounds(board, x + 1, y) && isPiece(cellAt(board, x + 1, y)));
  return horiz ? { axis: "x", fall: "right" } : { axis: "y", fall: "down" };
}

export default function DominoBoard({
  board,
  sim,
  time,
  cellPx = 30,
  locked,
  onCellClick,
  onCellDrag,
  showGrid = false,
  ariaLabel,
}: DominoBoardProps) {
  const CW = cellPx;
  const CH = cellPx * CH_FRAC;
  const SX = cellPx * SX_FRAC;
  const TOP_PAD = H_G * cellPx + 6;

  // Grid vector -> screen vector.
  const gv = (vx: number, vy: number): [number, number] => [
    vx * CW + vy * SX,
    vy * CH,
  ];
  // Grid point (cell centre) -> screen point.
  const gp = (gx: number, gy: number): [number, number] => {
    const [sx, sy] = gv(gx + 0.5, gy + 0.5);
    return [sx, sy + TOP_PAD];
  };

  const W = board.width * CW + board.height * SX;
  const HEIGHT = board.height * CH + TOP_PAD + 4;
  const interactive = Boolean(onCellClick);

  const orients = useMemo(
    () => board.cells.map((_, i) => orientation(board, sim, i)),
    [board, sim],
  );

  const groundQuad = (gx: number, gy: number): string =>
    [
      gp(gx - 0.5, gy - 0.5),
      gp(gx + 0.5, gy - 0.5),
      gp(gx + 0.5, gy + 0.5),
      gp(gx - 0.5, gy + 0.5),
    ]
      .map(([sx, sy]) => `${sx.toFixed(2)},${sy.toFixed(2)}`)
      .join(" ");

  const layers: React.ReactNode[] = [];
  const hits: React.ReactNode[] = [];

  // --- ground: the editing grid --------------------------------------
  if (showGrid) {
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const i = idx(board, x, y);
        layers.push(
          <polygon
            key={`g${i}`}
            points={groundQuad(x, y)}
            fill={locked?.[i] ? "var(--accent-soft)" : "transparent"}
            stroke="var(--dom-grid)"
            strokeWidth={1}
          />,
        );
      }
    }
  }

  // --- pieces, back to front -----------------------------------------
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const i = idx(board, x, y);
      const cell = cellAt(board, x, y);
      if (cell.kind === "empty") continue;

      const [cx, cy] = gp(x, y);
      const toppled = sim ? sim.toppledAt[i] : -1;
      const ejected = sim ? sim.ejectedAt[i] : -1;
      const gone = ejected !== -1 && time >= ejected;

      // Terminals sit flat on the ground so they do not fight the tiles.
      if (cell.kind === "srcA" || cell.kind === "srcB" || cell.kind === "power") {
        const lit = toppled !== -1 && time >= toppled;
        const label = cell.kind === "srcA" ? "A" : cell.kind === "srcB" ? "B" : "1";
        layers.push(
          <g key={`s${i}`}>
            <ellipse
              cx={cx}
              cy={cy}
              rx={CW * 0.36}
              ry={CH * 0.62}
              fill={lit ? "var(--dom-front)" : "var(--surface)"}
              stroke={lit ? "var(--dom-front)" : "var(--gate-wire-off)"}
              strokeWidth={1.6}
            />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.max(9, CW * 0.34)}
              fontFamily="ui-monospace, monospace"
              fontWeight={700}
              fill={lit ? "#fff" : "var(--ink)"}
            >
              {label}
            </text>
          </g>,
        );
        continue;
      }

      if (cell.kind === "out") {
        const lit = toppled !== -1 && time >= toppled;
        layers.push(
          <g key={`o${i}`}>
            <ellipse
              cx={cx}
              cy={cy}
              rx={CW * 0.36}
              ry={CH * 0.62}
              fill={lit ? "var(--dom-front)" : "transparent"}
              stroke={lit ? "var(--dom-front)" : "var(--gate-wire-off)"}
              strokeWidth={1.6}
              strokeDasharray={lit ? undefined : "3 3"}
            />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={Math.max(8, CW * 0.3)}
              fontFamily="ui-monospace, monospace"
              fontWeight={700}
              fill={lit ? "#fff" : "var(--muted)"}
            >
              {lit ? "1" : "0"}
            </text>
          </g>,
        );
        continue;
      }

      // --- tile or knock: SUB dominoes strung along the run ----------
      const { axis, fall } = orients[i];
      const isKnock = cell.kind === "knock";
      // Unit vectors in grid space.
      const eRun = axis === "x" ? [1, 0] : [0, 1];
      const eAcross = axis === "x" ? [0, 1] : [1, 0];
      const eFall = [DIRS[fall].dx, DIRS[fall].dy];

      const across = gv(eAcross[0] * (W_G / 2), eAcross[1] * (W_G / 2));
      const fallScreen = gv(eFall[0], eFall[1]);

      if (gone) {
        for (let k = 0; k < SUB; k++) {
          const t = (k - (SUB - 1) / 2) / SUB;
          const [bx, by] = [cx + gv(eRun[0] * t, eRun[1] * t)[0], cy + gv(eRun[0] * t, eRun[1] * t)[1]];
          layers.push(
            <line
              key={`e${i}-${k}`}
              x1={bx - across[0]}
              y1={by - across[1]}
              x2={bx + across[0]}
              y2={by + across[1]}
              stroke="var(--dom-gap)"
              strokeWidth={1.4}
              strokeDasharray="2 2"
            />,
          );
        }
        continue;
      }

      for (let k = 0; k < SUB; k++) {
        const t = (k - (SUB - 1) / 2) / SUB;
        const shift = gv(eRun[0] * t, eRun[1] * t);
        const bx = cx + shift[0];
        const by = cy + shift[1];

        // Stagger sub-dominoes across the tick so the wave rolls.
        const start = toppled === -1 ? Infinity : toppled + k / SUB;
        const theta =
          start === Infinity
            ? 0
            : Math.max(0, Math.min(1, (time - start) / FALL_TICKS));
        const ang = (theta * Math.PI) / 2;

        // Up vector: straight up when standing, flat along the fall when down.
        const ux = fallScreen[0] * H_G * Math.sin(ang);
        const uy = fallScreen[1] * H_G * Math.sin(ang) - H_G * cellPx * Math.cos(ang);

        const p1: [number, number] = [bx - across[0], by - across[1]];
        const p2: [number, number] = [bx + across[0], by + across[1]];
        const p3: [number, number] = [p2[0] + ux, p2[1] + uy];
        const p4: [number, number] = [p1[0] + ux, p1[1] + uy];

        const face = [p1, p2, p3, p4]
          .map(([sx, sy]) => `${sx.toFixed(2)},${sy.toFixed(2)}`)
          .join(" ");

        // Top face: the far side of the tile's thickness, which gives the
        // slab some depth and keeps overlapping fallen tiles distinct.
        const tx = fallScreen[0] * THICK_G * Math.cos(ang);
        const ty = fallScreen[1] * THICK_G * Math.cos(ang) + THICK_G * cellPx * Math.sin(ang);
        const top = [p4, p3, [p3[0] + tx, p3[1] + ty], [p4[0] + tx, p4[1] + ty]]
          .map(([sx, sy]) => `${sx.toFixed(2)},${sy.toFixed(2)}`)
          .join(" ");

        const moving = theta > 0 && theta < 1;
        const base = isKnock
          ? theta > 0
            ? "var(--dom-front)"
            : "var(--gate-wire-off)"
          : theta === 0
            ? "var(--dom-standing)"
            : moving
              ? "var(--dom-front)"
              : "var(--dom-fallen)";

        layers.push(
          <g key={`t${i}-${k}`}>
            <polygon
              points={top}
              fill={base}
              stroke="var(--dom-board)"
              strokeWidth={0.5}
              strokeLinejoin="round"
              opacity={0.55}
            />
            <polygon
              points={face}
              fill={base}
              stroke="var(--dom-board)"
              strokeWidth={0.7}
              strokeLinejoin="round"
            />
          </g>,
        );
      }

      // A knock's aim, marked flat on the ground.
      if (isKnock && cell.dir) {
        const tip = gv(eFall[0] * 0.5, eFall[1] * 0.5);
        const back = gv(eFall[0] * 0.16, eFall[1] * 0.16);
        layers.push(
          <line
            key={`ka${i}`}
            x1={cx + back[0]}
            y1={cy + back[1]}
            x2={cx + tip[0]}
            y2={cy + tip[1]}
            stroke="var(--dom-front)"
            strokeWidth={1.4}
            markerEnd="url(#dom-arrow)"
            opacity={0.9}
          />,
        );
      }
    }
  }

  if (interactive) {
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const i = idx(board, x, y);
        hits.push(
          <polygon
            key={`h${i}`}
            points={groundQuad(x, y)}
            fill="transparent"
            style={{ cursor: locked?.[i] ? "not-allowed" : "pointer" }}
            onPointerDown={(e) => {
              e.preventDefault();
              onCellClick?.(x, y);
            }}
            onPointerEnter={(e) => {
              if (e.buttons === 1) onCellDrag?.(x, y);
            }}
          />,
        );
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${HEIGHT}`}
      width="100%"
      style={{
        maxWidth: W,
        height: "auto",
        display: "block",
        margin: "0 auto",
        background: "var(--dom-board)",
        border: "1px solid var(--rule)",
        borderRadius: 6,
        touchAction: "manipulation",
      }}
      role="img"
      aria-label={ariaLabel ?? "domino board"}
    >
      <defs>
        <marker
          id="dom-arrow"
          markerWidth="5"
          markerHeight="5"
          refX="4"
          refY="2.5"
          orient="auto"
        >
          <path d="M0,0 L5,2.5 L0,5 Z" fill="var(--dom-front)" />
        </marker>
      </defs>
      {layers}
      {hits}
    </svg>
  );
}
