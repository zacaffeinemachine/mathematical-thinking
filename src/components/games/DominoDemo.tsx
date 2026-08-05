import { useCallback, useEffect, useMemo, useState } from "react";
import DominoBoard from "./dominoes/DominoBoard";
import { useClock } from "./dominoes/useClock";
import { ROW_LABELS, simulate, type Bit } from "./dominoes/model";
import { DEMOS, type Demo } from "./dominoes/presets";

// Ticks per second. One tick is one cell of travel, and a tile spends
// most of a tick visibly going over, so these are deliberately unhurried:
// the default used to be four times faster and the wavefront was easy to
// miss entirely.
const SPEEDS = [
  { label: "½×", tps: 1.25 },
  { label: "1×", tps: 2.5 },
  { label: "2×", tps: 5 },
  { label: "4×", tps: 10 },
];
const DEFAULT_SPEED = 1;

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
  /** Preset id: "run" | "or" | "push-only" | "not" | "and". */
  demo: string;
  cellPx?: number;
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
  const [speedIdx, setSpeedIdx] = useState(DEFAULT_SPEED);

  const sim = useMemo(
    () => (preset ? simulate(preset.board, a, b) : null),
    [preset, a, b],
  );
  const lastTick = sim?.lastTick ?? 0;

  const clock = useClock(lastTick, SPEEDS[speedIdx].tps);
  const { time, playing, play, stop, step, reset, restart, end } = clock;
  const settled = time >= end;

  // Changing an input starts a fresh run.
  const setInput = useCallback(
    (which: "A" | "B", v: Bit) => {
      restart();
      if (which === "A") setA(v);
      else setB(v);
    },
    [restart],
  );

  useEffect(() => stop, [stop]);

  if (!preset) {
    return (
      <div style={{ color: "var(--muted)", fontSize: 13 }}>
        Unknown domino demo “{demo}”.
      </div>
    );
  }

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
        time={time}
        cellPx={cellPx}
        ariaLabel={preset.title}
      />

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
        <button onClick={playing ? stop : play} style={btnStyle(true)}>
          {playing ? "Pause" : settled && time > 0 ? "Play again" : "Play"}
        </button>
        <button onClick={step} style={btnStyle(!settled)} disabled={settled}>
          Step
        </button>
        <button onClick={reset} style={btnStyle(time > 0)} disabled={time === 0}>
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
          tick {Math.min(Math.floor(time), lastTick)}/{lastTick}
        </span>
      </div>

      <div
        style={{
          textAlign: "center",
          marginTop: 8,
          fontSize: 13,
          minHeight: 20,
          color: sim?.out === 1 ? "var(--dom-front)" : "var(--muted)",
          fontWeight: sim?.out === 1 ? 600 : 400,
        }}
      >
        {settled && time > 0
          ? sim?.out === 1
            ? "The output toppled — 1."
            : "The output is still standing — 0."
          : ""}
      </div>

      {showTable && (
        <DemoTable
          preset={preset}
          a={a}
          b={b}
          onPick={(na, nb) => {
            restart();
            setA(na);
            setB(nb);
          }}
        />
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
