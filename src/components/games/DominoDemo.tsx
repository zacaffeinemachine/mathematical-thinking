import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DominoBoard from "./dominoes/DominoBoard";
import { ROW_LABELS, simulate, type Bit } from "./dominoes/model";
import { DEMOS, type Demo } from "./dominoes/presets";

const SPEEDS = [
  { label: "1×", ms: 260 },
  { label: "2×", ms: 130 },
  { label: "4×", ms: 65 },
];

function btnStyle(enabled: boolean): React.CSSProperties {
  return {
    padding: "4px 12px",
    fontSize: 12,
    border: "1px solid var(--rule)",
    borderRadius: 4,
    background: enabled ? "var(--surface)" : "transparent",
    color: enabled ? "var(--ink)" : "var(--muted)",
    cursor: enabled ? "pointer" : "default",
    fontFamily: "ui-sans-serif, system-ui",
    opacity: enabled ? 1 : 0.6,
  };
}

function knobStyle(on: boolean): React.CSSProperties {
  return {
    padding: "4px 14px",
    fontSize: 12,
    fontFamily: "ui-monospace, monospace",
    fontWeight: 700,
    border: `1px solid ${on ? "var(--dom-front)" : "var(--rule)"}`,
    borderRadius: 999,
    background: on ? "var(--dom-front)" : "var(--surface)",
    color: on ? "#fff" : "var(--muted)",
    cursor: "pointer",
  };
}

export interface DominoDemoProps {
  /** Which preset to show, by id: "or" | "push-only" | "not" | "and". */
  demo: string;
  cellPx?: number;
  /** Start with these inputs latched. */
  initialA?: Bit;
  initialB?: Bit;
  showTable?: boolean;
  showCaption?: boolean;
}

