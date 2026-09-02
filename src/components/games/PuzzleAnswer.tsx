import { useState } from "react";
import { SAY_RIGHT, SAY_WRONG } from "./MCQ.tsx";

// ---------------------------------------------------------------------------
//  Answer sheet for a logic puzzle.
//
//  Same house rule as MCQ.tsx, and for the same reason: the ONLY feedback a
//  student ever gets is whether the answer was right. There is no explanation
//  field on Field or on Puzzle, and there must never be one.
//
//  The rule bites harder here than it does on an MCQ card, because an answer
//  sheet has several parts. The verdict is therefore ALL-OR-NOTHING and is
//  reported once for the whole sheet. Per-row ticks would let a student read
//  off a solution one row at a time, which is a reveal in instalments.
//
//  Nothing locks. Right or wrong, the sheet can be changed and submitted again.
// ---------------------------------------------------------------------------

/** One row of the sheet: a labelled question with a small, fixed set of answers. */
export interface ChoiceField {
  kind: "choice";
  label: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
}

/** One row of the sheet asking for a whole number. */
export interface NumberField {
  kind: "number";
  label: string;
  answer: number;
  /** Words printed after the box, e.g. "chimeras". */
  unit?: string;
}

export type Field = ChoiceField | NumberField;

export interface Puzzle {
  /** Printed above the sheet; the puzzle statement itself lives in the MDX. */
  title?: string;
  fields: Field[];
}

type Verdict = "correct" | "wrong" | null;

// A blank sheet: choices unpicked (-1), number boxes empty ("").
function blank(fields: Field[]): (number | string)[] {
  return fields.map((f) => (f.kind === "choice" ? -1 : ""));
}

function tone(verdict: Verdict): "right" | "wrong" | "pick" {
  return verdict === "correct" ? "right" : verdict === "wrong" ? "wrong" : "pick";
}

export function PuzzleAnswer({ puzzle }: { puzzle: Puzzle }) {
  const { fields } = puzzle;
  const [entries, setEntries] = useState<(number | string)[]>(() => blank(fields));
  const [verdict, setVerdict] = useState<Verdict>(null);

  // Every row must be filled in before the sheet can be handed over. A
  // half-filled sheet submitted as wrong would be feedback about the rows the
  // student did fill in.
  const complete = entries.every((e, i) =>
    fields[i].kind === "choice" ? (e as number) >= 0 : String(e).trim() !== "",
  );
  const touched = entries.some((e, i) =>
    fields[i].kind === "choice" ? (e as number) >= 0 : String(e) !== "",
  );

  const set = (i: number, value: number | string) => {
    if (entries[i] === value) return;   // not a change; leave a verdict standing
    const next = [...entries];
    next[i] = value;
    setEntries(next);
    setVerdict(null);
  };

  const submit = () => {
    if (!complete) return;
    const right = fields.every((f, i) =>
      f.kind === "choice"
        ? entries[i] === f.answer
        : Number(String(entries[i]).trim()) === f.answer,
    );
    setVerdict(right ? "correct" : "wrong");
  };

  const clear = () => {
    setEntries(blank(fields));
    setVerdict(null);
  };

  const marked = verdict !== null;

  return (
    <div
      style={{
        margin: "20px 0",
        padding: "14px 18px 16px",
        border: "1px solid var(--rule)",
        borderLeft: "4px solid var(--accent)",
        borderRadius: 4,
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--muted)",
          fontWeight: 600,
          marginBottom: 10,
        }}
      >
        {puzzle.title ?? "Your answer"}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {fields.map((field, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "baseline",
              gap: "6px 12px",
            }}
          >
            <span
              style={{
                flex: "0 0 auto",
                minWidth: 150,
                lineHeight: 1.55,
              }}
            >
              {field.label}
            </span>

            {field.kind === "choice" ? (
              <div
                role="radiogroup"
                aria-label={field.label}
                style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
              >
                {field.options.map((opt, j) => {
                  const picked = entries[i] === j;
                  const t = picked ? tone(verdict) : null;
                  return (
                    <button
                      key={j}
                      type="button"
                      role="radio"
                      aria-checked={picked}
                      onClick={() => set(i, j)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 6,
                        border: `1px solid ${t ? `var(--mcq-${t})` : "var(--rule)"}`,
                        background: t ? `var(--mcq-${t}-soft)` : "transparent",
                        color:
                          t === "right" || t === "wrong"
                            ? `var(--mcq-${t})`
                            : "var(--ink)",
                        font: "inherit",
                        fontSize: 14,
                        lineHeight: 1.4,
                        cursor: "pointer",
                        transition:
                          "border-color 150ms ease, background 150ms ease",
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
                <input
                  type="text"
                  inputMode="numeric"
                  aria-label={field.label}
                  value={entries[i] as string}
                  // Digits only, so a stray letter cannot be the reason a
                  // correct answer is marked wrong.
                  onChange={(e) => set(i, e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  style={{
                    width: 72,
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: `1px solid ${
                      marked && String(entries[i]).trim() !== ""
                        ? `var(--mcq-${tone(verdict)})`
                        : "var(--rule)"
                    }`,
                    background:
                      marked && String(entries[i]).trim() !== ""
                        ? `var(--mcq-${tone(verdict)}-soft)`
                        : "transparent",
                    color:
                      marked && String(entries[i]).trim() !== ""
                        ? `var(--mcq-${tone(verdict)})`
                        : "var(--ink)",
                    font: "inherit",
                    fontSize: 14,
                    textAlign: "center",
                  }}
                />
                {field.unit && (
                  <span style={{ fontSize: 14, color: "var(--muted)" }}>
                    {field.unit}
                  </span>
                )}
              </span>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 16,
          fontSize: 14,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={submit}
          disabled={!complete}
          className="px-4 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Submit
        </button>
        <button
          type="button"
          onClick={clear}
          disabled={!touched}
          className="px-3 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Clear
        </button>
        {verdict === "correct" && (
          <span role="status" style={{ color: "var(--mcq-right)", fontWeight: 500 }}>
            {SAY_RIGHT}
          </span>
        )}
        {verdict === "wrong" && (
          <span role="status" style={{ color: "var(--mcq-wrong)", fontWeight: 500 }}>
            {SAY_WRONG}
          </span>
        )}
      </div>
    </div>
  );
}

export default PuzzleAnswer;
