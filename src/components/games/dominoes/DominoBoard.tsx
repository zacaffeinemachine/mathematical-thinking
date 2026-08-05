import { useMemo } from "react";
import {
  DIRS,
  DIR_ORDER,
  cellAt,
  idx,
  inBounds,
  type Board,
  type Dir,
  type SimResult,
} from "./model";

// A tile is drawn twice as tall as it is wide when standing, and the same
// rectangle laid flat when fallen — the fall pivots about its base edge,
// the way a real domino does.
const TILE_W = 0.30; // fraction of a cell
const TILE_H = 0.66;

export interface DominoBoardProps {
  board: Board;
  /** Null before a run starts: everything renders standing. */
  sim: SimResult | null;
  /** How far through the run we are. */
  tick: number;
  cellPx?: number;
  /** Cells the student may not edit; drawn with a faint lock tint. */
  locked?: boolean[];
  onCellClick?: (x: number, y: number) => void;
  onCellDrag?: (x: number, y: number) => void;
  /** Draw the faint editing grid. Off for the read-only demos. */
  showGrid?: boolean;
  ariaLabel?: string;
}

/**
 * Which way did this tile fall? Whichever neighbour toppled exactly one
 * tick earlier pushed it, so the tile lies along that axis. Falling back
 * to "right" keeps sources and orphans from looking broken.
 */
function fallAxis(
  board: Board,
  sim: SimResult | null,
  i: number,
): "h" | "v" {
  if (!sim) return "h";
  const t = sim.toppledAt[i];
  if (t <= 0) return "h";
  const x = i % board.width;
  const y = Math.floor(i / board.width);
  for (const d of DIR_ORDER) {
    const { dx, dy } = DIRS[d];
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(board, nx, ny)) continue;
    if (sim.toppledAt[idx(board, nx, ny)] === t - 1) {
      return d === "left" || d === "right" ? "h" : "v";
    }
  }
  return "h";
}

function arrowPath(dir: Dir, cx: number, cy: number, r: number): string {
  const { dx, dy } = DIRS[dir];
  const tipX = cx + dx * r;
  const tipY = cy + dy * r;
  // Perpendicular for the barbs.
  const px = -dy;
  const py = dx;
  const backX = cx + dx * r * 0.1;
  const backY = cy + dy * r * 0.1;
  const b1x = backX + px * r * 0.55;
  const b1y = backY + py * r * 0.55;
  const b2x = backX - px * r * 0.55;
  const b2y = backY - py * r * 0.55;
  return `M ${tipX} ${tipY} L ${b1x} ${b1y} L ${b2x} ${b2y} Z`;
}

