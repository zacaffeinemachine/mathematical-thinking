// A fixed circuit with switches the student can flip, and a goal for the
// bulbs. Two modes:
//   mode="one"  find a setting that makes the bulbs show the goal.
//   mode="all"  list every setting that does, and check the list.
// The check in "all" mode is exact: the list must equal the set of rows on
// which the goal holds, found by walking the whole table.

import { useMemo, useState } from "react";
import type { Bit, CircuitSpec } from "../model";
import { evaluateNet, rowCount, rowIndex, rowSetting, rowsMatching } from "./engine";
import FixedCircuit from "./FixedCircuit";
import { BulbGlyph, MONO, SwitchGlyph } from "./glyphs";
import { MSG } from "./messages";
import { settingOf, usePrepared } from "./prepare";
import { usePersistent } from "./storage";
import { AuthorError, Button, Row, Status } from "./ui";

export interface FindSettingProps {
  id?: string;
  circuit: CircuitSpec;
  goal?: string | Record<string, 0 | 1>;   // wanted bulbs, "10" in bulb order or { door: 1, bomb: 0 }; default all lit
  mode?: "one" | "all";
  fixed?: Record<string, 0 | 1>;           // switches stuck in place (drawn dashed, cannot be flipped)
  start?: string | Record<string, 0 | 1>;  // where the other switches start (default all 0)
  reveal?: "all" | "bulbs" | "none";       // what is live while flipping; default "bulbs" for one, "none" for all
  scale?: number;
}

interface Saved { setting: Record<string, Bit>; list: number[] }

