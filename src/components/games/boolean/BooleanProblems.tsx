import { useState, type ReactNode } from "react";
import { SAY_RIGHT, SAY_WRONG } from "../MCQ.tsx";
import { ParseError, parseSolutionSet, sameSolutions, solutions } from "./equation.ts";

// ---------------------------------------------------------------------------
//  The furniture of the two Boolean Algebra problem pages.
//
//  Same house rule as MCQ.tsx and PuzzleAnswer.tsx: the ONLY feedback about
//  the mathematics is right or wrong. A message saying the input could not be
//  read is not feedback about the mathematics, so the equation box gives one.
//  It never says which pattern an answer gets wrong.
//
//  <EquationAnswer> accepts any equation, or list of equations, that holds on
//  exactly the same patterns as the intended one. <SolutionSet> takes the set
//  of all solutions, typed out, and is marked all-or-nothing like the puzzle
//  answer sheets. It replaced a grid of every pattern to tick, which let a
//  student skip the solving and just substitute each pattern in turn.
// ---------------------------------------------------------------------------

const MONO = 'ui-monospace, "JetBrains Mono", Menlo, monospace';

export function Problem({
  n,
  hard = false,
  children,
}: {
  n: number;
  hard?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        margin: "20px 0",
        padding: "14px 18px 16px",
        border: "1px solid var(--rule)",
        borderLeft: `4px solid ${hard ? "var(--ink)" : "var(--accent)"}`,
        borderRadius: 4,
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--muted)",
            fontWeight: 600,
          }}
        >
          Problem {n}
        </span>
        {hard && (
          <span
            style={{
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "1px 7px",
              borderRadius: 999,
              border: "1px solid var(--ink)",
              color: "var(--ink)",
            }}
          >
            harder
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

type Verdict = "correct" | "wrong" | null;

function Buttons({
  onSubmit,
  onClear,
  canSubmit,
  canClear,
  verdict,
  note,
}: {
  onSubmit: () => void;
  onClear: () => void;
  canSubmit: boolean;
  canClear: boolean;
  verdict: Verdict;
  note?: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginTop: 12,
        fontSize: 14,
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={onSubmit}
        disabled={!canSubmit}
        className="px-4 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Submit
      </button>
      <button
        type="button"
        onClick={onClear}
        disabled={!canClear}
        className="px-3 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Clear
      </button>
      {note && (
        <span role="status" style={{ color: "var(--muted)" }}>
          {note}
        </span>
      )}
      {!note && verdict === "correct" && (
        <span role="status" style={{ color: "var(--mcq-right)", fontWeight: 500 }}>
          {SAY_RIGHT}
        </span>
      )}
      {!note && verdict === "wrong" && (
        <span role="status" style={{ color: "var(--mcq-wrong)", fontWeight: 500 }}>
          {SAY_WRONG}
        </span>
      )}
    </div>
  );
}

function tone(v: Verdict) {
  return v === "correct" ? "right" : v === "wrong" ? "wrong" : null;
}

/** A box for a typed equation, marked by the patterns it allows. */
export function EquationAnswer({ letters, answer }: { letters: string; answer: string }) {
  const [text, setText] = useState("");
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [note, setNote] = useState<string | null>(null);

  const submit = () => {
    if (!text.trim()) return;
    try {
      solutions(text, letters);
    } catch (e) {
      setVerdict(null);
      setNote(e instanceof ParseError ? `Could not read that. ${e.message}` : "Could not read that.");
      return;
    }
    setNote(null);
    setVerdict(sameSolutions(text, answer, letters) ? "correct" : "wrong");
  };

  const t = tone(verdict);
  return (
    <div style={{ marginTop: 12 }}>
      <input
        type="text"
        value={text}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        aria-label="Your equation"
        placeholder="type an equation"
        onChange={(e) => {
          setText(e.target.value);
          setVerdict(null);
          setNote(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "6px 10px",
          borderRadius: 6,
          border: `1px solid ${t ? `var(--mcq-${t})` : "var(--rule)"}`,
          background: t ? `var(--mcq-${t}-soft)` : "transparent",
          color: "var(--ink)",
          fontFamily: MONO,
          fontSize: 15,
        }}
      />
      <Buttons
        onSubmit={submit}
        onClear={() => {
          setText("");
          setVerdict(null);
          setNote(null);
        }}
        canSubmit={text.trim() !== ""}
        canClear={text !== ""}
        verdict={verdict}
        note={note}
      />
    </div>
  );
}

/**
 * A box for the set of all solutions, e.g. `{(0, 1), (1, 0)}`, or `∅` when
 * there are none. `answer` is the list of solutions as 0/1 strings in letter
 * order, e.g. ["101", "011"].
 */
export function SolutionSet({ letters, answer }: { letters: string; answer: string[] }) {
  const [text, setText] = useState("");
  const [verdict, setVerdict] = useState<Verdict>(null);
  const [note, setNote] = useState<string | null>(null);

  const submit = () => {
    if (!text.trim()) return;
    let got: string[];
    try {
      got = parseSolutionSet(text, letters);
    } catch (e) {
      setVerdict(null);
      setNote(e instanceof ParseError ? `Could not read that. ${e.message}` : "Could not read that.");
      return;
    }
    setNote(null);
    const right = got.length === answer.length && answer.every((p) => got.includes(p));
    setVerdict(right ? "correct" : "wrong");
  };
  const header = `(${letters.split("").join(", ")})`;
  const t = tone(verdict);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
        Enter the set of all solutions <span style={{ fontFamily: MONO }}>{header}</span>, or{" "}
        <span style={{ fontFamily: MONO }}>{"{}"}</span> if there are none.
      </div>
      <input
        type="text"
        value={text}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        aria-label="The set of all solutions"
        placeholder="type a set"
        onChange={(e) => {
          setText(e.target.value);
          setVerdict(null);
          setNote(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "6px 10px",
          borderRadius: 6,
          border: `1px solid ${t ? `var(--mcq-${t})` : "var(--rule)"}`,
          background: t ? `var(--mcq-${t}-soft)` : "transparent",
          color: "var(--ink)",
          fontFamily: MONO,
          fontSize: 15,
        }}
      />
      <Buttons
        onSubmit={submit}
        onClear={() => {
          setText("");
          setVerdict(null);
          setNote(null);
        }}
        canSubmit={text.trim() !== ""}
        canClear={text !== ""}
        verdict={verdict}
        note={note}
      />
    </div>
  );
}
