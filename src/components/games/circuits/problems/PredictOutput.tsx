// A fixed circuit with the switches set and locked. The student taps each
// bulb (lit or dark) and each tagged inner wire (0 or 1) to say what it
// carries, then checks. The verdict is all or nothing: with only two
// possible values, marking which answer is wrong would give it away.

import { useMemo, useState } from "react";
import type { Bit, CircuitSpec } from "../model";
import { evaluateNet } from "./engine";
import FixedCircuit from "./FixedCircuit";
import { MSG } from "./messages";
import { settingOf, usePrepared } from "./prepare";
import { usePersistent } from "./storage";
import { AuthorError, Button, Row, Status } from "./ui";

export interface PredictOutputProps {
  id?: string;                                   // for saving; unique on the page
  circuit: CircuitSpec;
  switches: string | Record<string, 0 | 1>;      // "101" in input order, or { a: 1, ... }
  wires?: { wire: string; label: string; place?: "above" | "below" | "right" }[];     // inner wires to ask about, by source id
  askBulbs?: boolean;                            // ask about the bulbs too (default true)
  scale?: number;
}

type Answers = Record<string, Bit | null>; // key "bulb:<id>" or "wire:<id>"

export default function PredictOutput({ id, circuit, switches, wires = [], askBulbs = true, scale }: PredictOutputProps) {
  const P = usePrepared(circuit);
  const setting = useMemo(() => settingOf(P.inputIds, switches), [P, switches]);
  const values = useMemo(() => evaluateNet(P.net, setting), [P, setting]);

  const keys = useMemo(
    () => [...(askBulbs ? P.outputIds.map((o) => `bulb:${o}`) : []), ...wires.map((w) => `wire:${w.wire}`)],
    [P, askBulbs, wires],
  );
  const blank = () => Object.fromEntries(keys.map((k) => [k, null])) as Answers;
  const [answers, setAnswers, reset] = usePersistent<Answers>(id, "predict", blank, (s) =>
    s && typeof s === "object" && keys.every((k) => k in (s as object)) ? (s as Answers) : null,
  );
  const [verdict, setVerdict] = useState<"right" | "wrong" | "incomplete" | null>(null);

  if (P.error || !P.laid) return <AuthorError>{P.error}</AuthorError>;
  for (const w of wires) if (!(w.wire in values)) return <AuthorError>Wire "{w.wire}" is not a switch or gate of this circuit.</AuthorError>;

  const truth = (k: string): Bit => {
    const [kind, x] = k.split(/:(.*)/s);
    if (kind === "bulb") return values[P.net.outputs.find((o) => o.id === x)!.source!] as Bit;
    return values[x] as Bit;
  };
  const cycle = (k: string) => {
    setVerdict(null);
    setAnswers((a) => ({ ...a, [k]: a[k] === null || a[k] === undefined ? 1 : a[k] === 1 ? 0 : 1 }));
  };
  const check = () => {
    if (keys.some((k) => answers[k] === null || answers[k] === undefined)) return setVerdict("incomplete");
    setVerdict(keys.every((k) => answers[k] === truth(k)) ? "right" : "wrong");
  };
  const solved = verdict === "right";

  const switchesShown = Object.fromEntries(P.inputIds.map((i) => [i, setting[i]]));
  const bulbs = Object.fromEntries(
    P.outputIds.map((o) => [o, solved || !askBulbs ? (solved ? truth(`bulb:${o}`) : null) : (answers[`bulb:${o}`] ?? null)]),
  );

  return (
    <div className="not-prose" style={{ margin: "12px 0" }}>
      <FixedCircuit
        circuit={P.laid}
        switches={switchesShown}
        values={solved ? values : null}
        bulbs={bulbs}
        bulbDigits
        onBulb={askBulbs && !solved ? (o) => cycle(`bulb:${o}`) : undefined}
        tags={wires.map((w) => ({
          wire: w.wire,
          label: w.label,
          place: w.place,
          value: solved ? truth(`wire:${w.wire}`) : (answers[`wire:${w.wire}`] ?? null),
          onTap: solved ? undefined : () => cycle(`wire:${w.wire}`),
        }))}
        scale={scale}
      />
      {!solved && (
        <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
          Tap {askBulbs ? (P.outputIds.length > 1 ? "each bulb" : "the bulb") : ""}
          {askBulbs && wires.length ? " and " : ""}
          {wires.length ? (wires.length > 1 ? "each tag" : "the tag") : ""} to change your answer.
        </div>
      )}
      <Row>
        <Button main onClick={check} disabled={solved}>Check</Button>
        <Button onClick={() => { reset(); setVerdict(null); }}>Reset</Button>
      </Row>
      {verdict === "right" && <Status tone="right">{MSG.predictRight}</Status>}
      {verdict === "wrong" && <Status tone="wrong">{MSG.predictWrong}</Status>}
      {verdict === "incomplete" && <Status tone="info">{MSG.predictIncomplete}</Status>}
    </div>
  );
}