export default function DominoDemo({
  demo,
  cellPx = 30,
  initialA = 0,
  initialB = 0,
  showTable = true,
  showCaption = true,
}: DominoDemoProps) {
  const preset: Demo | undefined = useMemo(
    () => DEMOS.find((d) => d.id === demo),
    [demo],
  );

  const [a, setA] = useState<Bit>(initialA);
  const [b, setB] = useState<Bit>(initialB);
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const timer = useRef<number | null>(null);

  const sim = useMemo(
    () => (preset ? simulate(preset.board, a, b) : null),
    [preset, a, b],
  );
  const lastTick = sim?.lastTick ?? 0;
  const done = tick >= lastTick;

  const stop = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    setPlaying(false);
  }, []);

  // Advance the clock while playing; halt when the run has settled.
  useEffect(() => {
    if (!playing) return;
    const ms = SPEEDS[speedIdx].ms;
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
    }, ms);
    return () => {
      if (timer.current !== null) {
        window.clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [playing, speedIdx, lastTick]);

  // Changing an input starts a fresh run.
  const setInput = useCallback(
    (which: "A" | "B", v: Bit) => {
      stop();
      setTick(0);
      if (which === "A") setA(v);
      else setB(v);
    },
    [stop],
  );

  const reset = useCallback(() => {
    stop();
    setTick(0);
  }, [stop]);

  const stepOnce = useCallback(() => {
    stop();
    setTick((t) => Math.min(t + 1, lastTick));
  }, [stop, lastTick]);

  const playAll = useCallback(() => {
    if (done) setTick(0);
    setPlaying(true);
  }, [done]);

  if (!preset) {
    return (
      <div style={{ color: "var(--muted)", fontSize: 13 }}>
        Unknown domino demo “{demo}”.
      </div>
    );
  }

  const outNow = sim && sim.out === 1 && tick >= (sim.lastTick ?? 0) ? 1 : null;

  return (
    <div style={{ margin: "28px 0" }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--ink)",
          textAlign: "center",
          marginBottom: 10,
        }}
      >
        {preset.title}
      </div>

      <DominoBoard
        board={preset.board}
        sim={sim}
        tick={tick}
        cellPx={cellPx}
        ariaLabel={preset.title}
      />

      {/* input knobs */}
      <div
        style={{
          display: "flex",
          gap: 16,
          justifyContent: "center",
          alignItems: "center",
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        {preset.inputs.includes("A") && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>A</span>
            <button
              onClick={() => setInput("A", a === 1 ? 0 : 1)}
              style={knobStyle(a === 1)}
              aria-pressed={a === 1}
            >
              {a}
            </button>
          </div>
        )}
        {preset.inputs.includes("B") && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 12, color: "var(--muted)" }}>B</span>
            <button
              onClick={() => setInput("B", b === 1 ? 0 : 1)}
              style={knobStyle(b === 1)}
              aria-pressed={b === 1}
            >
              {b}
            </button>
          </div>
        )}
      </div>

      {/* transport */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          alignItems: "center",
          marginTop: 10,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={playing ? stop : playAll}
          style={btnStyle(true)}
        >
          {playing ? "Pause" : done && tick > 0 ? "Play again" : "Play"}
        </button>
        <button onClick={stepOnce} style={btnStyle(!done)} disabled={done}>
          Step
        </button>
        <button onClick={reset} style={btnStyle(tick > 0)} disabled={tick === 0}>
          Reset
        </button>
        <div style={{ display: "flex", gap: 4, marginLeft: 4 }}>
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setSpeedIdx(i)}
              style={{
                ...btnStyle(true),
                padding: "4px 8px",
                background:
                  i === speedIdx ? "var(--accent-soft)" : "var(--surface)",
                color: i === speedIdx ? "var(--accent)" : "var(--muted)",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span
          style={{
            fontSize: 12,
            color: "var(--muted)",
            fontFamily: "ui-monospace, monospace",
            marginLeft: 4,
          }}
        >
          tick {tick}/{lastTick}
        </span>
      </div>

      {/* verdict */}
      <div
        style={{
          textAlign: "center",
          marginTop: 8,
          fontSize: 13,
          minHeight: 20,
          color: outNow ? "var(--dom-front)" : "var(--muted)",
          fontWeight: outNow ? 600 : 400,
        }}
      >
        {done && tick > 0
          ? sim?.out === 1
            ? "The output toppled — 1."
            : "The output is still standing — 0."
          : ""}
      </div>

      {showTable && (
        <DemoTable preset={preset} a={a} b={b} onPick={(na, nb) => {
          stop();
          setTick(0);
          setA(na);
          setB(nb);
        }} />
      )}

      {showCaption && (
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--muted)",
            marginTop: 14,
            maxWidth: 620,
            marginInline: "auto",
          }}
        >
          {preset.caption}
        </p>
      )}
    </div>
  );
}

function DemoTable({
  preset,
  a,
  b,
  onPick,
}: {
  preset: Demo;
  a: Bit;
  b: Bit;
  onPick: (a: Bit, b: Bit) => void;
}) {
  const twoInput = preset.inputs.includes("B");
  const rows = twoInput
    ? ROW_LABELS
    : ([
        [0, 0],
        [1, 0],
      ] as Array<[Bit, Bit]>);

  const td: React.CSSProperties = {
    padding: "3px 12px",
    fontFamily: "ui-monospace, monospace",
    fontSize: 12,
    textAlign: "center",
    color: "var(--ink)",
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", marginTop: 14 }}>
      <table style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--rule)" }}>
            <th style={td}>A</th>
            {twoInput && <th style={td}>B</th>}
            <th style={{ ...td, borderLeft: "1px solid var(--rule)" }}>out</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([ra, rb], i) => {
            const out = simulate(preset.board, ra, rb).out;
            const current = ra === a && (!twoInput || rb === b);
            return (
              <tr
                key={i}
                onClick={() => onPick(ra, rb)}
                style={{
                  background: current ? "var(--accent-soft)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <td style={td}>{ra}</td>
                {twoInput && <td style={td}>{rb}</td>}
                <td
                  style={{
                    ...td,
                    borderLeft: "1px solid var(--rule)",
                    color: out ? "var(--dom-front)" : "var(--muted)",
                    fontWeight: 700,
                  }}
                >
                  {out}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
