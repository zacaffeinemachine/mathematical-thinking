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

  const [riddleOpen, setRiddleOpen] = useState(false);
  const [riddleAnswer, setRiddleAnswer] = useState("");
  const [riddleError, setRiddleError] = useState(false);
  const [explainerUnlocked, setExplainerUnlocked] = useState(false);

  const submitRiddle = () => {
    const normalized = riddleAnswer.trim().toLowerCase();
    if (normalized === "ryuk") {
      setExplainerUnlocked(true);
      setRiddleOpen(false);
      setRiddleError(false);
    } else {
      setRiddleError(true);
    }
  };

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

        {!explainerUnlocked && (
          <button
            onClick={() => {
              setRiddleOpen((v) => !v);
              setRiddleError(false);
            }}
            className="text-[10px] tracking-wider uppercase text-[var(--muted)] hover:text-[var(--ink)] transition-colors mt-2 opacity-40 hover:opacity-80"
            style={{ background: "none", border: "none", padding: "2px 4px", cursor: "pointer" }}
            aria-label="Reveal hint"
          >
            mind over matter
          </button>
        )}

        {riddleOpen && !explainerUnlocked && (
          <div className="w-full max-w-md p-4 rounded-lg border border-[var(--rule)] bg-[var(--surface)]">
            <p className="text-sm mb-3">
              Bored of his eternal grey realm, a shinigami lets a black
              notebook fall into the human world and follows it down — unseen
              by all who have not yet touched its cover. He shadows the new
              boy-god, asks for nothing but apples, and laughs as the wicked
              drop dead by the score. In a single word: name him.
              <br />
              <em className="text-[var(--muted)]">One word.</em>
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitRiddle();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={riddleAnswer}
                onChange={(e) => {
                  setRiddleAnswer(e.target.value);
                  setRiddleError(false);
                }}
                placeholder="your answer"
                aria-label="Riddle answer"
                autoFocus
                className="flex-1 px-3 py-1.5 rounded-md border border-[var(--rule)] bg-[var(--bg)] text-sm focus:outline-none focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 rounded-md border border-[var(--rule)] hover:border-[var(--accent)] text-sm transition-colors"
              >
                Answer
              </button>
            </form>
            {riddleError && (
              <p className="text-xs mt-2" style={{ color: "var(--accent)" }}>
                Not quite — recall the apple-fond shadow at Light's shoulder.
              </p>
            )}
          </div>
        )}

        {explainerUnlocked && (
          <div className="w-full max-w-xl p-5 rounded-lg border border-[var(--rule)] bg-[var(--surface)] text-sm leading-relaxed space-y-3">
            <p>
              Rewrite the claim in its bare logical shape:
              <br />
              <strong>If a card is red, then its other side is even.</strong>
            </p>
            <p>
              An <em>If &nbsp;P, then Q</em> claim makes exactly one promise:
              that you will <em>never</em> meet a card with{" "}
              <em>P&nbsp;true and Q&nbsp;false</em>. So the only way to
              <em> refute</em> the claim is to find a card that is{" "}
              <strong>red on one side and odd on the other</strong>. Anything
              else &mdash; a blue card, an even-numbered card &mdash; cannot
              break the promise, no matter what is written on its back.
            </p>
            <p>
              Walk through the four cards with this in mind:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>Red.</strong> Could hide an odd number. That would
                refute the claim. <em>Must flip.</em>
              </li>
              <li>
                <strong>Blue.</strong> The claim says nothing about blue
                cards. Whatever is on the back, the promise stands.{" "}
                <em>Don't flip.</em>
              </li>
              <li>
                <strong>4.</strong> The claim only forbids red&nbsp;&amp;&nbsp;odd.
                A red back here would still satisfy the promise (red&nbsp;&amp;&nbsp;even,
                which is allowed); a blue back is irrelevant. Either way,
                nothing to learn. <em>Don't flip.</em>
              </li>
              <li>
                <strong>7.</strong> Could hide a red colour. That would
                refute the claim. <em>Must flip.</em>
              </li>
            </ul>
            <p>
              So the answer is <strong>red and 7</strong>. Most people
              instinctively pick <em>red and 4</em> &mdash; they look for
              evidence that <em>confirms</em> the rule. Mathematics rewards
              the opposite reflex: hunt for the case that would <em>break</em>{" "}
              the rule, and check exactly there.
            </p>
          </div>
        )}
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
