import { useMemo, useState } from "react";

type Color = "red" | "blue";

interface Piece {
  id: number;
  color: Color;
  sq: number;
  dead: boolean;
}

interface Fruit {
  color: Color;
  sq: number;
  eaten: boolean;
}

interface Props {
  title?: string;
  hint?: string;
}

// Board: 5 cols × 4 rows bounding box. Active squares numbered 1..10.
// Forbidden (X) squares cannot be landed on but a knight may jump over them.
const ROWS = 4;
const COLS = 5;

// row 0 = top; col 0 = left.
const SQ_TO_RC: Record<number, [number, number]> = {
  1:  [0, 4],
  2:  [1, 0],
  3:  [1, 1],
  4:  [1, 2],
  5:  [2, 0],
  6:  [2, 1],
  7:  [2, 2],
  8:  [3, 0],
  9:  [3, 1],
  10: [3, 2],
};
const RC_TO_SQ = new Map<string, number>();
for (const [s, [r, c]] of Object.entries(SQ_TO_RC)) {
  RC_TO_SQ.set(`${r},${c}`, Number(s));
}

const FORBIDDEN_RC = new Set<string>(["1,3", "1,4"]);

const KNIGHT_DELTAS: Array<[number, number]> = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

const START_PIECES: Piece[] = [
  { id: 1, color: "red",  sq: 8,  dead: false },
  { id: 2, color: "red",  sq: 10, dead: false },
  { id: 3, color: "blue", sq: 2,  dead: false },
  { id: 4, color: "blue", sq: 4,  dead: false },
];
const START_FRUITS: Fruit[] = [
  { color: "red",  sq: 9, eaten: false },
  { color: "blue", sq: 3, eaten: false },
];
const GOAL_PIECES: Piece[] = [
  { id: 1, color: "blue", sq: 8,  dead: false },
  { id: 2, color: "blue", sq: 10, dead: false },
  { id: 3, color: "red",  sq: 2,  dead: false },
  { id: 4, color: "red",  sq: 4,  dead: false },
];
const TARGET_BY_SQ: Record<number, Color> = {
  8: "blue", 10: "blue", 2: "red", 4: "red",
};

// Knight-move graph: 8-cycle 4-9-2-7-8-3-10-5 + pendant 1-4 + isolated 6.
const GRAPH_CYCLE = [4, 9, 2, 7, 8, 3, 10, 5] as const;
const EDGES: Array<[number, number]> = [
  [4, 9], [9, 2], [2, 7], [7, 8], [8, 3], [3, 10], [10, 5], [5, 4],
  [1, 4],
];

