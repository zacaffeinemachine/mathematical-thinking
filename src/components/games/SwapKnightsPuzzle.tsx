import { useMemo, useState, type ReactNode } from "react";

type Coord = [number, number];
type Color = "red" | "blue";
type Variant = "diagonal" | "rowpair" | "classical";

interface Piece {
  id: number;
  color: Color;
  pos: Coord;
}

interface RiddleConfig {
  prompt: ReactNode;
  answers: string[];
  wrongHint: ReactNode;
}

interface VariantConfig {
  start: Piece[];
  goal: Piece[];
  target: Record<string, Color>;
  riddle: RiddleConfig;
}

interface Props {
  title?: string;
  hint?: string;
  variant?: Variant;
}

const ROWS = 3;
const COLS = 3;

const KNIGHT_DELTAS: Coord[] = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

const keyOf = (r: number, c: number) => `${r},${c}`;

const VARIANTS: Record<Variant, VariantConfig> = {
  diagonal: {
    start: [
      { id: 1, color: "red",  pos: [0, 0] },
      { id: 2, color: "red",  pos: [2, 2] },
      { id: 3, color: "blue", pos: [0, 2] },
      { id: 4, color: "blue", pos: [2, 0] },
    ],
    goal: [
      { id: 1, color: "blue", pos: [0, 0] },
      { id: 2, color: "blue", pos: [2, 2] },
      { id: 3, color: "red",  pos: [0, 2] },
      { id: 4, color: "red",  pos: [2, 0] },
    ],
    target: {
      [keyOf(0, 0)]: "blue",
      [keyOf(2, 2)]: "blue",
      [keyOf(0, 2)]: "red",
      [keyOf(2, 0)]: "red",
    },
    riddle: {
      prompt: (
        <>
          In the bone-dry realm where the shinigami drift, one withered
          fruit is prized above all others — Ryuk would trade a name in the
          notebook for a single taste. Wrinkled, sweet, and coveted even by
          gods of death: name this dessicated fruit of their dreary world.
          <br />
          <em className="text-[var(--muted)]">One word.</em>
        </>
      ),
      answers: ["apple", "apples"],
      wrongHint:
        "Not quite — think of what Ryuk craves on every page of the death god's ledger.",
    },
  },
  rowpair: {
    start: [
      { id: 1, color: "red",  pos: [0, 0] },
      { id: 2, color: "red",  pos: [0, 2] },
      { id: 3, color: "blue", pos: [2, 0] },
      { id: 4, color: "blue", pos: [2, 2] },
    ],
    goal: [
      { id: 1, color: "blue", pos: [0, 0] },
      { id: 2, color: "blue", pos: [0, 2] },
      { id: 3, color: "red",  pos: [2, 0] },
      { id: 4, color: "red",  pos: [2, 2] },
    ],
    target: {
      [keyOf(0, 0)]: "blue",
      [keyOf(0, 2)]: "blue",
      [keyOf(2, 0)]: "red",
      [keyOf(2, 2)]: "red",
    },
    riddle: {
      prompt: (
        <>
          A young genius finds a black notebook fallen from the sky. With it
          he begins a secret crusade — judging criminals from the safety of
          his study, striking them down by name alone. The world soon learns
          of this invisible judge and christens him with a single word that
          means &ldquo;killer&rdquo; in the tongue of the island that bore
          him. By what name does the world come to know him?
          <br />
          <em className="text-[var(--muted)]">One word.</em>
        </>
      ),
      answers: ["kira"],
      wrongHint:
        "Not quite — this is the alias Light Yagami takes, the name whispered across every news broadcast in the series.",
    },
  },
  classical: {
    start: [
      { id: 1, color: "red",  pos: [0, 0] },
      { id: 2, color: "red",  pos: [0, 2] },
      { id: 3, color: "blue", pos: [2, 0] },
      { id: 4, color: "blue", pos: [2, 2] },
    ],
    goal: [
      { id: 1, color: "blue", pos: [0, 0] },
      { id: 2, color: "red",  pos: [0, 2] },
      { id: 3, color: "red",  pos: [2, 0] },
      { id: 4, color: "blue", pos: [2, 2] },
    ],
    target: {
      [keyOf(0, 0)]: "blue",
      [keyOf(2, 2)]: "blue",
      [keyOf(0, 2)]: "red",
      [keyOf(2, 0)]: "red",
    },
    riddle: {
      prompt: (
        <>
          Among the shinigami, one bore a heart. Tall as a mast, her body all
          bone and silver, she loved a human girl in defiance of every rule
          her kind obeys. When the detectives' noose tightened around her
          beloved, she took up her ledger and struck down two men to save
          her — and was undone on the instant, crumbling to dust the moment
          the ink dried. What was her name?
          <br />
          <em className="text-[var(--muted)]">One word.</em>
        </>
      ),
      answers: ["rem"],
      wrongHint:
        "Not quite — the answer is the tall shinigami who gave her notebook to Misa and who was undone by her own love.",
    },
  },
};

