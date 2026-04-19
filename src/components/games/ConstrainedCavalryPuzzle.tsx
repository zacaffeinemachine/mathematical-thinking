import { useMemo, useState } from "react";

type Color = "red" | "blue";
type Terrain = "brown" | "red-land" | "blue-land";

interface Piece {
  id: number;
  color: Color;
  r: number;
  c: number;
  dead: boolean;
}

interface Props {
  title?: string;
  hint?: string;
}

const ROWS = 7;
const COLS = 8;

// Layout taken from Images/MT.py :: midterm_reexam_guarini_problem()
// Python uses Point(x, y) as cell centre with y pointing up.
// Converted here to (row, col) with row 0 at the top via  row = 7 - y,  col = x - 1.
const TERRAIN: Record<string, Terrain> = {
  // Brown walkable (lower-left irregular region)
  "6,1": "brown", "6,2": "brown",
  "5,0": "brown",
  "4,0": "brown", "4,2": "brown", "4,3": "brown",
  "3,0": "brown", "3,2": "brown",
  // Red land L-shape (upper middle)
  "1,3": "red-land", "1,4": "red-land", "1,5": "red-land",
  "0,5": "red-land",
  // Blue land L-shape (middle right, with tail below)
  "5,5": "blue-land", "5,6": "blue-land", "5,7": "blue-land",
  "6,7": "blue-land",
};

const KNIGHT_DELTAS: Array<[number, number]> = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

const START_PIECES: Piece[] = [
  { id: 1, color: "blue", r: 6, c: 1, dead: false },
  { id: 2, color: "red",  r: 6, c: 2, dead: false },
  { id: 3, color: "blue", r: 4, c: 0, dead: false },
  { id: 4, color: "red",  r: 5, c: 0, dead: false },
];

// Only (1,3), (0,5) in red land and (5,5), (6,7) in blue land are
// knight-reachable from the brown cluster, so the canonical goal places the
// knights on those cells.
const GOAL_PIECES: Piece[] = [
  { id: 1, color: "blue", r: 5, c: 5, dead: false },
  { id: 2, color: "red",  r: 1, c: 3, dead: false },
  { id: 3, color: "blue", r: 6, c: 7, dead: false },
  { id: 4, color: "red",  r: 0, c: 5, dead: false },
];

const LAND_COLORS = {
  "red-land":  { bg: "#F06292", border: "#A6375C" },
  "blue-land": { bg: "#5A8DB8", border: "#335A80" },
} as const;

function key(r: number, c: number): string {
  return `${r},${c}`;
}

function isLethal(color: Color, terrain: Terrain | undefined): boolean {
  if (color === "red"  && terrain === "blue-land") return true;
  if (color === "blue" && terrain === "red-land")  return true;
  return false;
}

function isSolved(pieces: Piece[]): boolean {
  if (pieces.some((p) => p.dead)) return false;
  return pieces.every((p) => {
    const t = TERRAIN[key(p.r, p.c)];
    if (p.color === "red"  && t !== "red-land")  return false;
    if (p.color === "blue" && t !== "blue-land") return false;
    return true;
  });
}

