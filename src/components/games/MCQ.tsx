import { useState, type ReactNode } from "react";

// ---------------------------------------------------------------------------
//  Multiple-choice self-test.
//
//  House rule, non-negotiable: the ONLY feedback a student ever gets is
//  whether the answer was right. There is no explanation field on Question,
//  and there must never be one — a reveal here would undo the point of the
//  page. See SITE_OVERVIEW.md, "The MCQ pattern".
//
//  A question never locks. Right or wrong, the student can change their
//  selection and submit again. (This is the one place the component departs
//  from WasonCards.tsx, which freezes on a correct answer.)
// ---------------------------------------------------------------------------

// The two verdict messages, kept together so the tone can be changed in one
// place. They are jokes; see SITE_OVERVIEW.md, "The MCQ pattern", for the note
// on why the wording is worth a second look before a class actually uses it.
const SAY_RIGHT = "You got lucky.";
const SAY_WRONG = "Better luck next time.";

export interface Question {
  prompt: string;
  options: string[];
  /** A number is a single-answer question; an array is select-all-that-apply. */
  answer: number | number[];
}

// KaTeX runs at build time over MDX only, so `$…$` inside this island would
// ship as literal dollar signs. Chapter 2 introduces no symbols at all, so
// prompts and options are plain English with two bits of inline markup:
// *emphasis* and `code`.
function inline(text: string): ReactNode[] {
  return text.split(/(\*[^*]+\*|`[^`]+`)/g).map((piece, i) => {
    if (piece.startsWith("*") && piece.endsWith("*") && piece.length > 2)
      return <em key={i}>{piece.slice(1, -1)}</em>;
    if (piece.startsWith("`") && piece.endsWith("`") && piece.length > 2)
      return <code key={i}>{piece.slice(1, -1)}</code>;
    return piece;
  });
}

function sameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export function MCQ({ n, question }: { n: number; question: Question }) {
  const multi = Array.isArray(question.answer);
  const key = multi ? (question.answer as number[]) : [question.answer as number];

  const [selected, setSelected] = useState<number[]>([]);
  const [verdict, setVerdict] = useState<"correct" | "wrong" | null>(null);

  const toggle = (i: number) => {
    const next = multi
      ? selected.includes(i)
        ? selected.filter((x) => x !== i)
        : [...selected, i]
      : [i];
    // Re-clicking the option already chosen is not a change, and should not
    // wipe a verdict the student is still reading.
    if (sameSet(next, selected)) return;
    setSelected(next);
    setVerdict(null);
  };

  const submit = () => {
    if (selected.length === 0) return;
    setVerdict(sameSet(selected, key) ? "correct" : "wrong");
  };

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
          marginBottom: 6,
        }}
      >
        Question {n}
        {multi && " — select all that apply"}
      </div>

      <p style={{ margin: "0 0 14px", lineHeight: 1.6 }}>
        {inline(question.prompt)}
      </p>

      <div
        role={multi ? "group" : "radiogroup"}
        aria-label={`Options for question ${n}`}
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        {question.options.map((opt, i) => {
          const isSel = selected.includes(i);
          // A selected option is neutral until it is submitted; then it takes
          // the verdict's colour. Only the options the student actually chose
          // are coloured — never the correct one, which would give the answer
          // away on a wrong submission.
          const tone =
            !isSel ? null
            : verdict === "correct" ? "right"
            : verdict === "wrong" ? "wrong"
            : "pick";
          return (
            <button
              key={i}
              type="button"
              role={multi ? "checkbox" : "radio"}
              aria-checked={isSel}
              onClick={() => toggle(i)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                borderRadius: 6,
                border: `1px solid ${tone ? `var(--mcq-${tone})` : "var(--rule)"}`,
                background: tone ? `var(--mcq-${tone}-soft)` : "transparent",
                color:
                  tone === "right" || tone === "wrong"
                    ? `var(--mcq-${tone})`
                    : "var(--ink)",
                font: "inherit",
                lineHeight: 1.55,
                cursor: "pointer",
                transition: "border-color 150ms ease, background 150ms ease",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  flex: "0 0 auto",
                  marginTop: "0.28em",
                  width: 13,
                  height: 13,
                  borderRadius: multi ? 3 : "50%",
                  border: `1px solid ${tone ? `var(--mcq-${tone})` : "var(--muted)"}`,
                  background: tone ? `var(--mcq-${tone})` : "transparent",
                  boxShadow: tone ? "inset 0 0 0 2px var(--surface)" : "none",
                }}
              />
              <span>{inline(opt)}</span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginTop: 14,
          fontSize: 14,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={submit}
          disabled={selected.length === 0}
          className="px-4 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Submit
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

export default function QuizSet({ questions }: { questions: Question[] }) {
  return (
    <div className="not-prose my-8">
      {questions.map((q, i) => (
        <MCQ key={i} n={i + 1} question={q} />
      ))}
    </div>
  );
}
