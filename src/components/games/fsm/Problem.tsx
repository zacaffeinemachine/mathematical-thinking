import type { ReactNode } from "react";

// The furniture of a problem page. One <Problem> per question, so the MDX
// carries the mathematics and nothing else.
//
// No solutions anywhere in this file, deliberately. These pages exist to
// keep the quick students busy during class, and a fold-out answer is the
// one thing that would empty them of work. What a student gets instead is
// <Tests>: a handful of strings the machine must accept and a handful it
// must reject, which settles what the question means and lets a design be
// checked by hand without giving the diagram away.

const MONO = 'ui-monospace, "JetBrains Mono", Menlo, monospace';

export function Problem({
  n,
  title,
  alphabet = "{0, 1}",
  hard = false,
  children,
}: {
  n: number;
  title: string;
  // Every problem says what its machine reads. It defaults to binary
  // because most of them are, never because it is optional.
  alphabet?: string;
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
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 6,
        }}
      >
        <span
          style={{
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--muted)",
            fontWeight: 600,
          }}
        >
          {n}. {title}
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
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          alphabet <code style={{ fontFamily: MONO }}>{alphabet}</code>
        </span>
      </div>
      {children}
    </div>
  );
}

// The strings a correct machine must get right. Not a hint: a statement of
// what the words in the question mean.
export function Tests({
  accept = [],
  reject = [],
}: {
  accept?: string[];
  reject?: string[];
}) {
  const Row = ({
    label,
    items,
    tone,
  }: {
    label: string;
    items: string[];
    tone: "accept" | "reject";
  }) => (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 6 }}>
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--muted)",
          minWidth: 92,
        }}
      >
        {label}
      </span>
      {items.map((s) => (
        <code
          key={s || "(empty)"}
          style={{
            fontFamily: MONO,
            fontSize: 12.5,
            padding: "1px 7px",
            borderRadius: 3,
            border: `1px solid var(--fsm-${tone})`,
            background: `var(--fsm-${tone}-soft)`,
            color: "var(--ink)",
          }}
        >
          {s.length === 0 ? "(empty)" : s}
        </code>
      ))}
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 5,
        marginTop: 10,
        paddingTop: 10,
        borderTop: "1px solid var(--rule)",
      }}
    >
      {accept.length > 0 && <Row label="must accept" items={accept} tone="accept" />}
      {reject.length > 0 && <Row label="must reject" items={reject} tone="reject" />}
    </div>
  );
}
