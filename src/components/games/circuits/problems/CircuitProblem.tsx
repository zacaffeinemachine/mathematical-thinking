import type { ReactNode } from "react";

// The numbered card around one circuit problem, matching the look of
// fsm/Problem.tsx. Static: render it with no client directive, and put the
// interactive component inside it with client:visible.
//
//   <CircuitProblem n={3} title="Both down">
//     Statement...
//     <CircuitBuilder client:visible id="both-down" ... />
//   </CircuitProblem>

export default function CircuitProblem({
  n,
  title,
  hard = false,
  children,
}: {
  n: number;
  title: string;
  hard?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="circuit-problem"
      style={{
        margin: "20px 0",
        padding: "14px 18px 16px",
        border: "1px solid var(--rule)",
        borderLeft: `4px solid ${hard ? "var(--ink)" : "var(--accent)"}`,
        borderRadius: 4,
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
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
      </div>
      {children}
    </div>
  );
}
