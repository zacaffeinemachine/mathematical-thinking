// Multiple choice where the options are pictures: small circuits, truth
// tables, or both. Behaves like MCQ.tsx: a pick is neutral until submitted,
// then only what the student chose is coloured, nothing ever locks, and
// nothing is saved. One answer (a number) gives radio buttons, several (an
// array) gives "select all that apply" marked on exact set equality.

import { useState } from "react";
import type { Bit, CircuitSpec } from "../model";
import { evaluateNet, netOf, parseColumn, rowCount } from "./engine";
import FixedCircuit from "./FixedCircuit";
import { TableView } from "./helpers";
import { layoutCircuit } from "./layout";
import { MSG } from "./messages";
import { settingOf } from "./prepare";
import { AuthorError, Button, Row, Status } from "./ui";

export interface PickOption {
  circuit?: CircuitSpec;
  switches?: string | Record<string, 0 | 1>;   // set the option's switches and show its values
  table?: { inputs: string[]; outputs: Record<string, string | (0 | 1)[]> };
  caption?: string;                             // a short line under the picture
}

export interface PickCircuitProps {
  options: PickOption[];
  answer: number | number[];                    // index (from 0) of the right option, or all right ones
  columns?: 1 | 2 | 3 | 4;                      // most options per row (default 2); fewer on a narrow screen
  scale?: number;
}

const LETTERS = "ABCDEFGHIJ";

export default function PickCircuit({ options, answer, columns = 2, scale = 1 }: PickCircuitProps) {
  const multi = Array.isArray(answer);
  const key = multi ? (answer as number[]) : [answer as number];
  const [selected, setSelected] = useState<number[]>([]);
  const [verdict, setVerdict] = useState<"right" | "wrong" | null>(null);

  if (!Array.isArray(options) || options.length < 2) return <AuthorError>PickCircuit needs at least two options.</AuthorError>;
  if (key.some((k) => !Number.isInteger(k) || k < 0 || k >= options.length)) return <AuthorError>answer must be option numbers from 0 to {options.length - 1}.</AuthorError>;

  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));
  // Functional update, so two clicks in one tick both count.
  const toggle = (i: number) => {
    setSelected((cur) => (multi ? (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]) : [i]));
    setVerdict(null);
  };
  const submit = () => selected.length && setVerdict(same(selected, key) ? "right" : "wrong");

  return (
    <div className="not-prose" style={{ margin: "12px 0" }}>
      {multi && <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 6 }}>Select all that apply.</div>}
      <div
        role={multi ? "group" : "radiogroup"}
        className="pick-circuit-grid"
        style={{
          display: "grid",
          gap: 10,
          // At most `columns` per row, and each option at least minW wide, so
          // a phone drops to fewer columns instead of shrinking the pictures.
          gridTemplateColumns: `repeat(auto-fill, minmax(max(${options.some((o) => o.circuit) ? 210 : 120}px, calc((100% - ${(columns - 1) * 10}px) / ${columns})), 1fr))`,
        }}
      >
        {options.map((opt, i) => {
          const isSel = selected.includes(i);
          const tone = !isSel ? null : verdict === "right" ? "right" : verdict === "wrong" ? "wrong" : "pick";
          return (
            <button
              key={i}
              type="button"
              role={multi ? "checkbox" : "radio"}
              aria-checked={isSel}
              aria-label={`Option ${LETTERS[i]}`}
              onClick={() => toggle(i)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: 6,
                padding: "8px 10px 10px",
                borderRadius: 8,
                border: `${tone ? 2 : 1}px solid ${tone ? `var(--mcq-${tone})` : "var(--rule)"}`,
                background: tone ? `var(--mcq-${tone}-soft)` : "transparent",
                color: "var(--ink)",
                font: "inherit",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: tone === "right" || tone === "wrong" ? `var(--mcq-${tone})` : "var(--muted)" }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 13, height: 13, borderRadius: multi ? 3 : "50%",
                    border: `1px solid ${tone ? `var(--mcq-${tone})` : "var(--muted)"}`,
                    background: tone ? `var(--mcq-${tone})` : "transparent",
                    boxShadow: tone ? "inset 0 0 0 2px var(--surface)" : "none",
                  }}
                />
                {LETTERS[i]}
              </span>
              <OptionPicture opt={opt} scale={scale} />
              {opt.caption && (
                // A caption-only option is the whole answer, so it is set at body size.
                <span style={opt.circuit || opt.table
                  ? { fontSize: 13, color: "var(--muted)", textAlign: "center" }
                  : { fontSize: 16, color: "var(--ink)", textAlign: "center" }}>{opt.caption}</span>
              )}
            </button>
          );
        })}
      </div>
      <Row>
        <Button main onClick={submit} disabled={selected.length === 0}>Submit</Button>
        <Button onClick={() => { setSelected([]); setVerdict(null); }} disabled={selected.length === 0}>Clear</Button>
        {verdict === "right" && <span role="status" style={{ color: "var(--mcq-right)", fontWeight: 500 }}>{MSG.pickRight}</span>}
        {verdict === "wrong" && <span role="status" style={{ color: "var(--mcq-wrong)", fontWeight: 500 }}>{MSG.pickWrong}</span>}
      </Row>
    </div>
  );
}

function OptionPicture({ opt, scale }: { opt: PickOption; scale: number }) {
  let pic = null;
  if (opt.circuit) {
    let laid;
    try { laid = layoutCircuit(opt.circuit); } catch (e) { return <AuthorError>{String(e)}</AuthorError>; }
    const ids = opt.circuit.inputs.map((x) => x.id);
    const setting = opt.switches !== undefined ? settingOf(ids, opt.switches) : null;
    const values = setting ? evaluateNet(netOf(opt.circuit), setting) : null;
    pic = (
      <FixedCircuit
        circuit={laid}
        switches={Object.fromEntries(ids.map((id) => [id, setting ? setting[id] : null]))}
        values={values}
        bulbs={Object.fromEntries(opt.circuit.outputs.map((o) => [o.id, values ? (values[o.source] ?? 0) : 0]))}
        scale={scale}
      />
    );
  }
  let table = null;
  if (opt.table) {
    const cols: { label: string; bits: Bit[] }[] = [];
    for (const [label, col] of Object.entries(opt.table.outputs)) {
      const bits = parseColumn(col, rowCount(opt.table.inputs), label);
      if (typeof bits === "string") return <AuthorError>{bits}</AuthorError>;
      cols.push({ label, bits });
    }
    table = (
      <div style={{ display: "flex", justifyContent: "center" }}>
        <TableView inLabels={opt.table.inputs} cols={cols} shown={Array.from({ length: 1 << opt.table.inputs.length }, (_, r) => r)} compact />
      </div>
    );
  }
  return <>{pic}{table}</>;
}
