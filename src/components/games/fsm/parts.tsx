// Pieces shared by FSMRunner, DualMachineRunner and FSMTraceTable.
//
// The tape and the trail are the two things a student actually watches:
// the tape says what is left to read, the trail says where the machine
// has been. Keeping them here means both runners show the same thing in
// the same shape, so a reader who has learnt to read one can read both.

import type { CSSProperties } from "react";
import type { FSM, State } from "./model";

export const MONO = 'ui-monospace, "JetBrains Mono", Menlo, monospace';

// Warm gold for "the machine is here", matching FSMGraph's current-node
// fill so the trail and the diagram agree at a glance.
export const CURRENT = "#e6b450";
export const CURRENT_INK = "#5c4210";

export function label(machine: FSM, s: State): string {
  return machine.labels?.[s] ?? s;
}

// ---------------------------------------------------------------------
//  The tape
// ---------------------------------------------------------------------

export function Tape({
  input,
  step,
  finished,
  emptyNote = "no symbols to read: the machine never leaves its start state",
}: {
  input: string;
  step: number;
  finished: boolean;
  emptyNote?: string;
}) {
  const symbols = [...input];
  if (symbols.length === 0) {
    return (
      <div style={{ textAlign: "center", fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>
        {emptyNote}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 4 }}>
      {symbols.map((sym, i) => {
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
              border: `2px solid ${isHead ? "var(--accent)" : "var(--rule)"}`,
              borderRadius: 4,
              background: consumed ? "var(--rule)" : isHead ? "var(--surface)" : "transparent",
              color: consumed ? "var(--muted)" : "var(--ink)",
              fontFamily: MONO,
              fontSize: 16,
            }}
          >
            {sym}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
//  The trail
// ---------------------------------------------------------------------

export interface TrailHop {
  symbol: string;
  to: State | null;
}

// start ──0──▶ q1 ──1──▶ q2 …  built up one hop at a time as the machine
// walks. Accepting states are drawn with the double ring the diagram uses,
// so the trail alone tells you where a verdict would have fallen.
export function Trail({
  machine,
  hops,
  compact = false,
  minHeight = 34,
}: {
  machine: FSM;
  hops: TrailHop[];
  compact?: boolean;
  minHeight?: number;
}) {
  const size = compact ? 12 : 13;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        minHeight,
        fontFamily: MONO,
        fontSize: size,
        lineHeight: 1.9,
      }}
    >
      <StateChip machine={machine} state={machine.start} current={hops.length === 0} size={size} />
      {hops.map((h, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
          <span style={{ color: "var(--muted)", padding: "0 1px" }}>
            {"─"}
            <span style={{ color: "var(--ink)" }}>{h.symbol}</span>
            {"─▸"}
          </span>
          {h.to === null ? (
            <span
              style={{
                padding: "1px 7px",
                borderRadius: 999,
                border: `1px solid var(--mcq-wrong)`,
                color: "var(--mcq-wrong)",
              }}
            >
              off the diagram
            </span>
          ) : (
            <StateChip
              machine={machine}
              state={h.to}
              current={i === hops.length - 1}
              size={size}
            />
          )}
        </span>
      ))}
    </div>
  );
}

export function StateChip({
  machine,
  state,
  current,
  size = 13,
}: {
  machine: FSM;
  state: State;
  current: boolean;
  size?: number;
}) {
  const accepting = machine.accepting.has(state);
  const fill = current ? CURRENT : "var(--surface)";
  const ink = current ? CURRENT_INK : "var(--ink)";
  // An accepting state gets the double ring of the diagram: the first
  // inset shadow repaints the fill 1.5px in, the second paints the ring
  // underneath it, so what shows is a hairline circle inside the border.
  const base: CSSProperties = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontFamily: MONO,
    fontSize: size,
    lineHeight: 1.15,
    whiteSpace: "nowrap",
    border: current ? `1.5px solid ${CURRENT_INK}` : "1px solid var(--rule)",
    background: fill,
    color: ink,
    boxShadow: accepting
      ? `inset 0 0 0 1.5px ${fill}, inset 0 0 0 3px ${current ? CURRENT_INK : "var(--muted)"}`
      : undefined,
  };
  return <span style={base}>{label(machine, state)}</span>;
}

// ---------------------------------------------------------------------
//  Verdicts
// ---------------------------------------------------------------------

export function VerdictLine({
  accepted,
  state,
  machine,
  trapped,
}: {
  accepted: boolean;
  state: State | null;
  machine: FSM;
  trapped: boolean;
}) {
  if (trapped || state === null) {
    return (
      <span style={{ color: "var(--mcq-wrong)", fontWeight: 600 }}>
        rejected: the machine fell off the diagram
      </span>
    );
  }
  return accepted ? (
    <span style={{ color: "var(--mcq-right)", fontWeight: 600 }}>
      accepted, finished in <code style={{ fontFamily: MONO }}>{label(machine, state)}</code>
    </span>
  ) : (
    <span style={{ color: "var(--mcq-wrong)", fontWeight: 600 }}>
      rejected, finished in <code style={{ fontFamily: MONO }}>{label(machine, state)}</code>
    </span>
  );
}

// A small pill saying what the verdict would be if the tape ran out right
// now. Watching this flicker as the machine walks is the fastest way to
// see that accepting is a condition of the moment, not a door that locks.
export function LivePill({ would }: { would: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "1px 9px",
        borderRadius: 999,
        fontSize: 12,
        border: `1px solid ${would ? "var(--mcq-right)" : "var(--rule)"}`,
        background: would ? "var(--mcq-right-soft)" : "transparent",
        color: would ? "var(--mcq-right)" : "var(--muted)",
        whiteSpace: "nowrap",
      }}
    >
      {would ? "✓" : "✗"} stop here and it is {would ? "accepted" : "rejected"}
    </span>
  );
}

export const BTN_CSS = `
  .fsm-btn {
    padding: 4px 12px;
    font-size: 14px;
    background: var(--surface);
    color: var(--ink);
    border: 1px solid var(--rule);
    border-radius: 4px;
    cursor: pointer;
  }
  .fsm-btn:hover:not(:disabled) { border-color: var(--accent); }
  .fsm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .fsm-chip {
    padding: 2px 9px;
    border-radius: 999px;
    border: 1px solid var(--rule);
    background: transparent;
    color: var(--ink);
    font-family: ${MONO};
    font-size: 13px;
    cursor: pointer;
  }
  .fsm-chip:hover { border-color: var(--accent); }
`;
