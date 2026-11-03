// A fixed circuit and its truth table with the output column(s) left blank.
// The student taps cells to fill them, then checks. Wrong rows are marked.
// Once every row is right, the switches start working and the row the
// switches are on is highlighted, so the student can try rows by hand.

import { useMemo, useState } from "react";
import type { Bit, CircuitSpec } from "../model";
import { evaluateNet, rowCount, rowIndex, rowSetting } from "./engine";
import FixedCircuit from "./FixedCircuit";
import { MONO } from "./glyphs";
import { MSG } from "./messages";
import { usePrepared } from "./prepare";
import { usePersistent } from "./storage";
import { AuthorError, Button, Row, Status } from "./ui";

export interface FillTableProps {
  id?: string;
  circuit: CircuitSpec;
  wires?: { wire: string; label: string; place?: "above" | "below" | "right" }[];   // extra columns for inner wires, filled before the bulbs
  bulbs?: string[];                            // which bulbs get a column (default: all)
  given?: string[];                            // columns (by label) printed already filled in
  scale?: number;
}

type Cells = Record<string, (Bit | null)[]>; // column key -> one cell per row

export default function FillTable({ id, circuit, wires = [], bulbs, given = [], scale }: FillTableProps) {
  const P = usePrepared(circuit);
  const rows = rowCount(P.inputIds);

  // Columns: inner wires first, then bulbs. Each knows its true values.
  const cols = useMemo(() => {
    const out: { key: string; label: string; source: string; given: boolean }[] = [];
    for (const w of wires) out.push({ key: `wire:${w.wire}`, label: w.label, source: w.wire, given: given.includes(w.label) });
    for (const o of P.net.outputs) {
      if (bulbs && !bulbs.includes(o.id)) continue;
      const label = P.labelOf(o.id);
      out.push({ key: `bulb:${o.id}`, label, source: o.source ?? "", given: given.includes(label) });
    }
    return out;
  }, [P, wires, bulbs, given]);
  const truth = useMemo(() => {
    const t: Record<string, Bit[]> = {};
    for (const c of cols) t[c.key] = [];
    for (let r = 0; r < rows; r++) {
      const v = evaluateNet(P.net, rowSetting(P.inputIds, r));
      for (const c of cols) t[c.key].push((v[c.source] ?? 0) as Bit);
    }
    return t;
  }, [P, cols, rows]);

  const blank = (): Cells => Object.fromEntries(cols.filter((c) => !c.given).map((c) => [c.key, Array(rows).fill(null)]));
  const [cells, setCells, reset] = usePersistent<Cells>(id, "fill", blank, (s) => {
    if (!s || typeof s !== "object") return null;
    const ok = cols.filter((c) => !c.given).every((c) => Array.isArray((s as Cells)[c.key]) && (s as Cells)[c.key].length === rows);
    return ok ? (s as Cells) : null;
  });
  const [checked, setChecked] = useState<null | { wrongRows: number[]; incomplete: boolean }>(null);
  const [setting, setSetting] = useState<Record<string, Bit>>(() => rowSetting(P.inputIds, 0));

  if (P.error || !P.laid) return <AuthorError>{P.error}</AuthorError>;
  for (const w of wires) if (!P.inputIds.includes(w.wire) && !P.net.gates.some((g) => g.id === w.wire))
    return <AuthorError>Wire "{w.wire}" is not a switch or gate of this circuit.</AuthorError>;
  if (P.inputIds.length > 5) return <AuthorError>FillTable is for at most 5 switches (32 rows).</AuthorError>;

  const open = cols.filter((c) => !c.given);
  const solved = checked !== null && !checked.incomplete && checked.wrongRows.length === 0;

  const tapCell = (key: string, r: number) => {
    if (solved) return;
    setChecked(null);
    setCells((c) => {
      const col = [...(c[key] ?? Array(rows).fill(null))];
      col[r] = col[r] === null ? 0 : col[r] === 0 ? 1 : 0;
      return { ...c, [key]: col };
    });
  };
  const check = () => {
    // Rows are marked only once the table is full. Marking a half-filled
    // table would let a student fill one cell, check, and read the answer
    // off the marks, since each cell has only two possible values.
    if (open.some((c) => !cells[c.key] || cells[c.key].some((b) => b === null))) {
      setChecked({ wrongRows: [], incomplete: true });
      return;
    }
    const wrongRows: number[] = [];
    for (let r = 0; r < rows; r++) {
      if (open.some((c) => cells[c.key][r] !== truth[c.key][r])) wrongRows.push(r);
    }
    setChecked({ wrongRows, incomplete: false });
  };

  const values = solved ? evaluateNet(P.net, setting) : null;
  const currentRow = rowIndex(P.inputIds, setting);
  const n = P.inputIds.length;

  const td: React.CSSProperties = { padding: "2px 10px", fontFamily: MONO, fontSize: 14, textAlign: "center", color: "var(--ink)" };

  return (
    <div className="not-prose" style={{ margin: "12px 0" }}>
      <FixedCircuit
        movable
        circuit={P.laid}
        switches={solved ? setting : Object.fromEntries(P.inputIds.map((i) => [i, null]))}
        values={values}
        bulbs={Object.fromEntries(P.outputIds.map((o) => [o, values ? (values[P.net.outputs.find((x) => x.id === o)!.source!] ?? null) : 0]))}
        onSwitch={solved ? (sid) => setSetting((s) => ({ ...s, [sid]: (s[sid] ^ 1) as Bit })) : undefined}
        tags={wires.map((w) => ({ wire: w.wire, label: w.label, place: w.place, value: values ? (values[w.wire] ?? null) : null }))}
        scale={scale}
      />
      <div style={{ display: "flex", justifyContent: "center", marginTop: 12, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--muted)" }}>
              <th style={{ width: 18 }} aria-hidden="true" />
              {P.inputIds.map((i) => <th key={i} style={{ ...td, fontWeight: 600 }}>{P.labelOf(i)}</th>)}
              {cols.map((c, k) => (
                <th key={c.key} style={{ ...td, fontWeight: 600, borderLeft: k === 0 ? "1px solid var(--muted)" : undefined }}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => {
              const wrong = checked?.wrongRows.includes(r) ?? false;
              const here = solved && r === currentRow;
              return (
                <tr key={r} style={{ background: wrong ? "var(--mcq-wrong-soft)" : here ? "var(--accent-soft)" : undefined }}>
                  <td style={{ ...td, color: "var(--mcq-wrong)", fontWeight: 700, padding: "2px 2px" }}>{wrong ? "✗" : ""}</td>
                  {Array.from({ length: n }, (_, i) => <td key={i} style={td}>{(r >> (n - 1 - i)) & 1}</td>)}
                  {cols.map((c, k) => {
                    const left = k === 0 ? "1px solid var(--muted)" : undefined;
                    if (c.given) return <td key={c.key} style={{ ...td, borderLeft: left, fontWeight: 700 }}>{truth[c.key][r]}</td>;
                    const v = cells[c.key]?.[r] ?? null;
                    return (
                      <td key={c.key} style={{ ...td, borderLeft: left, padding: "2px 6px" }}>
                        <button
                          type="button"
                          onClick={() => tapCell(c.key, r)}
                          disabled={solved}
                          aria-label={`Row ${r + 1}, column ${c.label}: ${v === null ? "empty" : v}. Tap to change.`}
                          style={{
                            width: 34,
                            height: 28,
                            borderRadius: 5,
                            border: `1px solid ${v === null ? "var(--muted)" : "var(--rule)"}`,
                            borderStyle: v === null ? "dashed" : "solid",
                            background: v === 1 ? "var(--accent-soft)" : "var(--surface)",
                            color: v === 1 ? "var(--gate-wire-on)" : "var(--ink)",
                            fontFamily: MONO,
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: solved ? "default" : "pointer",
                          }}
                        >
                          {v === null ? "" : v}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Row style={{ justifyContent: "center" }}>
        <Button main onClick={check} disabled={solved}>Check</Button>
        <Button onClick={() => { reset(); setChecked(null); setSetting(rowSetting(P.inputIds, 0)); }}>Reset</Button>
      </Row>
      {solved && <Status tone="right">{MSG.fillRight}</Status>}
      {checked && checked.wrongRows.length > 0 && <Status tone="wrong">{MSG.fillWrong(checked.wrongRows.length)}</Status>}
      {checked && checked.wrongRows.length === 0 && checked.incomplete && <Status tone="info">{MSG.fillIncomplete}</Status>}
    </div>
  );
}