export default function FindSetting({ id, circuit, goal, mode = "one", fixed = {}, start, reveal, scale }: FindSettingProps) {
  const P = usePrepared(circuit);
  const show = reveal ?? (mode === "one" ? "bulbs" : "none");
  const want = useMemo(() => {
    if (goal === undefined) return Object.fromEntries(P.outputIds.map((o) => [o, 1 as Bit]));
    return settingOf(P.outputIds, goal);
  }, [P, goal]);

  const initialSetting = () => ({ ...settingOf(P.inputIds, start), ...settingOf(Object.keys(fixed), fixed) });
  const [saved, setSaved, reset] = usePersistent<Saved>(id, `find-${mode}`, () => ({ setting: initialSetting(), list: [] }), (s) => {
    const v = s as Saved;
    if (!v || typeof v !== "object" || !v.setting || !Array.isArray(v.list)) return null;
    if (!P.inputIds.every((i) => v.setting[i] === 0 || v.setting[i] === 1)) return null;
    return { setting: { ...v.setting, ...settingOf(Object.keys(fixed), fixed) }, list: v.list.filter((r) => Number.isInteger(r) && r >= 0 && r < rowCount(P.inputIds)) };
  });
  const [msg, setMsg] = useState<null | { tone: "right" | "wrong" | "info"; text: string }>(null);

  // The exact answer: every row agreeing with the stuck switches on which
  // every goal bulb shows its wanted value.
  const answer = useMemo(() => {
    const fixedIds = Object.keys(fixed);
    return rowsMatching(P.net, want).filter((r) => {
      const s = rowSetting(P.inputIds, r);
      return fixedIds.every((f) => s[f] === (fixed[f] ? 1 : 0));
    });
  }, [P, want, fixed]);

  if (P.error || !P.laid) return <AuthorError>{P.error}</AuthorError>;
  for (const f of Object.keys(fixed)) if (!P.inputIds.includes(f)) return <AuthorError>fixed names "{f}", which is not a switch.</AuthorError>;

  const setting = saved.setting;
  const values = evaluateNet(P.net, setting);
  const bulbNow = (o: string) => values[P.net.outputs.find((x) => x.id === o)!.source!] as Bit;
  const meets = P.outputIds.every((o) => !(o in want) || bulbNow(o) === want[o]);
  const autoDone = mode === "one" && show !== "none" && meets;

  const flip = (sid: string) => {
    setMsg(null);
    setSaved((s) => ({ ...s, setting: { ...s.setting, [sid]: (s.setting[sid] ^ 1) as Bit } }));
  };

  const checkOne = () => setMsg(meets ? { tone: "right", text: MSG.findOneRight } : { tone: "wrong", text: MSG.findOneWrong });
  const add = () => {
    const r = rowIndex(P.inputIds, setting);
    if (saved.list.includes(r)) return setMsg({ tone: "info", text: MSG.findDuplicate });
    setMsg(null);
    setSaved((s) => ({ ...s, list: [...s.list, r].sort((a, b) => a - b) }));
  };
  const removeRow = (r: number) => { setMsg(null); setSaved((s) => ({ ...s, list: s.list.filter((x) => x !== r) })); };
  const checkAll = () => {
    const mine = new Set(saved.list);
    if (saved.list.some((r) => !answer.includes(r))) return setMsg({ tone: "wrong", text: MSG.findAllHasWrong });
    if (answer.some((r) => !mine.has(r))) return setMsg({ tone: "wrong", text: MSG.findAllMissing });
    setMsg({ tone: "right", text: answer.length === 0 ? MSG.findAllNone : MSG.findAllRight(answer.length) });
  };

  const bulbs = Object.fromEntries(P.outputIds.map((o) => [o, show === "none" ? null : bulbNow(o)]));
  const goalOutputs = P.outputIds.filter((o) => o in want);

  return (
    <div className="not-prose" style={{ margin: "12px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 14, marginBottom: 6 }}>
        <span style={{ color: "var(--muted)" }}>{mode === "one" ? "Goal" : "Every setting that gives"}</span>
        {goalOutputs.map((o) => {
          const w = 44 + P.labelOf(o).length * 8.5;
          return (
            <svg key={o} viewBox={`0 0 ${w} 40`} width={w} height={40} role="img" aria-label={`${P.labelOf(o)} ${want[o] ? "lit" : "dark"}`}>
              <BulbGlyph x={20} y={20} value={want[o]} label={P.labelOf(o)} stub={false} />
            </svg>
          );
        })}
      </div>
      <FixedCircuit
        circuit={P.laid}
        switches={setting}
        values={show === "all" ? values : null}
        bulbs={bulbs}
        onSwitch={flip}
        locked={Object.keys(fixed)}
        scale={scale}
      />
      {Object.keys(fixed).length > 0 && (
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
          Dashed switches are stuck and cannot be flipped.
        </div>
      )}

      {mode === "one" ? (
        <>
          {show === "none" && (
            <Row><Button main onClick={checkOne}>Check</Button><Button onClick={() => { reset(); setMsg(null); }}>Reset</Button></Row>
          )}
          {show !== "none" && <Row><Button onClick={() => { reset(); setMsg(null); }}>Reset</Button></Row>}
          {autoDone && <Status tone="right">{MSG.findOneRight}</Status>}
          {msg && !autoDone && <Status tone={msg.tone}>{msg.text}</Status>}
        </>
      ) : (
        <>
          <Row>
            <Button onClick={add}>Add this setting</Button>
            <Button main onClick={checkAll}>Check my list</Button>
            <Button onClick={() => { reset(); setMsg(null); }}>Reset</Button>
          </Row>
          <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
            Your list{saved.list.length === 0 ? " is empty." : ` (${saved.list.length}):`}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
            {saved.list.map((r) => <SettingChip key={r} ids={P.inputIds} labelOf={P.labelOf} row={r} onRemove={() => removeRow(r)} />)}
          </div>
          {msg && <Status tone={msg.tone}>{msg.text}</Status>}
        </>
      )}
    </div>
  );
}

// One saved setting, drawn as a row of tiny switches, with a remove button.
function SettingChip({ ids, labelOf, row, onRemove }: { ids: string[]; labelOf: (id: string) => string; row: number; onRemove: () => void }) {
  const s = rowSetting(ids, row);
  const W = ids.length * 34 + 4;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid var(--rule)", borderRadius: 6, padding: "2px 4px 2px 6px", background: "var(--bg)" }}>
      <svg viewBox={`0 0 ${W} 40`} width={W * 0.8} height={32} role="img" aria-label={ids.map((i) => `${labelOf(i)} ${s[i]}`).join(", ")}>
        {ids.map((i, k) => (
          <g key={i}>
            <text x={k * 34 + 8} y={24} fontSize={12} fontFamily={MONO} textAnchor="end" fill="var(--muted)">{labelOf(i).slice(0, 2)}</text>
            <SwitchGlyph x={k * 34 + 20} y={20} value={s[i]} stub={false} />
          </g>
        ))}
      </svg>
      <button type="button" onClick={onRemove} aria-label="Remove this setting" style={{ border: "none", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px" }}>
        ×
      </button>
    </span>
  );
}
