// Static pictures for problem statements: render them with NO client
// directive. They ship no JavaScript and hold no state.

import type { Bit, CircuitSpec, GateType } from "../model";
import { columnsOf, evaluateNet, netOf, parseColumn, rowCount, rowSetting, type Column } from "./engine";
import { layoutCircuit } from "./layout";
import { BulbGlyph, GateIcon as GateIconSvg, MONO, SwitchGlyph } from "./glyphs";
import FixedCircuit from "./FixedCircuit";
import { AuthorError } from "./ui";

// "abc" or ["a", "b", "c"], and "101" or [1, 0, 1].
type Labels = string | string[];
type Bits = string | (0 | 1 | boolean)[];
const labelsOf = (l: Labels | undefined, n: number): string[] =>
  l === undefined ? Array(n).fill("") : typeof l === "string" ? [...l] : l;
const bitsOf = (b: Bits): Bit[] =>
  typeof b === "string" ? [...b.replace(/[\s_|]/g, "")].map((c) => (c === "1" ? 1 : 0)) : b.map((x) => (x ? 1 : 0));

const inlineSvg = { display: "inline-block", verticalAlign: "middle" } as const;

// ---- one switch, one bulb ----------------------------------------------------

export function Switch({ on = false, label, size = 1 }: { on?: boolean; label?: string; size?: number }) {
  const lw = label ? label.length * 8 + 10 : 0;
  return (
    <svg viewBox={`${-12 - lw} -18 ${24 + lw} 36`} width={(24 + lw) * size} height={36 * size} style={inlineSvg} role="img" aria-label={`switch ${label ?? ""} ${on ? "up" : "down"}`}>
      <SwitchGlyph x={0} y={0} value={on ? 1 : 0} label={label} stub={false} />
    </svg>
  );
}

export function Bulb({ lit = false, label, size = 1 }: { lit?: boolean; label?: string; size?: number }) {
  const lw = label ? label.length * 8 + 10 : 0;
  return (
    <svg viewBox={`-17 -20 ${36 + lw} 40`} width={(36 + lw) * size} height={40 * size} style={inlineSvg} role="img" aria-label={`bulb ${label ?? ""} ${lit ? "lit" : "dark"}`}>
      <BulbGlyph x={0} y={0} value={lit ? 1 : 0} label={label} stub={false} />
    </svg>
  );
}

// ---- rows of switches or bulbs --------------------------------------------------

export function SwitchRow({ values, labels, size = 1 }: { values: Bits; labels?: Labels; size?: number }) {
  const v = bitsOf(values);
  const l = labelsOf(labels, v.length);
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", verticalAlign: "middle" }}>
      {v.map((b, i) => <Switch key={i} on={b === 1} label={l[i] || undefined} size={size} />)}
    </span>
  );
}

export function LampRow({ lamps, labels, size = 1 }: { lamps: Bits; labels?: Labels; size?: number }) {
  const v = bitsOf(lamps);
  const l = labelsOf(labels, v.length);
  return (
    <span style={{ display: "inline-flex", gap: 4, alignItems: "center", verticalAlign: "middle" }}>
      {v.map((b, i) => <Bulb key={i} lit={b === 1} label={l[i] || undefined} size={size} />)}
    </span>
  );
}

// ---- a sealed box: switches go in, bulbs come out, the inside is hidden ------

