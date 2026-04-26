import { useMemo, useState } from "react";
import type { Bit, Circuit, Gate, GateType } from "./model";
import { evaluateUpTo } from "./model";

// Standard gate dimensions, tuned to look reasonable at typical zoom.
const GW = 56;   // gate body width
const GH = 36;   // gate body height
const NOT_W = 36;
const NOT_H = 28;
const PIN = 6;   // pin stub length sticking out of inputs / outputs

// Gate fills come from CSS variables so they swap on dark/light theme.
const GATE_FILL: Record<GateType, string> = {
  NOT:  "var(--gate-not)",
  AND:  "var(--gate-and)",
  OR:   "var(--gate-or)",
  XOR:  "var(--gate-xor)",
  NAND: "var(--gate-nand)",
  NOR:  "var(--gate-nor)",
};
const GATE_INK = "var(--gate-ink)";
const WIRE_ON = "var(--gate-wire-on)";
const WIRE_OFF = "var(--gate-wire-off)";

// ---- Gate shape generators (return SVG <path d="…"> strings) ----------

function gatePath(type: GateType): string {
  switch (type) {
    case "NOT":
      // triangle pointing right; bubble drawn separately
      return `M 0 ${-NOT_H / 2} L ${NOT_W} 0 L 0 ${NOT_H / 2} Z`;
    case "AND":
    case "NAND": {
      // Flat-back D: rectangle on left, semicircle on right
      const r = GH / 2;
      const flatW = GW - r;
      return `M 0 ${-r} L ${flatW} ${-r} A ${r} ${r} 0 0 1 ${flatW} ${r} L 0 ${r} Z`;
    }
    case "OR":
    case "NOR":
    case "XOR": {
      // Shield with a curved back and a pointed nose
      const w = GW;
      const h = GH;
      // Back curve (concave), then two arcs converging at the tip.
      return `
        M 0 ${-h / 2}
        Q ${w * 0.25} 0 0 ${h / 2}
        Q ${w * 0.55} ${h / 2} ${w} 0
        Q ${w * 0.55} ${-h / 2} 0 ${-h / 2}
        Z
      `;
    }
  }
}

// Locations (relative to gate's anchor at left edge / horizontal centre):
function inputPin(type: GateType, idx: 0 | 1): { x: number; y: number } {
  if (type === "NOT") return { x: 0, y: 0 };
  const dy = GH * 0.28;
  return { x: 0, y: idx === 0 ? -dy : dy };
}
function outputPin(type: GateType): { x: number; y: number } {
  return { x: type === "NOT" ? NOT_W : GW, y: 0 };
}
function hasBubble(type: GateType): boolean {
  return type === "NOT" || type === "NAND" || type === "NOR";
}

// XOR gets an extra back-curve drawn behind the OR shield
function xorBackPath(): string {
  return `M -8 ${-GH / 2} Q ${GW * 0.25 - 8} 0 -8 ${GH / 2}`;
}

// ---- Main component ---------------------------------------------------

export interface CircuitDiagramProps {
  circuit: Circuit;
  initialInputs?: Record<string, Bit>;
  // Show truth-table for a (small) circuit. Capped at 4 inputs (16 rows).
  showTruthTable?: boolean;
  // Show step-by-step controls.
  steppable?: boolean;
  // Static / read-only: hide all controls and show the live values.
  readOnly?: boolean;
  caption?: string;
}

