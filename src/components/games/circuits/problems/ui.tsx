// Small pieces of furniture shared by the problem components.

import type { CSSProperties, ReactNode } from "react";

export const BTN =
  "px-3 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm";
export const BTN_MAIN =
  "px-4 py-1.5 rounded-md border border-[var(--ink)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium";

export function Button({
  onClick, disabled, children, main = false, title, pressed,
}: {
  onClick: () => void; disabled?: boolean; children: ReactNode; main?: boolean; title?: string; pressed?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-pressed={pressed}
      className={main ? BTN_MAIN : BTN}
      style={pressed ? { borderColor: "var(--accent)", background: "var(--accent-soft)" } : undefined}
    >
      {children}
    </button>
  );
}

export type Tone = "right" | "wrong" | "info";

export function Status({ tone, children }: { tone: Tone; children: ReactNode }) {
  const color = tone === "right" ? "var(--mcq-right)" : tone === "wrong" ? "var(--mcq-wrong)" : "var(--muted)";
  return (
    <div
      role="status"
      style={{
        marginTop: 10,
        padding: tone === "info" ? 0 : "8px 12px",
        borderRadius: 6,
        border: tone === "info" ? "none" : `1px solid ${color}`,
        background: tone === "right" ? "var(--mcq-right-soft)" : tone === "wrong" ? "var(--mcq-wrong-soft)" : "transparent",
        color,
        fontSize: 14,
        fontWeight: tone === "info" ? 400 : 500,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10, ...style }}>
      {children}
    </div>
  );
}

// Shown on the page when an author has passed something the component cannot
// use, so the mistake is seen in the dev server instead of shipping silently.
export function AuthorError({ children }: { children: ReactNode }) {
  return (
    <div style={{ margin: "10px 0", padding: "8px 12px", border: "2px dashed #b45309", color: "#b45309", fontSize: 13, borderRadius: 6 }}>
      <strong>Problem setup error:</strong> {children}
    </div>
  );
}

// Wrapper that makes an SVG scale down to fit the column, never larger than
// `scale` times its natural size.
export function svgBox(width: number, scale = 1.15): CSSProperties {
  return {
    width: "100%",
    maxWidth: width * scale,
    height: "auto",
    display: "block",
    margin: "0 auto",
    background: "var(--surface)",
    border: "1px solid var(--rule)",
    borderRadius: 6,
  };
}
