import { useMemo, useState } from "react";

type Color = "red" | "blue";

interface Piece {
  id: number;
  color: Color;
  sq: number;
}

interface Props {
  title?: string;
  hint?: string;
}

const ROWS = 4;
const COLS = 3;

// 10-square ring: 3×4 box with (1,1) and (2,1) removed.
const SQ_TO_RC: Record<number, [number, number]> = {
  1:  [0, 0], 2: [0, 1], 3:  [0, 2],
  4:  [1, 0],            5:  [1, 2],
  6:  [2, 0],            7:  [2, 2],
  8:  [3, 0], 9: [3, 1], 10: [3, 2],
};
const RC_TO_SQ = new Map<string, number>();
for (const [s, [r, c]] of Object.entries(SQ_TO_RC)) {
  RC_TO_SQ.set(`${r},${c}`, Number(s));
}

const KNIGHT_DELTAS: Array<[number, number]> = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

const START_PIECES: Piece[] = [
  { id: 1, color: "blue", sq: 1 },
  { id: 2, color: "blue", sq: 3 },
  { id: 3, color: "red",  sq: 8 },
  { id: 4, color: "red",  sq: 10 },
];
const GOAL_PIECES: Piece[] = [
  { id: 1, color: "blue", sq: 1 },
  { id: 2, color: "blue", sq: 8 },
  { id: 3, color: "red",  sq: 3 },
  { id: 4, color: "red",  sq: 10 },
];
const TARGET_BY_SQ: Record<number, Color> = {
  1: "blue", 8: "blue", 3: "red", 10: "red",
};

export default function ReconfigurePuzzle({ title, hint }: Props) {
  const [pieces, setPieces] = useState<Piece[]>(() =>
    START_PIECES.map((p) => ({ ...p })),
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);

  const pieceBySq = useMemo(() => {
    const m = new Map<number, Piece>();
    for (const p of pieces) m.set(p.sq, p);
    return m;
  }, [pieces]);

  const selected =
    selectedId != null
      ? pieces.find((p) => p.id === selectedId) ?? null
      : null;

  const solved = pieces.every((p) => TARGET_BY_SQ[p.sq] === p.color);

  const isLegalTarget = (sq: number): boolean => {
    if (!selected || solved) return false;
    if (pieceBySq.has(sq)) return false;
    const [r1, c1] = SQ_TO_RC[selected.sq];
    const [r2, c2] = SQ_TO_RC[sq];
    const dr = r2 - r1;
    const dc = c2 - c1;
    return KNIGHT_DELTAS.some(([a, b]) => a === dr && b === dc);
  };

  const handleClick = (sq: number) => {
    if (solved) return;
    const here = pieceBySq.get(sq);
    if (here) {
      setSelectedId((cur) => (cur === here.id ? null : here.id));
      return;
    }
    if (selected && isLegalTarget(sq)) {
      setPieces((prev) =>
        prev.map((p) => (p.id === selected.id ? { ...p, sq } : p)),
      );
      setMoves((m) => m + 1);
      setSelectedId(null);
    }
  };

  const reset = () => {
    setPieces(START_PIECES.map((p) => ({ ...p })));
    setSelectedId(null);
    setMoves(0);
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
              pieceBySq={pieceBySq}
              selectedId={selectedId}
              isLegalTarget={isLegalTarget}
              solved={solved}
              onSquareClick={handleClick}
              cellPx={70}
            />
          </BoardFrame>
          <BoardFrame label="Goal" faded>
            <Board
              pieceBySq={piecesToMap(GOAL_PIECES)}
              cellPx={52}
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
              Reconfigured in {moves} {moves === 1 ? "move" : "moves"}.
            </span>
          )}
        </div>
      </div>
    </figure>
  );
}

function piecesToMap(pieces: Piece[]): Map<number, Piece> {
  const m = new Map<number, Piece>();
  for (const p of pieces) m.set(p.sq, p);
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
  pieceBySq,
  cellPx,
  selectedId = null,
  isLegalTarget,
  solved = false,
  onSquareClick,
  faded = false,
}: {
  pieceBySq: Map<number, Piece>;
  cellPx: number;
  selectedId?: number | null;
  isLegalTarget?: (sq: number) => boolean;
  solved?: boolean;
  onSquareClick?: (sq: number) => void;
  faded?: boolean;
}) {
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
        opacity: faded ? 0.75 : 1,
      }}
    >
      {Array.from({ length: ROWS * COLS }, (_, idx) => {
        const r = Math.floor(idx / COLS);
        const c = idx % COLS;
        const sq = RC_TO_SQ.get(`${r},${c}`);

        if (sq == null) {
          return <div key={idx} aria-hidden="true" />;
        }

        const isLight = (r + c) % 2 === 0;
        const here = pieceBySq.get(sq);
        const legal = !faded && isLegalTarget ? isLegalTarget(sq) : false;
        const isSelected =
          !faded && here != null && selectedId != null && here.id === selectedId;
        const interactive =
          !faded && !solved && onSquareClick != null && (here != null || legal);
        const bg = isLight ? "var(--sq-light)" : "var(--sq-dark)";

        return (
          <button
            key={idx}
            type="button"
            onClick={onSquareClick ? () => onSquareClick(sq) : undefined}
            disabled={!interactive}
            tabIndex={faded ? -1 : 0}
            aria-label={
              here ? `${here.color} knight on square ${sq}` : `square ${sq}`
            }
            style={{
              position: "relative",
              background: bg,
              filter: faded ? "saturate(0.55) brightness(1.05)" : "none",
              border: "none",
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
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 3,
                left: 5,
                fontSize: Math.round(cellPx * 0.16),
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, monospace",
                color: isLight
                  ? "rgba(0,0,0,0.55)"
                  : "rgba(255,255,255,0.75)",
                fontWeight: 600,
                letterSpacing: "0.02em",
              }}
            >
              {sq}
            </span>
            {here && (
              <Knight
                color={here.color}
                size={Math.round(cellPx * 0.6)}
                faded={faded}
              />
            )}
            {legal && !here && (
              <span
                aria-hidden="true"
                style={{
                  width: Math.round(cellPx * 0.22),
                  height: Math.round(cellPx * 0.22),
                  borderRadius: "50%",
                  background: "var(--accent)",
                  opacity: 0.55,
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
