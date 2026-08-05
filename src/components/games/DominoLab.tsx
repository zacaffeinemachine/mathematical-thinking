import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DominoBoard from "./dominoes/DominoBoard";
import {
  ROW_LABELS,
  cellAt,
  parseBoard,
  simulate,
  truthTable,
  withCell,
  type Bit,
  type Board,
  type CellKind,
  type Dir,
} from "./dominoes/model";
import { TASKS, lockedMask, type Task } from "./dominoes/presets";

type Tool = "tile" | "knock" | "power" | "erase";

const TOOL_LABEL: Record<Tool, string> = {
  tile: "Domino",
  knock: "Sideways tile",
  power: "Free run",
  erase: "Eraser",
};

const TOOL_HELP: Record<Tool, string> = {
  tile: "A standing domino. Falls when a neighbour falls, and passes the fall on.",
  knock:
    "Falls sideways: it does NOT pass the fall on. Instead it ejects the tile it points at, leaving a gap that stops any run through that square.",
  power:
    "A run that topples at tick 0 whatever the inputs do — the only piece that does anything when both inputs are 0.",
  erase: "Clear a square. Inputs and the output cannot be erased.",
};

const DIR_ARROW: Record<Dir, string> = {
  up: "↑",
  right: "→",
  down: "↓",
  left: "←",
};

const FREE_PLAY: Task = {
  id: "free",
  title: "Free play",
  goal: "No target — build whatever you like and read its table off the panel on the right.",
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
  table: [],
  inputs: ["A", "B"],
  hint: "Nothing to solve here. Try to find a table you cannot build, and see whether you can say why.",
  solution: parseBoard([
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
};

const ALL: Task[] = [...TASKS, FREE_PLAY];

function btnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "5px 12px",
    fontSize: 12,
    border: `1px solid ${active ? "var(--accent)" : "var(--rule)"}`,
    borderRadius: 4,
    background: active ? "var(--accent-soft)" : "var(--surface)",
    color: active ? "var(--accent)" : "var(--ink)",
    cursor: "pointer",
    fontFamily: "ui-sans-serif, system-ui",
  };
}

