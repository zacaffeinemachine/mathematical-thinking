import { useEffect, useMemo, useRef, useState } from "react";
import type { FSM, State } from "./model";
import { run } from "./model";
import FSMGraph from "./FSMGraph";

interface FSMRunnerProps {
  machine: FSM;
  defaultInput?: string;
  examples?: string[];
  // Width of the SVG. Height defaults to width * 0.62.
  width?: number;
}

const SPEEDS = [
  { label: "1×", ms: 600 },
  { label: "2×", ms: 300 },
  { label: "4×", ms: 150 },
];

export default function FSMRunner({
  machine,
  defaultInput = "",
  examples = [],
  width = 520,
}: FSMRunnerProps) {
  const [input, setInput] = useState(defaultInput);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);

  const result = useMemo(() => run(machine, input), [machine, input]);

  // Reset when input changes.
  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [input]);

  // Auto-advance when playing.
  const timerRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    if (step >= input.length) {
      setPlaying(false);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      setStep((s) => s + 1);
    }, SPEEDS[speedIdx].ms);
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [playing, step, input.length, speedIdx]);

  const finished = step >= input.length;

  // Derive current state and most recent transition from the trace.
  const { currentState, trapped, lastEdge } = useMemo(() => {
    if (step === 0) {
      return {
        currentState: machine.start as State | null,
        trapped: false,
        lastEdge: null as { from: State; to: State } | null,
      };
    }
    const last = result.trace[step - 1];
    if (!last) {
      return { currentState: machine.start, trapped: false, lastEdge: null };
    }
    if (last.to === null) {
      return { currentState: null, trapped: true, lastEdge: null };
    }
    return {
      currentState: last.to,
      trapped: false,
      lastEdge: { from: last.from, to: last.to },
    };
  }, [step, result, machine.start]);

  // Verdict only after the whole tape is consumed.
  const verdict = finished
    ? trapped
      ? "reject"
      : currentState !== null && machine.accepting.has(currentState)
      ? "accept"
      : "reject"
    : null;

  const symbols = [...input];

  return (
    <div className="fsm-runner" style={{ marginTop: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <FSMGraph
          machine={machine}
          width={width}
          height={Math.round(width * 0.62)}
          currentState={currentState}
          trapped={trapped}
          activeEdge={lastEdge}
          pulseKey={step}
        />
      </div>

      {/* Tape */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: 14,
          flexWrap: "wrap",
          gap: 4,
        }}
      >
        {symbols.length === 0 ? (
          <span
            style={{
              color: "var(--muted)",
              fontStyle: "italic",
              fontSize: 14,
            }}
          >
            empty input — press Play to see the start state accept/reject
          </span>
        ) : (
          symbols.map((sym, i) => {
            const consumed = i < step;
            const isHead = i === step && !finished;
            return (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 28,
                  height: 32,
                  padding: "0 6px",
                  border: `2px solid ${
                    isHead ? "var(--accent)" : "var(--rule)"
                  }`,
                  borderRadius: 4,
                  background: consumed
                    ? "var(--rule)"
                    : isHead
                    ? "var(--surface)"
                    : "transparent",
                  color: consumed ? "var(--muted)" : "var(--ink)",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 16,
                }}
              >
                {sym}
              </span>
            );
          })
        )}
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginTop: 14,
        }}
      >
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            color: "var(--muted)",
          }}
        >
          input:
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: 15,
              padding: "4px 8px",
              border: "1px solid var(--rule)",
              borderRadius: 4,
              background: "var(--surface)",
              color: "var(--ink)",
              minWidth: 160,
            }}
            placeholder={`alphabet: ${machine.alphabet.join(", ")}`}
          />
        </label>

        <button
          onClick={() => {
            if (input.length === 0) return;
            if (finished) {
              setStep(0);
              setPlaying(true);
            } else {
              setPlaying((p) => !p);
            }
          }}
          disabled={input.length === 0}
          className="fsm-btn"
        >
          {playing ? "Pause" : finished ? "Replay" : "Play"}
        </button>

        <button
          onClick={() => {
            if (finished) return;
            setPlaying(false);
            setStep((s) => Math.min(s + 1, input.length));
          }}
          disabled={finished || input.length === 0}
          className="fsm-btn"
        >
          Step
        </button>

        <button
          onClick={() => {
            setStep(0);
            setPlaying(false);
          }}
          disabled={step === 0 && !playing}
          className="fsm-btn"
        >
          Reset
        </button>

        <div
          style={{
            display: "inline-flex",
            border: "1px solid var(--rule)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {SPEEDS.map((s, i) => (
            <button
              key={s.label}
              onClick={() => setSpeedIdx(i)}
              style={{
                padding: "4px 10px",
                fontSize: 13,
                background:
                  speedIdx === i ? "var(--accent)" : "var(--surface)",
                color: speedIdx === i ? "white" : "var(--ink)",
                border: "none",
                cursor: "pointer",
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Examples */}
      {examples.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 6,
            marginTop: 10,
            fontSize: 13,
          }}
        >
          <span style={{ color: "var(--muted)", alignSelf: "center" }}>
            try:
          </span>
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => setInput(ex)}
              style={{
                padding: "2px 8px",
                background: "transparent",
                border: "1px solid var(--rule)",
                borderRadius: 999,
                color: "var(--ink)",
                fontFamily: "ui-monospace, monospace",
                cursor: "pointer",
              }}
            >
              {ex.length === 0 ? "(empty)" : ex}
            </button>
          ))}
        </div>
      )}

      {/* Verdict */}
      <div
        style={{
          textAlign: "center",
          marginTop: 14,
          minHeight: 24,
          fontSize: 15,
        }}
      >
        {verdict === "accept" && (
          <span style={{ color: "#1b9a4d", fontWeight: 600 }}>
            ✓ accepted — finished in <code>{currentState}</code>
          </span>
        )}
        {verdict === "reject" && !trapped && (
          <span style={{ color: "#c0392b", fontWeight: 600 }}>
            ✗ rejected — finished in <code>{currentState}</code>
          </span>
        )}
        {verdict === "reject" && trapped && (
          <span style={{ color: "#c0392b", fontWeight: 600 }}>
            ✗ rejected — no transition for that symbol
          </span>
        )}
      </div>

      {/* Run log */}
      {step > 0 && (
        <details
          style={{
            marginTop: 12,
            fontSize: 13,
            color: "var(--muted)",
            textAlign: "center",
          }}
        >
          <summary style={{ cursor: "pointer", listStyle: "none" }}>
            run log ▾
          </summary>
          <div
            style={{
              fontFamily: "ui-monospace, monospace",
              marginTop: 6,
              lineHeight: 1.6,
            }}
          >
            {result.trace.slice(0, step).map((t, i) => (
              <div key={i}>
                {t.to === null
                  ? `${t.from} ──${t.symbol}──▶ (no transition)`
                  : `${t.from} ──${t.symbol}──▶ ${t.to}`}
              </div>
            ))}
          </div>
        </details>
      )}

      <style>{`
        .fsm-btn {
          padding: 4px 12px;
          font-size: 14px;
          background: var(--surface);
          color: var(--ink);
          border: 1px solid var(--rule);
          border-radius: 4px;
          cursor: pointer;
        }
        .fsm-btn:hover:not(:disabled) {
          border-color: var(--accent);
        }
        .fsm-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
