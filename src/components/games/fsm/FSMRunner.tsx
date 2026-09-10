import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FSM, State } from "./model";
import { run, shortlexUpTo } from "./model";
import FSMGraph from "./FSMGraph";
import {
  BTN_CSS,
  LivePill,
  MONO,
  Tape,
  Trail,
  VerdictLine,
} from "./parts";

interface SweepSpec {
  // Show every input of length 0, 1, ... up to this.
  maxLength: number;
  // Overrides the default caption above the panel.
  caption?: string;
  // Start with the panel open. Defaults to true.
  open?: boolean;
}

interface FSMRunnerProps {
  machine: FSM;
  defaultInput?: string;
  examples?: string[];
  // Width of the SVG. Height defaults to width * 0.62.
  width?: number;
  // When given, a panel of every short input appears below the controls,
  // each one coloured by its verdict and clickable. "Run them all" walks
  // the whole list in order.
  sweep?: SweepSpec;
}

const SPEEDS = [
  { label: "1×", ms: 600 },
  { label: "2×", ms: 300 },
  { label: "4×", ms: 150 },
];

// Pause between two strings when the sweep is walking the whole list, long
// enough to read the verdict before the next one starts.
const SWEEP_GAP_MS = 750;

const STATUS_ROW: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  minHeight: 22,
  fontSize: 13,
  color: "var(--muted)",
  textAlign: "center",
};

export default function FSMRunner({
  machine,
  defaultInput = "",
  examples = [],
  width = 520,
  sweep,
}: FSMRunnerProps) {
  const [input, setInput] = useState(defaultInput);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [sweeping, setSweeping] = useState(false);
  const [sweepIdx, setSweepIdx] = useState(-1);

  const result = useMemo(() => run(machine, input), [machine, input]);
  const finished = step >= input.length;

  // Every change of input goes through here, so that "load this string and
  // start it" is a single act. An earlier version reset the step inside an
  // effect on `input`, which cancelled the play the sweep had just asked
  // for.
  const load = useCallback((next: string, autoplay: boolean) => {
    setInput(next);
    setStep(0);
    setPlaying(autoplay && next.length > 0);
  }, []);

  // Auto-advance while playing.
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

  // ------------------------------------------------------------------
  //  The sweep: every short input, one after another.
  // ------------------------------------------------------------------
  const sweepList = useMemo(
    () => (sweep ? shortlexUpTo(machine.alphabet, sweep.maxLength, 96) : []),
    [machine, sweep?.maxLength],
  );

  useEffect(() => {
    if (!sweeping) return;
    if (playing || !finished) return;
    const t = window.setTimeout(() => {
      const next = sweepIdx + 1;
      if (next >= sweepList.length) {
        setSweeping(false);
        return;
      }
      setSweepIdx(next);
      load(sweepList[next], true);
    }, SWEEP_GAP_MS);
    return () => window.clearTimeout(t);
  }, [sweeping, playing, finished, sweepIdx, sweepList, load]);

  // Where the machine stands, and which arrow it just took.
  const { currentState, trapped, lastEdge } = useMemo(() => {
    if (step === 0) {
      return {
        currentState: machine.start as State | null,
        trapped: false,
        lastEdge: null as { from: State; to: State } | null,
      };
    }
    const last = result.trace[step - 1];
    if (!last) return { currentState: machine.start, trapped: false, lastEdge: null };
    if (last.to === null) return { currentState: null, trapped: true, lastEdge: null };
    return { currentState: last.to, trapped: false, lastEdge: { from: last.from, to: last.to } };
  }, [step, result, machine.start]);

  const wouldAccept =
    currentState !== null && !trapped && machine.accepting.has(currentState);

  // The whole walk, every time. `Trail` hides the hops not yet taken rather
  // than leaving them out, so the box never changes size mid-run.
  const hops = result.trace.map((t) => ({ symbol: t.symbol, to: t.to }));
  const gloss = machine.meaning && currentState ? machine.meaning[currentState] : undefined;
  // The longest gloss this machine can ever print. An invisible copy of the
  // status line carrying it reserves the row's height, so a short gloss
  // followed by a long one does not shove the controls down.
  const longestGloss = useMemo(() => {
    if (!machine.meaning) return "";
    return Object.values(machine.meaning).reduce(
      (a, b) => (b.length > a.length ? b : a),
      "",
    );
  }, [machine]);

  const stopSweep = () => {
    setSweeping(false);
    setSweepIdx(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      stopSweep();
      setPlaying(false);
      setStep((s) => Math.min(s + 1, input.length));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      stopSweep();
      setPlaying(false);
      setStep((s) => Math.max(s - 1, 0));
    }
  };

  return (
    <div
      className="fsm-runner"
      style={{ marginTop: 16, marginBottom: 16, outline: "none" }}
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
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

      <div style={{ marginTop: 14 }}>
        <Tape input={input} step={step} finished={finished} />
      </div>

      {/* The road so far. */}
      <div style={{ marginTop: 10 }}>
        <Trail machine={machine} hops={hops} revealed={step} />
      </div>

      {/* What the machine is holding on to at this instant, and what the
          verdict would be if the tape ran out here. The real line is laid
          over an invisible worst-case copy of itself: nothing here may
          change height as the machine walks, or the buttons below move. */}
      <div style={{ position: "relative", marginTop: 4 }}>
        <div style={{ ...STATUS_ROW, visibility: "hidden" }} aria-hidden="true">
          {longestGloss && (
            <span style={{ maxWidth: "44ch" }}>
              <span>remembering: </span>
              <span>{longestGloss}</span>
            </span>
          )}
          <LivePill would={false} />
          {input.length > 0 && (
            <span style={{ fontFamily: MONO, fontSize: 12 }}>
              {input.length} of {input.length} read
            </span>
          )}
        </div>
        <div style={{ ...STATUS_ROW, position: "absolute", inset: 0 }}>
          {gloss && (
            <span style={{ maxWidth: "44ch" }}>
              <span style={{ color: "var(--muted)" }}>remembering: </span>
              <span style={{ color: "var(--ink)" }}>{gloss}</span>
            </span>
          )}
          <span style={{ visibility: finished ? "hidden" : "visible" }}>
            <LivePill would={wouldAccept} />
          </span>
          {input.length > 0 && (
            <span style={{ fontFamily: MONO, fontSize: 12 }}>
              {step} of {input.length} read
            </span>
          )}
        </div>
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
            onChange={(e) => {
              stopSweep();
              load(e.target.value, false);
            }}
            spellCheck={false}
            style={{
              fontFamily: MONO,
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
            stopSweep();
            setPlaying(false);
            setStep((s) => Math.max(s - 1, 0));
          }}
          disabled={step === 0}
          className="fsm-btn"
          title="one symbol back"
        >
          ◂ Back
        </button>

        <button
          onClick={() => {
            if (input.length === 0) return;
            stopSweep();
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
            stopSweep();
            setPlaying(false);
            setStep((s) => Math.min(s + 1, input.length));
          }}
          disabled={finished || input.length === 0}
          className="fsm-btn"
          title="one symbol forward"
        >
          Step ▸
        </button>

        <button
          onClick={() => {
            stopSweep();
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

      {/* Hand-picked inputs */}
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
          <span style={{ color: "var(--muted)", alignSelf: "center" }}>try:</span>
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                stopSweep();
                load(ex, true);
              }}
              className="fsm-chip"
            >
              {ex.length === 0 ? "(empty)" : ex}
            </button>
          ))}
        </div>
      )}

      {/* Verdict */}
      <div style={{ textAlign: "center", marginTop: 14, minHeight: 24, fontSize: 15 }}>
        {finished && (
          <VerdictLine
            accepted={wouldAccept}
            state={currentState}
            machine={machine}
            trapped={trapped}
          />
        )}
      </div>

      {sweep && (
        <SweepPanel
          machine={machine}
          list={sweepList}
          maxLength={sweep.maxLength}
          caption={sweep.caption}
          open={sweep.open ?? true}
          current={input}
          sweeping={sweeping}
          onPick={(s) => {
            stopSweep();
            load(s, true);
          }}
          onToggleSweep={() => {
            if (sweeping) {
              setSweeping(false);
              setPlaying(false);
              return;
            }
            setSweeping(true);
            setSweepIdx(0);
            load(sweepList[0], true);
          }}
        />
      )}

      <style>{BTN_CSS}</style>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Every short input at once