export default function DominoLab({ cellPx = 28 }: { cellPx?: number }) {
  const [taskIdx, setTaskIdx] = useState(0);
  const task = ALL[taskIdx];

  const [board, setBoard] = useState<Board>(task.start);
  const [tool, setTool] = useState<Tool>("tile");
  const [knockDir, setKnockDir] = useState<Dir>("up");
  const [a, setA] = useState<Bit>(1);
  const [b, setB] = useState<Bit>(1);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const timer = useRef<number | null>(null);

  const locked = useMemo(() => lockedMask(task), [task]);

  // Switching task loads a fresh board.
  useEffect(() => {
    setBoard(task.start);
    setTick(0);
    setPlaying(false);
    setRevealed(false);
    setTool("tile");
  }, [task]);

  const sim = useMemo(() => simulate(board, a, b), [board, a, b]);
  const lastTick = sim.lastTick;
  const done = tick >= lastTick;

  const got = useMemo(() => truthTable(board), [board]);
  // A one-input task says nothing about the rows where B topples, and its
  // panel does not show them — so they must not decide whether it is solved.
  const checkedRows = useMemo(
    () => (task.inputs.includes("B") ? [0, 1, 2, 3] : [0, 2]),
    [task],
  );
  const solved =
    task.table.length === 4 &&
    checkedRows.every((i) => got[i] === task.table[i]);

  const stop = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    setPlaying(false);
  }, []);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setTick((t) => {
        if (t >= lastTick) {
          if (timer.current !== null) {
            window.clearInterval(timer.current);
            timer.current = null;
          }
          setPlaying(false);
          return t;
        }
        return t + 1;
      });
    }, 130);
    return () => {
      if (timer.current !== null) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [playing, lastTick]);

  const paint = useCallback(
    (x: number, y: number) => {
      const i = y * board.width + x;
      if (locked[i]) return;
      stop();
      setTick(0);
      setBoard((bd) => {
        const cur = cellAt(bd, x, y);
        if (tool === "erase") {
          return cur.kind === "empty" ? bd : withCell(bd, x, y, { kind: "empty" });
        }
        if (tool === "knock") {
          // Clicking an existing knock rotates it rather than replacing it.
          if (cur.kind === "knock") {
            const order: Dir[] = ["up", "right", "down", "left"];
            const next = order[(order.indexOf(cur.dir ?? "up") + 1) % 4];
            return withCell(bd, x, y, { kind: "knock", dir: next });
          }
          return withCell(bd, x, y, { kind: "knock", dir: knockDir });
        }
        const kind: CellKind = tool === "power" ? "power" : "tile";
        if (cur.kind === kind) return bd;
        return withCell(bd, x, y, { kind });
      });
    },
    [board.width, locked, stop, tool, knockDir],
  );

  const dragPaint = useCallback(
    (x: number, y: number) => {
      // Dragging lays a run of plain tiles; the other tools are one-shot.
      if (tool !== "tile" && tool !== "erase") return;
      paint(x, y);
    },
    [paint, tool],
  );

  const clearBoard = useCallback(() => {
    stop();
    setTick(0);
    setRevealed(false);
    setBoard(task.start);
  }, [stop, task]);

  const showSolution = useCallback(() => {
    stop();
    setTick(0);
    setRevealed(true);
    setBoard(task.solution);
  }, [stop, task]);

  const setInput = useCallback(
    (which: "A" | "B", v: Bit) => {
      stop();
      setTick(0);
      if (which === "A") setA(v);
      else setB(v);
    },
    [stop],
  );

  const palette: Tool[] = [...(task.palette as Tool[]), "erase"];

  return (
    <div style={{ margin: "28px 0" }}>
      {/* task picker */}
      <div
        style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        {ALL.map((t, i) => (
          <button
            key={t.id}
            onClick={() => setTaskIdx(i)}
            style={btnStyle(i === taskIdx)}
          >
            {t.title}
          </button>
        ))}
      </div>

      <div
        style={{
          padding: "10px 14px",
          border: "1px solid var(--rule)",
          borderRadius: 6,
          background: "var(--surface)",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "var(--ink)" }}>
          {task.goal}
        </div>
        <details style={{ marginTop: 6 }}>
          <summary
            style={{ fontSize: 12, color: "var(--muted)", cursor: "pointer" }}
          >
            Hint
          </summary>
          <div
            style={{
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "var(--muted)",
              marginTop: 6,
            }}
          >
            {task.hint}
          </div>
        </details>
      </div>

      <div
        style={{
          display: "flex",
          gap: 18,
          alignItems: "flex-start",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {/* board */}
        <div style={{ flex: "1 1 420px", minWidth: 300, maxWidth: 560 }}>
          <DominoBoard
            board={board}
            sim={sim}
            tick={tick}
            cellPx={cellPx}
            locked={locked}
            onCellClick={paint}
            onCellDrag={dragPaint}
            showGrid
            ariaLabel={`${task.title} build area`}
          />

          {/* palette */}
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginTop: 10,
              alignItems: "center",
            }}
          >
            {palette.map((t) => (
              <button key={t} onClick={() => setTool(t)} style={btnStyle(tool === t)}>
                {TOOL_LABEL[t]}
              </button>
            ))}
            {tool === "knock" && (
              <span style={{ display: "inline-flex", gap: 3, marginLeft: 4 }}>
                {(["up", "right", "down", "left"] as Dir[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setKnockDir(d)}
                    style={{
                      ...btnStyle(knockDir === d),
                      padding: "5px 9px",
                      fontFamily: "ui-monospace, monospace",
                    }}
                    aria-label={`knock ${d}`}
                  >
                    {DIR_ARROW[d]}
                  </button>
                ))}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--muted)",
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            {TOOL_HELP[tool]}
            {tool === "tile" && " Drag to lay a run."}
            {tool === "knock" &&
              " Click a sideways tile again to turn it."}
          </div>
        </div>

        {/* side panel */}
        <div style={{ flex: "0 1 260px", minWidth: 230 }}>
          <Panel title="Run it">
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 12, color: "var(--muted)" }}>A</span>
              <button
                onClick={() => setInput("A", a === 1 ? 0 : 1)}
                style={{
                  ...btnStyle(a === 1),
                  fontFamily: "ui-monospace, monospace",
                  fontWeight: 700,
                }}
              >
                {a}
              </button>
              {task.inputs.includes("B") && (
                <>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>B</span>
                  <button
                    onClick={() => setInput("B", b === 1 ? 0 : 1)}
                    style={{
                      ...btnStyle(b === 1),
                      fontFamily: "ui-monospace, monospace",
                      fontWeight: 700,
                    }}
                  >
                    {b}
                  </button>
                </>
              )}
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => {
                  if (done) setTick(0);
                  setPlaying(!playing);
                }}
                style={btnStyle(false)}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <button
                onClick={() => {
                  stop();
                  setTick((t) => Math.min(t + 1, lastTick));
                }}
                style={btnStyle(false)}
              >
                Step
              </button>
              <button
                onClick={() => {
                  stop();
                  setTick(0);
                }}
                style={btnStyle(false)}
              >
                Reset
              </button>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--muted)",
                fontFamily: "ui-monospace, monospace",
                marginTop: 6,
              }}
            >
              tick {tick}/{lastTick} · out {done ? sim.out : "…"}
            </div>
          </Panel>

          <Panel title="What it does">
            <ResultTable
              got={got}
              want={task.table.length === 4 ? task.table : null}
              rows={checkedRows}
            />
            {task.table.length === 4 && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  color: solved ? "var(--dom-front)" : "var(--muted)",
                }}
              >
                {solved
                  ? revealed
                    ? "That is one that works."
                    : "Solved — every row matches."
                  : "Not there yet."}
              </div>
            )}
          </Panel>

          <Panel title="Board">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={clearBoard} style={btnStyle(false)}>
                Clear
              </button>
              {task.id !== "free" && (
                <button onClick={showSolution} style={btnStyle(false)}>
                  Show me one that works
                </button>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--rule)",
        borderRadius: 6,
        padding: "10px 12px",
        marginBottom: 10,
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--muted)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function ResultTable({
  got,
  want,
  rows,
}: {
  got: Bit[];
  want: Bit[] | null;
  rows: number[];
}) {
  const twoInput = rows.length === 4;
  const rowIdx = rows;

  const td: React.CSSProperties = {
    padding: "3px 10px",
    fontFamily: "ui-monospace, monospace",
    fontSize: 12,
    textAlign: "center",
    color: "var(--ink)",
  };

  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--rule)" }}>
          <th style={td}>A</th>
          {twoInput && <th style={td}>B</th>}
          <th style={{ ...td, borderLeft: "1px solid var(--rule)" }}>yours</th>
          {want && <th style={td}>wanted</th>}
        </tr>
      </thead>
      <tbody>
        {rowIdx.map((i) => {
          const [ra, rb] = ROW_LABELS[i];
          const ok = !want || got[i] === want[i];
          return (
            <tr key={i} style={{ background: ok ? "transparent" : "var(--accent-soft)" }}>
              <td style={td}>{ra}</td>
              {twoInput && <td style={td}>{rb}</td>}
              <td
                style={{
                  ...td,
                  borderLeft: "1px solid var(--rule)",
                  color: got[i] ? "var(--dom-front)" : "var(--muted)",
                  fontWeight: 700,
                }}
              >
                {got[i]}
              </td>
              {want && (
                <td style={{ ...td, color: "var(--muted)" }}>{want[i]}</td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
