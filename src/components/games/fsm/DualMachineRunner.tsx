import { useEffect, useMemo, useRef, useState } from "react";
import type { FSM, State } from "./model";
import { run } from "./model";
import FSMGraph from "./FSMGraph";
import { BTN_CSS, CURRENT, CURRENT_INK, MONO, Tape, label } from "./parts";

type Rule = "OR" | "AND" | "XOR";

interface DualMachineRunnerProps {
  machineA: FSM;
  machineB: FSM;
  defaultInput?: string;
  examples?: string[];
  rules?: Rule[];
  initialRule?: Rule;
  // Per-machine SVG width.
  graphWidth?: number;
}

const SPEEDS = [
  { label: "1×", ms: 600 },
  { label: "2×", ms: 300 },
  { label: "4×", ms: 150 },
];

const RULE_LABELS: Record<Rule, string> = {
  OR: "A or B",
  AND: "A and B",
  XOR: "exactly one",
};

function stateAfter(machine: FSM, input: string, step: number): State | null {
  if (step === 0) return machine.start;
  const trace = run(machine, input).trace;
  const last = trace[step - 1];
  return last ? last.to : null;
}

export default function DualMachineRunner({
  machineA,
  machineB,
  defaultInput = "",
  examples = [],
  rules = ["OR", "AND", "XOR"],
  initialRule = "OR",
  graphWidth = 320,
}: DualMachineRunnerProps) {
  const [input, setInput] = useState(defaultInput);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [rule, setRule] = useState<Rule>(initialRule);

  const traceA = useMemo(() => run(machineA, input), [machineA, input]);
  const traceB = useMemo(() => run(machineB, input), [machineB, input]);

  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [input]);

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

  const aState = stateAfter(machineA, input, step);
  const bState = stateAfter(machineB, input, step);

  const lastEdgeA =
    step > 0 && traceA.trace[step - 1]?.to !== null
      ? { from: traceA.trace[step - 1].from, to: traceA.trace[step - 1].to as State }
      : null;
  const lastEdgeB =
    step > 0 && traceB.trace[step - 1]?.to !== null
      ? { from: traceB.trace[step - 1].from, to: traceB.trace[step - 1].to as State }
      : null;

  const aAcc = aState !== null && machineA.accepting.has(aState);
  const bAcc = bState !== null && machineB.accepting.has(bState);

  const verdictBool = (() => {
    if (rule === "OR") return aAcc || bAcc;
    if (rule === "AND") return aAcc && bAcc;
    return aAcc !== bAcc;
  })();

  const verdict: "accept" | "reject" | null = !finished
    ? null
    : verdictBool
    ? "accept"
    : "reject";

  return (
    <div style={{ marginTop: 16, marginBottom: 16 }}>
      {/* Rule selector */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 8,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            color: "var(--muted)",
            fontSize: 14,
            alignSelf: "center",
          }}
        >
          accept when:
        </span>
        <div
          style={{
            display: "inline-flex",
            border: "1px solid var(--rule)",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {rules.map((r) => (
            <button
              key={r}
              onClick={() => setRule(r)}
              style={{
                padding: "4px 12px",
                fontSize: 13,
                background: rule === r ? "var(--accent)" : "var(--surface)",
                color: rule === r ? "white" : "var(--ink)",
                border: "none",
                cursor: "pointer",
                fontFamily:
                  'ui-monospace, "JetBrains Mono", Menlo, monospace',
              }}
            >
              {RULE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Two graphs side by side */}
      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <div style={{ flex: "0 1 auto" }}>
          <div
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textAlign: "center",
              marginBottom: 4,
            }}
          >
            machine A {aAcc && finished ? "✓" : ""}
          </div>
          <FSMGraph
            machine={machineA}
            width={graphWidth}
            height={Math.round(graphWidth * 0.78)}
            currentState={aState}
            activeEdge={lastEdgeA}
            pulseKey={step}
          />
        </div>
        <div style={{ flex: "0 1 auto" }}>
          <div
            style={{
              fontSize: 13,
              color: "var(--muted)",
              textAlign: "center",
              marginBottom: 4,
            }}
          >
            machine B {bAcc && finished ? "✓" : ""}
          </div>
          <FSMGraph
            machine={machineB}
            width={graphWidth}
            height={Math.round(graphWidth * 0.78)}
            currentState={bState}
            activeEdge={lastEdgeB}
            pulseKey={step}
          />
        </div>
      </div>

      {/* Tape */}
      <div style={{ marginTop: 14 }}>
        <Tape
          input={input}
          step={step}
          finished={finished}
          emptyNote="no symbols to read: both machines stay where they start"
        />
      </div>

      {/* The pair trail. This is the product construction itself: the
          combined machine is in one place at a time, and that place is a
          pair. Reading it left to right shows the pair moving. */}
      <div style={{ marginTop: 10 }}>
        <PairTrail
          machineA={machineA}
          machineB={machineB}
          input={input}
          step={step}
        />
      </div>

      {/* What the verdict would be if the tape ran out here. True at every
          step, so it is always on screen: a line that comes and goes would
          shift the controls under the pointer. The height covers a
          two-line wrap on a narrow screen for the same reason. */}
      <div
        style={{
          textAlign: "center",
          marginTop: 2,
          minHeight: 32,
          fontSize: 12,
          color: "var(--muted)",
        }}
      >
        <span>
          A says {aAcc ? "yes" : "no"}, B says {bAcc ? "yes" : "no"}, so stop
          here and it is{" "}
          <span
            style={{
              color: verdictBool ? "var(--fsm-accept)" : "var(--muted)",
              fontWeight: 600,
            }}
          >
            {verdictBool ? "accepted" : "rejected"}
          </span>
          .
        </span>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginTop: 12,
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
          />
        </label>
        <button
          className="fsm-btn"
          onClick={() => {
            setPlaying(false);
            setStep((s) => Math.max(s - 1, 0));
          }}
          disabled={step === 0}
          title="one symbol back"
        >
          ◂ Back
        </button>
        <button
          className="fsm-btn"
          onClick={() => {
            if (input.length === 0) return;
            if (finished) {
              setStep(0);
              setPlaying(true);
            } else setPlaying((p) => !p);
          }}
          disabled={input.length === 0}
        >
          {playing ? "Pause" : finished ? "Replay" : "Play"}
        </button>
        <button
          className="fsm-btn"
          onClick={() => {
            if (finished) return;
            setPlaying(false);
            setStep((s) => Math.min(s + 1, input.length));
          }}
          disabled={finished || input.length === 0}
          title="one symbol forward"
        >
          Step ▸
        </button>
        <button
          className="fsm-btn"
          onClick={() => {
            setStep(0);
            setPlaying(false);
          }}
          disabled={step === 0 && !playing}
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
                background: speedIdx === i ? "var(--accent)" : "var(--surface)",
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
          <span style={{ color: "var(--fsm-accept)", fontWeight: 600 }}>
            ✓ accepted by the “{RULE_LABELS[rule]}” rule
          </span>
        )}
        {verdict === "reject" && (
          <span style={{ color: "var(--fsm-reject)", fontWeight: 600 }}>
            ✗ rejected by the “{RULE_LABELS[rule]}” rule
          </span>
        )}
      </div>

      <style>{BTN_CSS}</style>
    </div>
  );
}