export default function SwapKnightsPuzzle({
  title,
  hint,
  variant = "diagonal",
}: Props) {
  const config = VARIANTS[variant];
  const START_PIECES = config.start;
  const GOAL_PIECES = config.goal;
  const TARGET = config.target;
  const RIDDLE = config.riddle;
  const [pieces, setPieces] = useState<Piece[]>(() =>
    START_PIECES.map((p) => ({ ...p, pos: [...p.pos] as Coord })),
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);

  const [riddleOpen, setRiddleOpen] = useState(false);
  const [riddleAnswer, setRiddleAnswer] = useState("");
  const [riddleError, setRiddleError] = useState(false);
  const [graphUnlocked, setGraphUnlocked] = useState(false);

  const submitRiddle = () => {
    const normalized = riddleAnswer.trim().toLowerCase();
    if (RIDDLE.answers.includes(normalized)) {
      setGraphUnlocked(true);
      setRiddleOpen(false);
      setRiddleError(false);
    } else {
      setRiddleError(true);
    }
  };

  const pieceAt = useMemo(() => {
    const map = new Map<string, Piece>();
    for (const p of pieces) map.set(keyOf(p.pos[0], p.pos[1]), p);
    return map;
  }, [pieces]);

  const selected = selectedId != null
    ? pieces.find((p) => p.id === selectedId) ?? null
    : null;

  const solved = pieces.every(
    (p) => TARGET[keyOf(p.pos[0], p.pos[1])] === p.color,
  );

  const isLegalMove = (r: number, c: number): boolean => {
    if (!selected) return false;
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
    if (pieceAt.has(keyOf(r, c))) return false;
    const dr = r - selected.pos[0];
    const dc = c - selected.pos[1];
    return KNIGHT_DELTAS.some(([a, b]) => a === dr && b === dc);
  };

  const handleClick = (r: number, c: number) => {
    if (solved) return;
    const here = pieceAt.get(keyOf(r, c));

    if (here) {
      setSelectedId((cur) => (cur === here.id ? null : here.id));
      return;
    }

    if (selected && isLegalMove(r, c)) {
      setPieces((prev) =>
        prev.map((p) =>
          p.id === selected.id ? { ...p, pos: [r, c] as Coord } : p,
        ),
      );
      setMoves((m) => m + 1);
      setSelectedId(null);
    }
  };

  const reset = () => {
    setPieces(START_PIECES.map((p) => ({ ...p, pos: [...p.pos] as Coord })));
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
              pieceAt={pieceAt}
              selectedId={selectedId}
              isLegalMove={isLegalMove}
              solved={solved}
              onClick={handleClick}
              cellPx={72}
            />
            {graphUnlocked && (
              <KnightGraph
                pieceAt={pieceAt}
                selectedId={selectedId}
                size={COLS * 72 + 16}
              />
            )}
          </BoardFrame>

          <BoardFrame label="Goal" faded>
            <Board
              pieceAt={pieceMapOf(GOAL_PIECES)}
              cellPx={56}
              faded
            />
            {graphUnlocked && (
              <KnightGraph
                pieceAt={pieceMapOf(GOAL_PIECES)}
                selectedId={null}
                size={COLS * 56 + 16}
                faded
              />
            )}
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
              Swapped in {moves} {moves === 1 ? "move" : "moves"}.
            </span>
          )}
        </div>

        {!graphUnlocked && (
          <button
            onClick={() => {
              setRiddleOpen((v) => !v);
              setRiddleError(false);
            }}
            className="text-[10px] tracking-wider uppercase text-[var(--muted)] hover:text-[var(--ink)] transition-colors mt-2 opacity-40 hover:opacity-80"
            style={{ background: "none", border: "none", padding: "2px 4px", cursor: "pointer" }}
            aria-label="Reveal hint"
          >
            mind over matter
          </button>
        )}

        {riddleOpen && !graphUnlocked && (
          <div
            className="w-full max-w-md p-4 rounded-lg border border-[var(--rule)] bg-[var(--surface)]"
          >
            <p className="text-sm mb-3">{RIDDLE.prompt}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitRiddle();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={riddleAnswer}
                onChange={(e) => {
                  setRiddleAnswer(e.target.value);
                  setRiddleError(false);
                }}
                placeholder="your answer"
                aria-label="Riddle answer"
                autoFocus
                className="flex-1 px-3 py-1.5 rounded-md border border-[var(--rule)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] text-sm transition-colors"
              >
                Answer
              </button>
            </form>
            {riddleError && (
              <p className="text-xs mt-2" style={{ color: "var(--accent)" }}>
                {RIDDLE.wrongHint}
              </p>
            )}
          </div>
        )}

        {graphUnlocked && (
          <p className="text-sm text-[var(--muted)] max-w-lg text-center">
            Each square is a vertex; an edge joins two squares whenever a knight
            can jump between them. The knights on the graph move in lockstep
            with those on the board.
          </p>
        )}
      </div>
    </figure>
  );
}