export default function CircuitDiagram({
  circuit,
  initialInputs,
  showTruthTable = false,
  steppable = false,
  readOnly = false,
  caption,
}: CircuitDiagramProps) {
  const [vals, setVals] = useState<Record<string, Bit>>(() => {
    const r: Record<string, Bit> = {};
    for (const i of circuit.inputs) r[i.id] = initialInputs?.[i.id] ?? 0;
    return r;
  });
  const [step, setStep] = useState<number>(steppable ? 0 : circuit.gates.length);

  const runValues = useMemo(
    () => evaluateUpTo(circuit, vals, step),
    [circuit, vals, step],
  );

  // Final values across all gates, used for truth-table rows.
  function evalAll(inputs: Record<string, Bit>): Record<string, Bit> {
    return evaluateUpTo(circuit, inputs, circuit.gates.length);
  }

  function toggle(id: string) {
    if (readOnly) return;
    setVals((v) => ({ ...v, [id]: (v[id] ^ 1) as Bit }));
    if (steppable) setStep(0);
  }
  function reset() {
    const r: Record<string, Bit> = {};
    for (const i of circuit.inputs) r[i.id] = 0;
    setVals(r);
    setStep(steppable ? 0 : circuit.gates.length);
  }

  // Wire colour helpers
  const liveAt = (nodeId: string): Bit | undefined => {
    if (nodeId in runValues) return runValues[nodeId];
    return undefined;
  };
  const wireColour = (b: Bit | undefined) =>
    b === 1 ? WIRE_ON : b === 0 ? WIRE_OFF : "var(--rule)";
  const wireWidth = (b: Bit | undefined) => (b === 1 ? 2.4 : 1.6);

  // Each source node gets its own vertical-trunk x so wires sharing a
  // source do not pile on the same column. Trunks step right by 5px in
  // the order sources appear (inputs first, then gates).
  const trunkX = useMemo(() => {
    const m: Record<string, number> = {};
    let i = 0;
    for (const inp of circuit.inputs) {
      const sx = inp.x + 11;
      m[inp.id] = sx + 8 + (i % 4) * 5;
      i++;
    }
    for (const g of circuit.gates) {
      const out = outputPin(g.type);
      const bubble = hasBubble(g.type) ? 6 : 0;
      const sx = g.x + out.x + bubble;
      m[g.id] = sx + 8 + (i % 4) * 5;
      i++;
    }
    return m;
  }, [circuit]);

  // Auto-route wires: source -> short stub right -> dedicated vertical
  // trunk -> across to within a small approach -> into the target pin.
  function routeWire(srcId: string, dst: { x: number; y: number }): string {
    const src = locateOutput(circuit, srcId);
    if (!src) return "";
    const tx = Math.min(trunkX[srcId] ?? (src.x + 8), dst.x - 6);
    return `M ${src.x} ${src.y} L ${tx} ${src.y} L ${tx} ${dst.y} L ${dst.x} ${dst.y}`;
  }

  return (
    <div style={{ margin: "16px 0" }}>
      <svg
        viewBox={`0 0 ${circuit.width} ${circuit.height}`}
        style={{
          width: "100%",
          maxWidth: circuit.width,
          height: "auto",
          display: "block",
          margin: "0 auto",
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderRadius: 6,
        }}
      >
        {/* Wires: input -> gate input pins, gate output -> next gate, gate -> output node */}
        {circuit.gates.map((g) =>
          g.inputs.map((srcId, i) => {
            const pin = inputPin(g.type, i as 0 | 1);
            const dst = { x: g.x + pin.x, y: g.y + pin.y };
            const b = liveAt(srcId);
            return (
              <path
                key={`w-${g.id}-${i}`}
                d={routeWire(srcId, dst)}
                fill="none"
                stroke={wireColour(b)}
                strokeWidth={wireWidth(b)}
              />
            );
          })
        )}
        {circuit.outputs.map((o) => {
          const dst = { x: o.x - PIN, y: o.y };
          const b = liveAt(o.source);
          return (
            <path
              key={`wo-${o.id}`}
              d={routeWire(o.source, dst)}
              fill="none"
              stroke={wireColour(b)}
              strokeWidth={wireWidth(b)}
            />
          );
        })}

        {/* Gates */}
        {circuit.gates.map((g, idx) => {
          const t = g.type;
          const evaluated = idx < step;
          const opacity = steppable && !evaluated ? 0.45 : 1;
          const out = outputPin(t);
          const outVal = liveAt(g.id);
          return (
            <g
              key={g.id}
              transform={`translate(${g.x},${g.y})`}
              style={{ opacity }}
            >
              {t === "XOR" && (
                <path
                  d={xorBackPath()}
                  fill="none"
                  stroke={GATE_INK}
                  strokeWidth={1.5}
                />
              )}
              <path
                d={gatePath(t)}
                fill={GATE_FILL[t]}
                stroke={GATE_INK}
                strokeWidth={1.5}
              />
              {hasBubble(t) && (
                <circle
                  cx={out.x + 3}
                  cy={out.y}
                  r={3}
                  fill="white"
                  stroke={GATE_INK}
                  strokeWidth={1.4}
                />
              )}
              {/* gate type label */}
              <text
                x={t === "NOT" ? NOT_W * 0.35 : GW / 2}
                y={4}
                fontSize={t === "NOT" ? 9 : 11}
                fontFamily="ui-sans-serif, system-ui"
                fontWeight={600}
                textAnchor="middle"
                fill={GATE_INK}
              >
                {t === "NOT" ? "" : t}
              </text>
              {/* output value bubble */}
              {outVal !== undefined && (
                <text
                  x={out.x + (hasBubble(t) ? 16 : 12)}
                  y={out.y + 4}
                  fontSize={11}
                  fontFamily="ui-monospace, monospace"
                  fontWeight={700}
                  fill={outVal ? WIRE_ON : "var(--muted)"}
                >
                  {outVal}
                </text>
              )}
              {g.label && (
                <text
                  x={GW / 2}
                  y={GH / 2 + 14}
                  fontSize={10}
                  fontFamily="ui-monospace, monospace"
                  textAnchor="middle"
                  fill="var(--muted)"
                >
                  {g.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Inputs (clickable) */}
        {circuit.inputs.map((inp) => {
          const v = vals[inp.id] ?? 0;
          return (
            <g
              key={inp.id}
              transform={`translate(${inp.x},${inp.y})`}
              onClick={() => toggle(inp.id)}
              style={{ cursor: readOnly ? "default" : "pointer" }}
            >
              <circle
                r={11}
                fill={v ? WIRE_ON : "var(--surface)"}
                stroke={GATE_INK}
                strokeWidth={1.4}
              />
              <text
                y={4}
                fontSize={12}
                fontFamily="ui-monospace, monospace"
                fontWeight={700}
                textAnchor="middle"
                fill={v ? "white" : "var(--ink)"}
              >
                {v}
              </text>
              <text
                x={-18}
                y={5}
                fontSize={12}
                fontFamily="ui-monospace, monospace"
                textAnchor="end"
                fill="var(--ink)"
              >
                {inp.label}
              </text>
            </g>
          );
        })}

        {/* Outputs */}
        {circuit.outputs.map((o) => {
          const v = liveAt(o.source);
          return (
            <g key={o.id} transform={`translate(${o.x},${o.y})`}>
              <circle
                r={10}
                fill={v === 1 ? WIRE_ON : "var(--surface)"}
                stroke={GATE_INK}
                strokeWidth={1.4}
                strokeDasharray={v === undefined ? "3 2" : "none"}
              />
              <text
                y={4}
                fontSize={11}
                fontFamily="ui-monospace, monospace"
                fontWeight={700}
                textAnchor="middle"
                fill={v === 1 ? "white" : "var(--ink)"}
              >
                {v ?? "?"}
              </text>
              <text
                x={16}
                y={5}
                fontSize={12}
                fontFamily="ui-monospace, monospace"
                textAnchor="start"
                fill="var(--ink)"
              >
                {o.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Controls */}
      {!readOnly && (
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "center",
            alignItems: "center",
            marginTop: 10,
            flexWrap: "wrap",
            fontFamily: "ui-sans-serif, system-ui",
            fontSize: 13,
          }}
        >
          {steppable && (
            <>
              <button
                onClick={() => setStep((s) => Math.min(circuit.gates.length, s + 1))}
                disabled={step >= circuit.gates.length}
                style={btnStyle(step < circuit.gates.length)}
              >
                Step ▸
              </button>
              <button
                onClick={() => setStep(circuit.gates.length)}
                disabled={step >= circuit.gates.length}
                style={btnStyle(step < circuit.gates.length)}
              >
                Run all
              </button>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                gate {step}/{circuit.gates.length}
              </span>
            </>
          )}
          <button onClick={reset} style={btnStyle(true)}>
            Reset
          </button>
        </div>
      )}

      {caption && (
        <div
          style={{
            textAlign: "center",
            color: "var(--muted)",
            fontSize: 12,
            marginTop: 6,
          }}
        >
          {caption}
        </div>
      )}

      {showTruthTable && circuit.inputs.length <= 4 && (
        <TruthTable circuit={circuit} evalAll={evalAll} current={vals} />
      )}
    </div>
  );
}

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

// --- helpers -----------------------------------------------------------

function locateOutput(c: Circuit, id: string): { x: number; y: number } | null {
  const inp = c.inputs.find((i) => i.id === id);
  if (inp) return { x: inp.x + 11, y: inp.y };
  const g = c.gates.find((g) => g.id === id);
  if (g) {
    const out = outputPin(g.type);
    const bubbleOff = hasBubble(g.type) ? 6 : 0;
    return { x: g.x + out.x + bubbleOff, y: g.y + out.y };
  }
  return null;
}

// --- truth table -------------------------------------------------------

function TruthTable({
  circuit,
  evalAll,
  current,
}: {
  circuit: Circuit;
  evalAll: (inputs: Record<string, Bit>) => Record<string, Bit>;
  current: Record<string, Bit>;
}) {
  const n = circuit.inputs.length;
  const rows = 1 << n;
  const cells: Array<{ assignment: Record<string, Bit>; outs: Bit[]; isCurrent: boolean }> = [];
  for (let r = 0; r < rows; r++) {
    const a: Record<string, Bit> = {};
    circuit.inputs.forEach((inp, i) => {
      a[inp.id] = (((r >> (n - 1 - i)) & 1) as Bit);
    });
    const v = evalAll(a);
    const outs: Bit[] = circuit.outputs.map((o) => (v[o.source] ?? 0) as Bit);
    const isCurrent = circuit.inputs.every((inp) => current[inp.id] === a[inp.id]);
    cells.push({ assignment: a, outs, isCurrent });
  }

  const td: React.CSSProperties = {
    padding: "3px 10px",
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
            {circuit.inputs.map((i) => (
              <th key={i.id} style={td}>{i.label}</th>
            ))}
            {circuit.outputs.map((o) => (
              <th
                key={o.id}
                style={{ ...td, borderLeft: "1px solid var(--rule)" }}
              >
                {o.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cells.map((row, idx) => (
            <tr
              key={idx}
              style={{
                background: row.isCurrent ? "var(--accent-soft)" : "transparent",
              }}
            >
              {circuit.inputs.map((i) => (
                <td key={i.id} style={td}>{row.assignment[i.id]}</td>
              ))}
              {row.outs.map((o, k) => (
                <td
                  key={k}
                  style={{
                    ...td,
                    borderLeft: "1px solid var(--rule)",
                    color: o ? "var(--gate-wire-on)" : "var(--muted)",
                    fontWeight: 700,
                  }}
                >
                  {o}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Re-export Gate type so circuits.ts can import everything from one path.
export type { Gate, GateType };