export default function ConstrainedCavalryPuzzle({ title, hint }: Props) {
  const [pieces, setPieces] = useState<Piece[]>(() =>
    START_PIECES.map((p) => ({ ...p })),
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [deathMsg, setDeathMsg] = useState<string | null>(null);

  const pieceAt = useMemo(() => {
    const m = new Map<string, Piece>();
    for (const p of pieces) if (!p.dead) m.set(key(p.r, p.c), p);
    return m;
  }, [pieces]);

  const selected =
    selectedId != null
      ? pieces.find((p) => p.id === selectedId && !p.dead) ?? null
      : null;

  const anyDead = pieces.some((p) => p.dead);
  const solved = isSolved(pieces);

  const isLegalTarget = (r: number, c: number): boolean => {
    if (!selected || solved || anyDead) return false;
    if (pieceAt.has(key(r, c))) return false;
    if (TERRAIN[key(r, c)] == null) return false;
    const dr = r - selected.r;
    const dc = c - selected.c;
    return KNIGHT_DELTAS.some(([a, b]) => a === dr && b === dc);
  };

  const handleClick = (r: number, c: number) => {
    if (solved || anyDead) return;
    const here = pieceAt.get(key(r, c));
    if (here) {
      setSelectedId((cur) => (cur === here.id ? null : here.id));
      return;
    }
    if (selected && isLegalTarget(r, c)) {
      const terrain = TERRAIN[key(r, c)];
      const lethal = isLethal(selected.color, terrain);

      setPieces((prev) =>
        prev.map((p) =>
          p.id === selected.id ? { ...p, r, c, dead: lethal || p.dead } : p,
        ),
      );
      setMoves((m) => m + 1);
      setSelectedId(null);

      if (lethal) {
        const land = terrain === "red-land" ? "red land" : "blue land";
        setDeathMsg(
          `A ${selected.color} knight set a hoof on the ${land} and died. Press Reset to try again.`,
        );
      }
    }
  };

  const reset = () => {
    setPieces(START_PIECES.map((p) => ({ ...p })));
    setSelectedId(null);
    setMoves(0);
    setDeathMsg(null);
  };

  return (
    <figure className="not-prose my-10">
      {title && (
        <figcaption className="text-sm font-medium mb-1">{title}</figcaption>
      )}
      {hint && (
        <p className="text-sm text-[var(--muted)] mb-4">{hint}</p>
      )}

      <div className="flex flex-col items-center gap-5">
        <div className="flex flex-wrap items-start justify-center gap-8">
          <BoardFrame label="Board">
            <Board
              pieceAt={pieceAt}
              deadPieces={pieces.filter((p) => p.dead)}
              selectedId={selectedId}
              isLegalTarget={isLegalTarget}
              solved={solved}
              frozen={anyDead}
              onSquareClick={handleClick}
              cellPx={62}
            />
          </BoardFrame>
          <BoardFrame label="Goal" faded>
            <Board
              pieceAt={piecesToMap(GOAL_PIECES)}
              deadPieces={[]}
              cellPx={46}
              faded
            />
          </BoardFrame>
        </div>

        <div className="flex items-center gap-4 text-sm flex-wrap justify-center">
          <span className="text-[var(--muted)]">
            Moves: <strong className="text-[var(--ink)]">{moves}</strong>
          </span>
          <button
            onClick={reset}
            className="px-3 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] transition-colors"
          >
            Reset
          </button>
          {solved && (
            <span className="font-medium" style={{ color: "var(--accent)" }}>
              Settled in {moves} {moves === 1 ? "move" : "moves"}.
            </span>
          )}
        </div>

        {deathMsg && (
          <p className="text-sm font-medium text-center" style={{ color: "#c0392b" }}>
            {deathMsg}
          </p>
        )}
      </div>
    </figure>
  );
}

function piecesToMap(pieces: Piece[]): Map<string, Piece> {
  const m = new Map<string, Piece>();
  for (const p of pieces) m.set(key(p.r, p.c), p);
  return m;
}

function BoardFrame({
  label,
  faded = false,
  children,
}: {
  label: string;
  faded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="text-xs uppercase tracking-wider"
        style={{
          color: faded ? "var(--muted)" : "var(--ink)",
          fontWeight: 600,
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Board({
  pieceAt,
  deadPieces,
  cellPx,
  selectedId = null,
  isLegalTarget,
  solved = false,
  frozen = false,
  onSquareClick,
  faded = false,
}: {
  pieceAt: Map<string, Piece>;
  deadPieces: Piece[];
  cellPx: number;
  selectedId?: number | null;
  isLegalTarget?: (r: number, c: number) => boolean;
  solved?: boolean;
  frozen?: boolean;
  onSquareClick?: (r: number, c: number) => void;
  faded?: boolean;
}) {
  const deadAt = new Map<string, Piece>();
  for (const p of deadPieces) deadAt.set(key(p.r, p.c), p);
  return (
    <div
      className="rounded-xl"
      style={{
        padding: 8,
        background: "var(--surface)",
        border: `1px ${faded ? "dashed" : "solid"} var(--rule)`,
        boxShadow: faded ? "none" : "0 1px 2px rgba(0,0,0,0.04)",
        display: "grid",
        gridTemplateColumns: `repeat(${COLS}, ${cellPx}px)`,
        gridTemplateRows: `repeat(${ROWS}, ${cellPx}px)`,
        gap: 0,
        width: COLS * cellPx + 16,
        maxWidth: "95vw",
        opacity: faded ? 0.85 : 1,
      }}
    >
      {Array.from({ length: ROWS * COLS }, (_, idx) => {
        const r = Math.floor(idx / COLS);
        const c = idx % COLS;
        const terrain = TERRAIN[key(r, c)];
        const here = pieceAt.get(key(r, c));
        const deadHere = deadAt.get(key(r, c));
        const legal =
          !faded && !frozen && terrain && isLegalTarget
            ? isLegalTarget(r, c)
            : false;
        const isSelected =
          !faded &&
          here != null &&
          selectedId != null &&
          here.id === selectedId;
        const interactive =
          !faded &&
          !solved &&
          !frozen &&
          terrain != null &&
          onSquareClick != null &&
          (here != null || legal);

        let bg = "transparent";
        let borderStyle = "1px dashed rgba(120,120,120,0.35)";
        if (terrain === "red-land") {
          bg = LAND_COLORS["red-land"].bg;
          borderStyle = `1px solid ${LAND_COLORS["red-land"].border}`;
        } else if (terrain === "blue-land") {
          bg = LAND_COLORS["blue-land"].bg;
          borderStyle = `1px solid ${LAND_COLORS["blue-land"].border}`;
        } else if (terrain === "brown") {
          const isLight = (r + c) % 2 === 0;
          bg = isLight ? "var(--sq-light)" : "var(--sq-dark)";
          borderStyle = "none";
        }

        const inactive = terrain == null;

        return (
          <button
            key={idx}
            type="button"
            onClick={
              onSquareClick && terrain != null
                ? () => onSquareClick(r, c)
                : undefined
            }
            disabled={!interactive}
            tabIndex={faded || inactive ? -1 : 0}
            aria-label={
              inactive
                ? "forbidden square"
                : here
                  ? `${here.color} knight on ${terrain}`
                  : `${terrain} square`
            }
            style={{
              position: "relative",
              background: bg,
              filter: faded ? "saturate(0.65) brightness(1.05)" : "none",
              border: borderStyle,
              boxSizing: "border-box",
              padding: 0,
              cursor: interactive ? "pointer" : "default",
              outline: isSelected ? "2px solid var(--accent)" : "none",
              outlineOffset: -2,
              transition: "background 120ms, outline 120ms",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {here && (
              <Knight
                color={here.color}
                size={Math.round(cellPx * 0.72)}
                faded={faded}
              />
            )}
            {deadHere && (
              <DeadKnight
                color={deadHere.color}
                size={Math.round(cellPx * 0.72)}
              />
            )}
            {legal && !here && (
              <span
                aria-hidden="true"
                style={{
                  width: Math.round(cellPx * 0.26),
                  height: Math.round(cellPx * 0.26),
                  borderRadius: "50%",
                  background: "var(--accent)",
                  opacity: 0.6,
                  position: "absolute",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

function Knight({
  color,
  size = 44,
  faded = false,
}: {
  color: Color;
  size?: number;
  faded?: boolean;
}) {
  const fill = color === "red" ? "#c0392b" : "#2563eb";
  const stroke = color === "red" ? "#7a1d13" : "#1e3a8a";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 45 45"
      aria-hidden="true"
      style={{ opacity: faded ? 0.85 : 1 }}
    >
      <g
        fill={fill}
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22,10 C32.5,11 38.5,18 38,39 L15,39 C15,30 25,32.5 23,18" />
        <path d="M24,18 C24.38,20.91 18.45,25.37 16,27 C13,29 13.18,31.34 11,31 C9.958,30.06 12.41,27.96 11,28 C10,28 11.19,29.23 10,30 C9,30 5.997,31 6,26 C6,24 12,14 12,14 C12,14 13.89,12.1 14,10.5 C13.27,9.506 13.5,8.5 13.5,7.5 C14.5,5.5 16.5,4 16.5,4 C16.5,4 18.5,4 19,5 L20,5 C20,5 22,8 22,10" />
        <path
          d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z"
          fill="#fafafa"
          stroke="#fafafa"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
}

function DeadKnight({ color, size = 44 }: { color: Color; size?: number }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          transform: "rotate(90deg)",
          opacity: 0.45,
          filter: "grayscale(0.9)",
        }}
      >
        <Knight color={color} size={size} />
      </div>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        <line
          x1="20" y1="20" x2="80" y2="80"
          stroke="#c0392b" strokeWidth="7" strokeLinecap="round"
        />
        <line
          x1="80" y1="20" x2="20" y2="80"
          stroke="#c0392b" strokeWidth="7" strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
