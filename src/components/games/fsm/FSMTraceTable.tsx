import type { FSM, State } from "./model";
import { run } from "./model";
import { MONO, StateChip } from "./parts";

// One machine, several inputs, every walk laid out at once.
//
// The runner shows one string beautifully and one string only. This shows
// six of them stacked, which is where the pattern lives: the eye picks up
// what all the accepted rows have in common far faster than a paragraph
// can say it.

interface FSMTraceTableProps {
  machine: FSM;
  inputs: string[];
  // Optional note per input, printed in the last column. Use it to say
  // what the reader should notice, not to repeat the verdict.
  notes?: Record<string, string>;
  caption?: string;
}

export default function FSMTraceTable({
  machine,
  inputs,
  notes = {},
  caption,
}: FSMTraceTableProps) {
  return (
    <div style={{ margin: "18px 0" }}>
      {caption && (
        <div
          style={{
            fontSize: 13,
            color: "var(--muted)",
            marginBottom: 8,
            textAlign: "center",
          }}
        >
          {caption}
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ color: "var(--muted)", textAlign: "left" }}>
              <th style={th}>input</th>
              <th style={th}>where the machine walks</th>
              <th style={{ ...th, textAlign: "right" }}>verdict</th>
            </tr>
          </thead>
          <tbody>
            {inputs.map((input) => {
              const { trace, finalState, accepted } = run(machine, input);
              return (
                <tr key={input || "(empty)"} style={{ borderTop: "1px solid var(--rule)" }}>
                  <td style={{ ...td, fontFamily: MONO, whiteSpace: "nowrap" }}>
                    {input.length === 0 ? (
                      <span style={{ color: "var(--muted)" }}>(empty)</span>
                    ) : (
                      input
                    )}
                    {notes[input] && (
                      <div
                        style={{
                          fontFamily: "inherit",
                          fontSize: 12,
                          color: "var(--muted)",
                          marginTop: 3,
                          maxWidth: "26ch",
                          whiteSpace: "normal",
                        }}
                      >
                        {notes[input]}
                      </div>
                    )}
                  </td>
                  <td style={td}>
                    <span
                      style={{
                        display: "inline-flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 2,
                        lineHeight: 2,
                      }}
                    >
                      <StateChip machine={machine} state={machine.start} current={false} size={12} />
                      {trace.map((t, i) => (
                        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
                          <span style={{ color: "var(--muted)", fontFamily: MONO, fontSize: 12 }}>
                            {"─"}
                            <span style={{ color: "var(--ink)" }}>{t.symbol}</span>
                            {"─▸"}
                          </span>
                          {t.to === null ? (
                            <span style={{ color: "var(--fsm-reject)", fontSize: 12 }}>off the diagram</span>
                          ) : (
                            <StateChip
                              machine={machine}
                              state={t.to as State}
                              current={i === trace.length - 1}
                              size={12}
                            />
                          )}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td
                    style={{
                      ...td,
                      textAlign: "right",
                      whiteSpace: "nowrap",
                      color: accepted ? "var(--fsm-accept)" : "var(--fsm-reject)",
                      fontWeight: 600,
                    }}
                  >
                    {finalState === null
                      ? "✗ rejected"
                      : accepted
                      ? "✓ accepted"
                      : "✗ rejected"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
        The gold chip is where each walk ends. A ring inside a chip means an
        accepting state.
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "4px 8px",
  fontWeight: 500,
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const td: React.CSSProperties = {
  padding: "8px",
  verticalAlign: "top",
};