function pieceMapOf(pieces: Piece[]): Map<string, Piece> {
  const map = new Map<string, Piece>();
  for (const p of pieces) map.set(keyOf(p.pos[0], p.pos[1]), p);
  return map;
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

interface BoardProps {
  pieceAt: Map<string, Piece>;
  cellPx: number;
  selectedId?: number | null;
  isLegalMove?: (r: number, c: number) => boolean;
  solved?: boolean;
  onClick?: (r: number, c: number) => void;
  faded?: boolean;
}

function Board({
  pieceAt,
  cellPx,
  selectedId = null,
  isLegalMove,
  solved = false,
  onClick,
  faded = false,
}: BoardProps) {
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
        const label = idx + 1;
        const here = pieceAt.get(keyOf(r, c));
        const isLight = (r + c) % 2 === 0;
        const legal = !faded && isLegalMove ? isLegalMove(r, c) : false;
        const isSelected =
          !faded && here != null && selectedId != null && here.id === selectedId;

        const interactive =
          !faded && !solved && onClick != null && (here != null || legal);

        const bg = isLight ? "var(--sq-light)" : "var(--sq-dark)";

        return (
          <button
            key={idx}
            type="button"
            onClick={onClick ? () => onClick(r, c) : undefined}
            disabled={!interactive}
            tabIndex={faded ? -1 : 0}
            aria-disabled={faded || undefined}
            aria-label={
              here
                ? `${here.color} knight on square ${label}`
                : `square ${label}`
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
              {label}
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

// Knight-move graph on the 3x3 board: an 8-cycle around the outer squares
// (1-6-7-2-9-4-3-8-1) plus the isolated centre vertex 5.
const GRAPH_CYCLE = [1, 6, 7, 2, 9, 4, 3, 8] as const;

function squareToCoord(sq: number): Coord {
  const idx = sq - 1;
  return [Math.floor(idx / COLS), idx % COLS];
}

function graphPos(sq: number, size: number): { x: number; y: number } {
  const center = size / 2;
  const radius = center - Math.max(24, size * 0.13);
  if (sq === 5) return { x: center, y: center };
  const i = GRAPH_CYCLE.indexOf(sq as (typeof GRAPH_CYCLE)[number]);
  const angle = (-Math.PI / 2) + (i * 2 * Math.PI) / GRAPH_CYCLE.length;
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
}

function KnightGraph({
  pieceAt,
  selectedId,
  size,
  faded = false,
}: {
  pieceAt: Map<string, Piece>;
  selectedId: number | null;
  size: number;
  faded?: boolean;
}) {
  const nodeR = Math.max(9, Math.round(size * 0.055));
  const fontSize = Math.max(9, Math.round(size * 0.05));
  const edgeWidth = Math.max(3, Math.round(size * 0.016));

  const edges: Array<[number, number]> = [];
  for (let i = 0; i < GRAPH_CYCLE.length; i++) {
    edges.push([GRAPH_CYCLE[i], GRAPH_CYCLE[(i + 1) % GRAPH_CYCLE.length]]);
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={faded ? "Knight-move graph, goal state" : "Knight-move graph"}
      style={{
        background: "var(--surface)",
        border: `1px ${faded ? "dashed" : "solid"} var(--rule)`,
        borderRadius: 12,
        opacity: faded ? 0.75 : 1,
        filter: faded ? "saturate(0.55)" : "none",
      }}
    >
      {edges.map(([a, b], i) => {
        const pa = graphPos(a, size);
        const pb = graphPos(b, size);
        return (
          <line
            key={i}
            x1={pa.x}
            y1={pa.y}
            x2={pb.x}
            y2={pb.y}
            stroke="var(--ink)"
            strokeOpacity={0.7}
            strokeWidth={edgeWidth}
            strokeLinecap="round"
          />
        );
      })}

      {Array.from({ length: 9 }, (_, i) => {
        const sq = i + 1;
        const { x, y } = graphPos(sq, size);
        const [r, c] = squareToCoord(sq);
        const here = pieceAt.get(keyOf(r, c));
        const isSelected = here != null && selectedId === here.id;

        const fill = here
          ? here.color === "red" ? "#c0392b" : "#2563eb"
          : "var(--surface)";
        const stroke = here
          ? here.color === "red" ? "#7a1d13" : "#1e3a8a"
          : "var(--muted)";
        const textColor = here ? "#ffffff" : "var(--muted)";

        return (
          <g key={sq}>
            <circle
              cx={x}
              cy={y}
              r={nodeR}
              fill={fill}
              stroke={stroke}
              strokeWidth={isSelected ? 3 : 1.8}
            />
            {isSelected && (
              <circle
                cx={x}
                cy={y}
                r={nodeR + 5}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={2}
              />
            )}
            <text
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={fontSize}
              fontWeight={600}
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill={textColor}
            >
              {sq}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