export function SealedBox({
  switches, bulbs, inputs, outputs, caption,
}: {
  switches: Bits; bulbs: Bits; inputs?: Labels; outputs?: Labels; caption?: string;
}) {
  const s = bitsOf(switches);
  const b = bitsOf(bulbs);
  const il = labelsOf(inputs, s.length);
  const ol = labelsOf(outputs, b.length);
  const rows = Math.max(s.length, b.length);
  const H = Math.max(70, rows * 44 + 16);
  const inLW = Math.max(0, ...il.map((x) => x.length * 8));
  const outLW = Math.max(0, ...ol.map((x) => x.length * 8));
  const sx = inLW + 22, boxL = sx + 46, boxR = boxL + 74, bx = boxR + 44;
  const W = bx + 18 + outLW + 8;
  const yAt = (k: number, n: number) => H / 2 + (k - (n - 1) / 2) * 44;
  return (
    <figure style={{ display: "inline-block", margin: "6px 10px 6px 0", verticalAlign: "top", textAlign: "center" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ maxWidth: "100%", height: "auto", display: "block" }} role="img" aria-label="sealed box">
        <rect x={boxL} y={8} width={boxR - boxL} height={H - 16} rx={8} fill="var(--rule)" stroke="var(--gate-ink)" strokeWidth={1.4} />
        <text x={(boxL + boxR) / 2} y={H / 2 + 7} fontSize={20} fontFamily={MONO} fontWeight={700} textAnchor="middle" fill="var(--muted)">?</text>
        {s.map((v, k) => (
          <g key={`s${k}`}>
            <line x1={sx + 20} y1={yAt(k, s.length)} x2={boxL} y2={yAt(k, s.length)} stroke={v ? "var(--gate-wire-on)" : "var(--gate-wire-off)"} strokeWidth={v ? 2.6 : 1.7} />
            <SwitchGlyph x={sx} y={yAt(k, s.length)} value={v} label={il[k] || undefined} />
          </g>
        ))}
        {b.map((v, k) => (
          <g key={`b${k}`}>
            <line x1={boxR} y1={yAt(k, b.length)} x2={bx - 22} y2={yAt(k, b.length)} stroke={v ? "var(--gate-wire-on)" : "var(--gate-wire-off)"} strokeWidth={v ? 2.6 : 1.7} />
            <BulbGlyph x={bx} y={yAt(k, b.length)} value={v} label={ol[k] || undefined} />
          </g>
        ))}
      </svg>
      {caption && <figcaption style={{ fontSize: 12, color: "var(--muted)" }}>{caption}</figcaption>}
    </figure>
  );
}

// ---- a gate on its own ---------------------------------------------------------

export function GateIcon({ type, size = 1 }: { type: GateType; size?: number }) {
  return <GateIconSvg type={type} size={size} />;
}

// ---- a truth table ------------------------------------------------------------

// Either give `inputs` and `outputs` ({ label: column }), or give a `circuit`
// and the table is computed from it. Optional:
//   wires     extra columns for named inner wires of the circuit, [{ wire, label }]
//   blank     true, or a list of column labels, to print "?" instead of values
//   rows      only these row numbers (0 is all switches down), e.g. for "observations"
//   highlight row numbers to tint
export function TruthTable({
  inputs, outputs, circuit, wires = [], blank = false, rows, highlight = [], caption,
}: {
  inputs?: string[];
  outputs?: Record<string, Column>;
  circuit?: CircuitSpec;
  wires?: { wire: string; label: string }[];
  blank?: boolean | string[];
  rows?: number[];
  highlight?: number[];
  caption?: string;
}) {
  let inLabels: string[] = [];
  const cols: { label: string; bits: Bit[] }[] = [];
  let error: string | null = null;
  if (circuit) {
    const net = netOf(circuit);
    inLabels = circuit.inputs.map((i) => i.label ?? i.id);
    for (const w of wires) {
      const bits: Bit[] = [];
      for (let r = 0; r < rowCount(net.inputs); r++) bits.push((evaluateNet(net, rowSetting(net.inputs, r))[w.wire] ?? 0) as Bit);
      cols.push({ label: w.label, bits });
    }
    const t = columnsOf(circuit);
    for (const o of circuit.outputs) cols.push({ label: o.label ?? o.id, bits: [...t[o.id]].map((c) => (c === "1" ? 1 : 0)) });
  } else if (inputs && outputs) {
    inLabels = inputs;
    for (const [label, col] of Object.entries(outputs)) {
      const bits = parseColumn(col, rowCount(inputs), label);
      if (typeof bits === "string") { error = bits; break; }
      cols.push({ label, bits });
    }
  } else {
    error = "TruthTable needs either a circuit, or inputs and outputs.";
  }
  if (error) return <AuthorError>{error}</AuthorError>;

  const n = inLabels.length;
  const shown = rows ?? Array.from({ length: 1 << n }, (_, r) => r);
  const isBlank = (label: string) => blank === true || (Array.isArray(blank) && blank.includes(label));
  return <TableView inLabels={inLabels} cols={cols} shown={shown} isBlank={isBlank} highlight={highlight} caption={caption} />;
}

