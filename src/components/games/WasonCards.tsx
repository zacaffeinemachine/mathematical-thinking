import { useState } from "react";

type CardId = "red" | "blue" | "four" | "seven";

interface Card {
  id: CardId;
  kind: "color" | "digit";
  label: string;
}

const CARDS: Card[] = [
  { id: "red",   kind: "color", label: "RED"  },
  { id: "blue",  kind: "color", label: "BLUE" },
  { id: "four",  kind: "digit", label: "4"    },
  { id: "seven", kind: "digit", label: "7"    },
];

const CORRECT: ReadonlySet<CardId> = new Set<CardId>(["red", "seven"]);

export default function WasonCards() {
  const [selected, setSelected] = useState<Set<CardId>>(new Set());
  const [verdict, setVerdict] = useState<"correct" | "wrong" | null>(null);

  const toggle = (id: CardId) => {
    if (verdict === "correct") return;
    setVerdict(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const check = () => {
    if (selected.size === 0) return;
    const ok =
      selected.size === CORRECT.size &&
      [...selected].every((s) => CORRECT.has(s));
    setVerdict(ok ? "correct" : "wrong");
  };

  const reset = () => {
    setSelected(new Set());
    setVerdict(null);
  };

  return (
    <figure className="not-prose my-10">
      <div className="flex flex-col items-center gap-6">
        <div className="flex gap-4 flex-wrap justify-center">
          {CARDS.map((c) => {
            const isSel = selected.has(c.id);
            return (
              <WasonCard
                key={c.id}
                card={c}
                selected={isSel}
                disabled={verdict === "correct"}
                onClick={() => toggle(c.id)}
              />
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-sm flex-wrap justify-center">
          <button
            onClick={check}
            disabled={selected.size === 0 || verdict != null}
            className="px-4 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Check
          </button>
          <button
            onClick={reset}
            className="px-3 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] transition-colors"
          >
            Reset
          </button>
          {verdict === "correct" && (
            <span
              className="font-medium"
              style={{ color: "var(--accent)" }}
              role="status"
            >
              Correct.
            </span>
          )}
          {verdict === "wrong" && (
            <span
              className="font-medium text-[var(--muted)]"
              role="status"
            >
              Try again.
            </span>
          )}
        </div>
      </div>
    </figure>
  );
}

function WasonCard({
  card,
  selected,
  disabled,
  onClick,
}: {
  card: Card;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const isColor = card.kind === "color";

  const background =
    card.id === "red"
      ? "#c0392b"
      : card.id === "blue"
        ? "#2563eb"
        : "#fafafa";

  const foreground = isColor ? "#ffffff" : "#18181b";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={
        isColor
          ? `${card.label.toLowerCase()}-coloured card${selected ? ", selected" : ""}`
          : `card showing digit ${card.label}${selected ? ", selected" : ""}`
      }
      style={{
        width: 104,
        height: 148,
        borderRadius: 10,
        border: `3px solid ${selected ? "var(--accent)" : "rgba(0,0,0,0.15)"}`,
        background,
        color: foreground,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        transform: selected ? "translateY(-10px)" : "translateY(0)",
        transition:
          "transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease",
        boxShadow: selected
          ? "0 10px 18px rgba(0,0,0,0.22)"
          : "0 2px 6px rgba(0,0,0,0.10)",
        overflow: "hidden",
        padding: 0,
      }}
    >
      {card.kind === "digit" ? (
        <span
          style={{
            fontSize: 72,
            fontWeight: 500,
            fontFamily: "Georgia, 'Times New Roman', serif",
            lineHeight: 1,
            color: card.id === "seven" ? "#18181b" : "#c0392b",
          }}
        >
          {card.label}
        </span>
      ) : (
        // Subtle inner frame to evoke a card back
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 10,
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.35)",
          }}
        />
      )}
    </button>
  );
}