// ---------------------------------------------------------------------
//  The pair trail
// ---------------------------------------------------------------------

function PairTrail({
  machineA,
  machineB,
  input,
  step,
}: {
  machineA: FSM;
  machineB: FSM;
  input: string;
  step: number;
}) {
  const traceA = run(machineA, input).trace;
  const traceB = run(machineB, input).trace;
  const pairs: { a: State | null; b: State | null; symbol: string | null }[] = [
    { a: machineA.start, b: machineB.start, symbol: null },
  ];
  for (let i = 0; i < input.length; i++) {
    pairs.push({
      a: traceA[i]?.to ?? null,
      b: traceB[i]?.to ?? null,
      symbol: traceA[i]?.symbol ?? "?",
    });
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        minHeight: 32,
        fontFamily: MONO,
        fontSize: 13,
        lineHeight: 1.9,
      }}
    >
      {pairs.map((p, i) => {
        const current = i === step;
        const bothIn = p.a !== null && p.b !== null;
        return (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              // Hops not yet taken keep their space but stay invisible, so
              // the row never grows and the controls never shift.
              visibility: i <= step ? "visible" : "hidden",
            }}
          >
            {p.symbol !== null && (
              <span style={{ color: "var(--muted)", padding: "0 1px" }}>
                {"─"}
                <span style={{ color: "var(--ink)" }}>{p.symbol}</span>
                {"─▸"}
              </span>
            )}
            <span
              style={{
                display: "inline-block",
                padding: "4px 10px",
                borderRadius: 999,
                lineHeight: 1.15,
                whiteSpace: "nowrap",
                border: `1.5px solid ${current ? CURRENT_INK : "var(--rule)"}`,
                background: current ? CURRENT : "var(--surface)",
                color: current ? CURRENT_INK : "var(--ink)",
              }}
            >
              {bothIn
                ? `(${label(machineA, p.a as State)}, ${label(machineB, p.b as State)})`
                : "off the diagram"}
            </span>
          </span>
        );
      })}
    </div>
  );
}