export function TableView({
  inLabels, cols, shown, isBlank = () => false, highlight = [], caption, compact = false,
}: {
  inLabels: string[];
  cols: { label: string; bits: (Bit | undefined)[]; tint?: (Bit | undefined)[] }[];
  shown: number[];
  isBlank?: (label: string) => boolean;
  highlight?: number[];
  caption?: string;
  compact?: boolean;
}) {
  const n = inLabels.length;
  const td: React.CSSProperties = {
    padding: compact ? "1px 8px" : "3px 12px",
    fontFamily: MONO,
    fontSize: compact ? 12 : 13.5,
    textAlign: "center",
    color: "var(--ink)",
  };
  return (
    <figure style={{ display: "inline-block", margin: compact ? 0 : "8px 0", verticalAlign: "top" }}>
      <table style={{ borderCollapse: "collapse", margin: 0 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--muted)" }}>
            {inLabels.map((l, i) => <th key={`i${i}`} style={{ ...td, fontWeight: 600 }}>{l}</th>)}
            {cols.map((c, k) => (
              <th key={`c${k}`} style={{ ...td, fontWeight: 600, borderLeft: k === 0 ? "1px solid var(--muted)" : undefined }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r} style={{ background: highlight.includes(r) ? "var(--accent-soft)" : undefined }}>
              {Array.from({ length: n }, (_, i) => (
                <td key={`i${i}`} style={td}>{(r >> (n - 1 - i)) & 1}</td>
              ))}
              {cols.map((c, k) => {
                const b = c.bits[r];
                const blankCell = isBlank(c.label);
                const bad = c.tint !== undefined && c.tint[r] !== undefined && b !== c.tint[r];
                return (
                  <td
                    key={`c${k}`}
                    style={{
                      ...td,
                      borderLeft: k === 0 ? "1px solid var(--muted)" : undefined,
                      fontWeight: 700,
                      color: blankCell || b === undefined ? "var(--muted)" : b ? "var(--gate-wire-on)" : "var(--muted)",
                      background: bad ? "var(--mcq-wrong-soft)" : undefined,
                    }}
                  >
                    {blankCell ? "?" : b === undefined ? "·" : b}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {caption && <figcaption style={{ fontSize: 12, color: "var(--muted)", textAlign: "center" }}>{caption}</figcaption>}
    </figure>
  );
}

// ---- a fixed circuit as a picture ------------------------------------------------

// Shows a circuit with no interaction. With `switches` given ("101" or
// { a: 1, ... }), the switches are set and, if `showValues`, every wire and
// bulb shows its value. Without `switches`, everything is drawn neutral.
export function CircuitPicture({
  circuit, switches, showValues = false, scale = 1, caption,
}: {
  circuit: CircuitSpec;
  switches?: string | Record<string, 0 | 1>;
  showValues?: boolean;
  scale?: number;
  caption?: string;
}) {
  let laid;
  try { laid = layoutCircuit(circuit); } catch (e) { return <AuthorError>{String(e)}</AuthorError>; }
  const ids = circuit.inputs.map((i) => i.id);
  const setting: Record<string, Bit> | null = switches === undefined ? null
    : typeof switches === "string" ? Object.fromEntries(ids.map((id, k) => [id, (switches[k] === "1" ? 1 : 0) as Bit]))
    : Object.fromEntries(ids.map((id) => [id, (switches[id] ? 1 : 0) as Bit]));
  const vals = setting ? evaluateNet(netOf(circuit), setting) : null;
  const sw: Record<string, Bit | null> = Object.fromEntries(ids.map((id) => [id, setting ? setting[id] : null]));
  const bulbs: Record<string, Bit | null> = Object.fromEntries(
    // With no values on show a bulb is drawn plain and dark, not as a "?".
    circuit.outputs.map((o) => [o.id, showValues && vals ? (vals[o.source] ?? 0) : 0]),
  );
  return (
    <figure style={{ margin: "12px 0" }}>
      <FixedCircuit circuit={laid} switches={sw} values={showValues ? vals : null} bulbs={bulbs} scale={scale} />
      {caption && <figcaption style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", marginTop: 4 }}>{caption}</figcaption>}
    </figure>
  );
}