// ---------------------------------------------------------------------

function SweepPanel({
  machine,
  list,
  maxLength,
  caption,
  open,
  current,
  sweeping,
  onPick,
  onToggleSweep,
}: {
  machine: FSM;
  list: string[];
  maxLength: number;
  caption?: string;
  open: boolean;
  current: string;
  sweeping: boolean;
  onPick: (s: string) => void;
  onToggleSweep: () => void;
}) {
  const verdicts = useMemo(
    () => list.map((s) => run(machine, s).accepted),
    [machine, list],
  );
  const nAccepted = verdicts.filter(Boolean).length;

  // Group by length so the reader can see the answer settle down as the
  // strings get longer.
  const rows = useMemo(() => {
    const byLen = new Map<number, { s: string; ok: boolean }[]>();
    list.forEach((s, i) => {
      const arr = byLen.get(s.length) ?? [];
      arr.push({ s, ok: verdicts[i] });
      byLen.set(s.length, arr);
    });
    return [...byLen.entries()].sort((a, b) => a[0] - b[0]);
  }, [list, verdicts]);

  return (
    <details open={open} style={{ marginTop: 18 }}>
      <summary
        style={{
          cursor: "pointer",
          fontSize: 13,
          color: "var(--muted)",
          textAlign: "center",
          listStyle: "none",
        }}
      >
        {caption ?? `every input of length at most ${maxLength}`} ▾
      </summary>

      <div
        style={{
          marginTop: 10,
          padding: "12px 14px",
          border: "1px solid var(--rule)",
          borderRadius: 6,
          background: "var(--surface)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 10,
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          <span>
            {nAccepted} of {list.length} accepted. Click any one to watch it run.
          </span>
          <button onClick={onToggleSweep} className="fsm-btn">
            {sweeping ? "Stop" : "Run them all"}
          </button>
        </div>

        {rows.map(([len, items]) => (
          <div
            key={len}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              padding: "4px 0",
              borderTop: "1px solid var(--rule)",
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "var(--muted)",
                minWidth: 62,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                paddingTop: 4,
              }}
            >
              length {len}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {items.map(({ s, ok }) => {
                const selected = s === current;
                return (
                  <button
                    key={s || "(empty)"}
                    onClick={() => onPick(s)}
                    style={{
                      fontFamily: MONO,
                      fontSize: 13,
                      padding: "2px 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                      border: ok
                        ? "1px solid var(--fsm-accept)"
                        : "1px dashed var(--rule)",
                      background: ok ? "var(--fsm-accept-soft)" : "transparent",
                      color: ok ? "var(--ink)" : "var(--muted)",
                      outline: selected ? "2px solid var(--accent)" : "none",
                      outlineOffset: 1,
                    }}
                    title={ok ? "accepted" : "rejected"}
                  >
                    {s.length === 0 ? "(empty)" : s}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
          Solid azure: accepted. Dashed grey: rejected. The accepted ones,
          taken together, are the language of this machine.
        </div>
      </div>
    </details>
  );
}