export default function DominoBoard({
  board,
  sim,
  tick,
  cellPx = 30,
  locked,
  onCellClick,
  onCellDrag,
  showGrid = false,
  ariaLabel,
}: DominoBoardProps) {
  const W = board.width * cellPx;
  const H = board.height * cellPx;
  const interactive = Boolean(onCellClick);

  const axes = useMemo(
    () => board.cells.map((_, i) => fallAxis(board, sim, i)),
    [board, sim],
  );

  function statusOf(i: number): "standing" | "fallen" | "gap" | "front" {
    if (!sim) return "standing";
    const ej = sim.ejectedAt[i];
    const tp = sim.toppledAt[i];
    if (tp !== -1 && tp <= tick) return tp === tick ? "front" : "fallen";
    if (ej !== -1 && ej <= tick) return "gap";
    return "standing";
  }

  const cellsOut: React.ReactNode[] = [];

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const i = idx(board, x, y);
      const cell = cellAt(board, x, y);
      const cx = x * cellPx + cellPx / 2;
      const cy = y * cellPx + cellPx / 2;
      const st = statusOf(i);
      const isLocked = locked?.[i] ?? false;
      const key = `${x}-${y}`;

      // Editing grid + hit target.
      if (showGrid) {
        cellsOut.push(
          <rect
            key={`g${key}`}
            x={x * cellPx}
            y={y * cellPx}
            width={cellPx}
            height={cellPx}
            fill={isLocked ? "var(--accent-soft)" : "transparent"}
            stroke="var(--dom-grid)"
            strokeWidth={1}
          />,
        );
      }

      if (cell.kind === "empty") {
        // nothing to draw; the hit rect below still catches clicks
      } else if (cell.kind === "srcA" || cell.kind === "srcB" || cell.kind === "power") {
        const label = cell.kind === "srcA" ? "A" : cell.kind === "srcB" ? "B" : "1";
        const lit = st === "fallen" || st === "front";
        cellsOut.push(
          <g key={`s${key}`}>
            <circle
              cx={cx}
              cy={cy}
              r={cellPx * 0.36}
              fill={lit ? "var(--dom-front)" : "var(--surface)"}
              stroke={lit ? "var(--dom-front)" : "var(--gate-wire-off)"}
              strokeWidth={2}
            />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={cellPx * 0.42}
              fontFamily="ui-monospace, monospace"
              fontWeight={700}
              fill={lit ? "#fff" : "var(--ink)"}
            >
              {label}
            </text>
          </g>,
        );
      } else if (cell.kind === "out") {
        const lit = st === "fallen" || st === "front";
        cellsOut.push(
          <g key={`o${key}`}>
            <circle
              cx={cx}
              cy={cy}
              r={cellPx * 0.36}
              fill={lit ? "var(--dom-front)" : "transparent"}
              stroke={lit ? "var(--dom-front)" : "var(--gate-wire-off)"}
              strokeWidth={2}
              strokeDasharray={lit ? undefined : "3 3"}
            />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={cellPx * 0.34}
              fontFamily="ui-monospace, monospace"
              fontWeight={700}
              fill={lit ? "#fff" : "var(--muted)"}
            >
              {lit ? "1" : "0"}
            </text>
          </g>,
        );
      } else {
        // tile or knock
        const isKnock = cell.kind === "knock";
        if (st === "gap") {
          cellsOut.push(
            <rect
              key={`t${key}`}
              x={cx - (cellPx * TILE_W) / 2}
              y={cy - (cellPx * TILE_H) / 2}
              width={cellPx * TILE_W}
              height={cellPx * TILE_H}
              rx={1.5}
              fill="none"
              stroke="var(--dom-gap)"
              strokeWidth={1.5}
              strokeDasharray="3 2"
            />,
          );
        } else if (st === "standing") {
          cellsOut.push(
            <rect
              key={`t${key}`}
              x={cx - (cellPx * TILE_W) / 2}
              y={cy - (cellPx * TILE_H) / 2}
              width={cellPx * TILE_W}
              height={cellPx * TILE_H}
              rx={1.5}
              fill="var(--dom-standing)"
              stroke="var(--dom-standing)"
              strokeWidth={1}
            />,
          );
        } else {
          // fallen: same rectangle laid flat along the axis it fell
          const horiz = axes[i] === "h";
          const w = horiz ? cellPx * TILE_H : cellPx * TILE_W;
          const h = horiz ? cellPx * TILE_W : cellPx * TILE_H;
          cellsOut.push(
            <rect
              key={`t${key}`}
              x={cx - w / 2}
              y={cy - h / 2}
              width={w}
              height={h}
              rx={1.5}
              fill={st === "front" ? "var(--dom-front)" : "var(--dom-fallen)"}
              stroke={st === "front" ? "var(--dom-front)" : "var(--dom-standing)"}
              strokeWidth={1}
              opacity={0.95}
            />,
          );
        }

        if (isKnock && cell.dir && st !== "gap") {
          cellsOut.push(
            <path
              key={`k${key}`}
              d={arrowPath(cell.dir, cx, cy, cellPx * 0.4)}
              fill={
                st === "standing" ? "var(--gate-wire-off)" : "var(--dom-front)"
              }
              opacity={st === "standing" ? 0.75 : 1}
            />,
          );
        }
      }

      if (interactive) {
        cellsOut.push(
          <rect
            key={`h${key}`}
            x={x * cellPx}
            y={y * cellPx}
            width={cellPx}
            height={cellPx}
            fill="transparent"
            style={{ cursor: isLocked ? "not-allowed" : "pointer" }}
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
      viewBox={`0 0 ${W} ${H}`}
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
      {cellsOut}
    </svg>
  );
}