export default function ForbiddenFruitPuzzle({ title, hint }: Props) {
  const [pieces, setPieces] = useState<Piece[]>(() =>
    START_PIECES.map((p) => ({ ...p })),
  );
  const [fruits, setFruits] = useState<Fruit[]>(() =>
    START_FRUITS.map((f) => ({ ...f })),
  );
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [deathMsg, setDeathMsg] = useState<string | null>(null);

  const [riddleOpen, setRiddleOpen] = useState(false);
  const [riddleAnswer, setRiddleAnswer] = useState("");
  const [riddleError, setRiddleError] = useState(false);
  const [graphUnlocked, setGraphUnlocked] = useState(false);

  const submitRiddle = () => {
    const n = riddleAnswer.trim().toLowerCase();
    if (n === "misa" || n === "misa amane" || n === "amane") {
      setGraphUnlocked(true);
      setRiddleOpen(false);
      setRiddleError(false);
    } else {
      setRiddleError(true);
    }
  };

  const pieceBySq = useMemo(() => {
    const m = new Map<number, Piece>();
    for (const p of pieces) if (!p.dead) m.set(p.sq, p);
    return m;
  }, [pieces]);

  const fruitBySq = useMemo(() => {
    const m = new Map<number, Fruit>();
    for (const f of fruits) if (!f.eaten) m.set(f.sq, f);
    return m;
  }, [fruits]);

  const selected =
    selectedId != null
      ? pieces.find((p) => p.id === selectedId && !p.dead) ?? null
      : null;

  const anyDead = pieces.some((p) => p.dead);
  const solved =
    !anyDead &&
    pieces.every((p) => !p.dead && TARGET_BY_SQ[p.sq] === p.color);

  const isLegalTarget = (sq: number): boolean => {
    if (!selected || anyDead || solved) return false;
    if (pieceBySq.has(sq)) return false;
    const [r1, c1] = SQ_TO_RC[selected.sq];
    const [r2, c2] = SQ_TO_RC[sq];
    const dr = r2 - r1;
    const dc = c2 - c1;
    return KNIGHT_DELTAS.some(([a, b]) => a === dr && b === dc);
  };

  const handleSquareClick = (sq: number) => {
    if (anyDead || solved) return;
    const here = pieceBySq.get(sq);
    if (here) {
      setSelectedId((cur) => (cur === here.id ? null : here.id));
      return;
    }
    if (selected && isLegalTarget(sq)) {
      const fruit = fruitBySq.get(sq);
      const wrongFruit = fruit && fruit.color !== selected.color;

      setPieces((prev) =>
        prev.map((p) =>
          p.id === selected.id
            ? { ...p, sq, dead: wrongFruit ? true : p.dead }
            : p,
        ),
      );
      if (fruit) {
        setFruits((prev) =>
          prev.map((f) => (f.sq === sq ? { ...f, eaten: true } : f)),
        );
      }
      setMoves((m) => m + 1);
      setSelectedId(null);

      if (wrongFruit) {
        const k = selected.color;
        const f = fruit!.color;
        setDeathMsg(
          `A ${k} knight ate a ${f} fruit and died. Press Reset to try again.`,
        );
      }
    }
  };

  const reset = () => {
    setPieces(START_PIECES.map((p) => ({ ...p })));
    setFruits(START_FRUITS.map((f) => ({ ...f })));
    setSelectedId(null);
    setMoves(0);
    setDeathMsg(null);
  };

  const boardCellPx = 60;
  const boardSize = COLS * boardCellPx + 16;
  const goalCellPx = 48;
  const goalSize = COLS * goalCellPx + 16;

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
              deadPieces={pieces.filter((p) => p.dead)}
              fruitBySq={fruitBySq}
              selectedId={selectedId}
              isLegalTarget={isLegalTarget}
              solved={solved}
              frozen={anyDead}
              onSquareClick={handleSquareClick}
              cellPx={boardCellPx}
            />
            {graphUnlocked && (
              <KnightGraph
                pieceBySq={pieceBySq}
                fruitBySq={fruitBySq}
                selectedId={selectedId}
                size={boardSize}
              />
            )}
          </BoardFrame>

          <BoardFrame label="Goal" faded>
            <Board
              pieceBySq={piecesToMap(GOAL_PIECES)}
              deadPieces={[]}
              fruitBySq={new Map()}
              cellPx={goalCellPx}
              faded
            />
            {graphUnlocked && (
              <KnightGraph
                pieceBySq={piecesToMap(GOAL_PIECES)}
                selectedId={null}
                size={goalSize}
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

        {deathMsg && (
          <p className="text-sm font-medium text-center" style={{ color: "#c0392b" }}>
            {deathMsg}
          </p>
        )}

        {!graphUnlocked && (
          <button
            onClick={() => {
              setRiddleOpen((v) => !v);
              setRiddleError(false);
            }}
            className="text-[10px] tracking-wider uppercase text-[var(--muted)] hover:text-[var(--ink)] transition-colors mt-2 opacity-40 hover:opacity-80"
            style={{
              background: "none",
              border: "none",
              padding: "2px 4px",
              cursor: "pointer",
            }}
            aria-label="Reveal hint"
          >
            mind over matter
          </button>
        )}

        {riddleOpen && !graphUnlocked && (
          <div className="w-full max-w-md p-4 rounded-lg border border-[var(--rule)] bg-[var(--surface)]">
            <p className="text-sm mb-3">
              She is the young idol whose joyful grin hides a notebook pressed
              to her heart. She traded half her life for the shinigami's eyes,
              and blindly offered what remained of it to the boy she called
              Light. She styled herself the Second Kira. Name her.
              <br />
              <em className="text-[var(--muted)]">One word.</em>
            </p>
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
                Not quite — the answer is the blonde idol who styled herself
                the Second Kira and traded her lifespan for the shinigami's
                eyes.
              </p>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}

function piecesToMap(pieces: Piece[]): Map<number, Piece> {
  const m = new Map<number, Piece>();
  for (const p of pieces) if (!p.dead) m.set(p.sq, p);
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

interface BoardProps {
  pieceBySq: Map<number, Piece>;
  deadPieces: Piece[];
  fruitBySq: Map<number, Fruit>;
  cellPx: number;
  selectedId?: number | null;
  isLegalTarget?: (sq: number) => boolean;
  solved?: boolean;
  frozen?: boolean;
  onSquareClick?: (sq: number) => void;
  faded?: boolean;
}

function Board({
  pieceBySq,
  deadPieces,
  fruitBySq,
  cellPx,
  selectedId = null,
  isLegalTarget,
  solved = false,
  frozen = false,
  onSquareClick,
  faded = false,
}: BoardProps) {
  const deadBySq = new Map<number, Piece>();
  for (const p of deadPieces) deadBySq.set(p.sq, p);

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
        const rcKey = `${r},${c}`;
        const sq = RC_TO_SQ.get(rcKey);
        const isForbidden = FORBIDDEN_RC.has(rcKey);

        if (sq == null && !isForbidden) {
          return <div key={idx} aria-hidden="true" />;
        }

        const isLight = (r + c) % 2 === 0;
        const here = sq != null ? pieceBySq.get(sq) : undefined;
        const deadHere = sq != null ? deadBySq.get(sq) : undefined;
        const fruit = sq != null ? fruitBySq.get(sq) : undefined;
        const legal =
          !faded && !frozen && sq != null && isLegalTarget
            ? isLegalTarget(sq)
            : false;
        const isSelected =
          !faded && here != null && selectedId != null && here.id === selectedId;
        const interactive =
          !faded &&
          !solved &&
          !frozen &&
          sq != null &&
          onSquareClick != null &&
          (here != null || legal);

        const bg = isForbidden
          ? "var(--sq-forbidden)"
          : isLight
            ? "var(--sq-light)"
            : "var(--sq-dark)";

        return (
          <button
            key={idx}
            type="button"
            onClick={
              onSquareClick && sq != null
                ? () => onSquareClick(sq)
                : undefined
            }
            disabled={!interactive}
            tabIndex={faded || isForbidden ? -1 : 0}
            aria-label={
              isForbidden
                ? "forbidden square"
                : here
                  ? `${here.color} knight on square ${sq}`
                  : fruit
                    ? `${fruit.color} fruit on square ${sq}`
                    : `square ${sq}`
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
            {sq != null && (
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
            )}

            {isForbidden && <ForbiddenCross size={cellPx} />}

            {fruit && !here && !deadHere && (
              <Fruit color={fruit.color} size={Math.round(cellPx * 0.42)} />
            )}

            {here && (
              <>
                {fruit && (
                  <Fruit
                    color={fruit.color}
                    size={Math.round(cellPx * 0.28)}
                    corner
                  />
                )}
                <Knight
                  color={here.color}
                  size={Math.round(cellPx * 0.6)}
                  faded={faded}
                />
              </>
            )}

            {deadHere && (
              <DeadKnight
                color={deadHere.color}
                size={Math.round(cellPx * 0.6)}
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

function Fruit({
  color,
  size = 20,
  corner = false,
}: {
  color: Color;
  size?: number;
  corner?: boolean;
}) {
  const fill = color === "red" ? "#c0392b" : "#2563eb";
  const stroke = color === "red" ? "#7a1d13" : "#1e3a8a";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={
        corner
          ? { position: "absolute", bottom: 2, right: 2, zIndex: 2 }
          : undefined
      }
    >
      <circle cx="12" cy="13" r="8" fill={fill} stroke={stroke} strokeWidth="1.8" />
      <path
        d="M12 5 Q13 3 15 3"
        fill="none"
        stroke="#3a2a1a"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ForbiddenCross({ size }: { size: number }) {
  const inset = Math.round(size * 0.25);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      <line
        x1={inset} y1={inset}
        x2={size - inset} y2={size - inset}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={Math.max(2, Math.round(size * 0.05))}
        strokeLinecap="round"
      />
      <line
        x1={size - inset} y1={inset}
        x2={inset} y2={size - inset}
        stroke="rgba(255,255,255,0.55)"
        strokeWidth={Math.max(2, Math.round(size * 0.05))}
        strokeLinecap="round"
      />
    </svg>
  );
}

// --- Graph -----------------------------------------------------------------

function graphPos(sq: number, size: number): { x: number; y: number } {
  const cycleIdx = GRAPH_CYCLE.indexOf(sq as (typeof GRAPH_CYCLE)[number]);
  const pendantOffset = size * 0.16;
  const padding = size * 0.10;
  const R = (size - 2 * padding - pendantOffset) / 2;
  const cx = padding + R;
  const cy = size / 2;

  if (sq === 6) return { x: cx, y: cy };
  if (sq === 1) return { x: cx + R + pendantOffset, y: cy };

  const angle = -cycleIdx * (Math.PI / 4);
  return {
    x: cx + R * Math.cos(angle),
    y: cy + R * Math.sin(angle),
  };
}

function outwardDir(sq: number): { x: number; y: number } {
  const cycleIdx = GRAPH_CYCLE.indexOf(sq as (typeof GRAPH_CYCLE)[number]);
  if (cycleIdx >= 0) {
    const angle = -cycleIdx * (Math.PI / 4);
    return { x: Math.cos(angle), y: Math.sin(angle) };
  }
  if (sq === 1) return { x: 1, y: 0 };
  return { x: 0, y: -1 };
}

function KnightGraph({
  pieceBySq,
  fruitBySq,
  selectedId,
  size,
  faded = false,
}: {
  pieceBySq: Map<number, Piece>;
  fruitBySq?: Map<number, Fruit>;
  selectedId: number | null;
  size: number;
  faded?: boolean;
}) {
  const nodeR = Math.max(9, Math.round(size * 0.055));
  const fontSize = Math.max(9, Math.round(size * 0.05));
  const edgeWidth = Math.max(3, Math.round(size * 0.016));
  const fruitR = Math.max(6, Math.round(size * 0.032));
  const fruitGap = nodeR + fruitR + Math.round(size * 0.012);

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
      {EDGES.map(([a, b], i) => {
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

      {Object.keys(SQ_TO_RC).map((key) => {
        const sq = Number(key);
        const { x, y } = graphPos(sq, size);
        const here = pieceBySq.get(sq);
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

      {fruitBySq &&
        Array.from(fruitBySq.values()).map((f) => {
          const { x, y } = graphPos(f.sq, size);
          const dir = outwardDir(f.sq);
          const fx = x + dir.x * fruitGap;
          const fy = y + dir.y * fruitGap;
          const fill = f.color === "red" ? "#c0392b" : "#2563eb";
          const stroke = f.color === "red" ? "#7a1d13" : "#1e3a8a";
          return (
            <g key={`fruit-${f.sq}`}>
              <circle
                cx={fx}
                cy={fy}
                r={fruitR}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.6}
              />
              <path
                d={`M ${fx} ${fy - fruitR} Q ${fx + fruitR * 0.3} ${fy - fruitR * 1.6} ${fx + fruitR * 0.8} ${fy - fruitR * 1.4}`}
                fill="none"
                stroke="#3a2a1a"
                strokeWidth={1.3}
                strokeLinecap="round"
              />
            </g>
          );
        })}
    </svg>
  );
}
