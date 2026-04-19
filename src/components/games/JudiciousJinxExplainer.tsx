import { useState } from "react";

export default function JudiciousJinxExplainer() {
  const [riddleOpen, setRiddleOpen] = useState(false);
  const [riddleAnswer, setRiddleAnswer] = useState("");
  const [riddleError, setRiddleError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const submitRiddle = () => {
    const normalized = riddleAnswer.trim().toLowerCase();
    if (normalized === "mello") {
      setUnlocked(true);
      setRiddleOpen(false);
      setRiddleError(false);
    } else {
      setRiddleError(true);
    }
  };

  return (
    <figure className="not-prose my-10">
      <div className="flex flex-col items-center gap-5">
        {!unlocked && (
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

        {riddleOpen && !unlocked && (
          <div className="w-full max-w-md p-4 rounded-lg border border-[var(--rule)] bg-[var(--surface)]">
            <p className="text-sm mb-3">
              Blond and leather-clad, a bar of dark chocolate forever in
              hand, the impatient rival who chose fire and gunpowder over
              his quieter twin's patient toys &mdash; and burned himself
              out chasing the boy-god first. In a single word: name him.
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
                Not quite &mdash; the chocolate-fond half of the pair who
                inherited the great detective's hunt.
              </p>
            )}
          </div>
        )}

        {unlocked && (
          <div className="w-full max-w-xl p-5 rounded-lg border border-[var(--rule)] bg-[var(--surface)] text-sm leading-relaxed space-y-3">
            <p>
              The puzzle resolves in three rounds, and the third round is
              already determined the moment the second one ends. Walk through
              them carefully.
            </p>
            <p>
              <strong>Round 1.</strong> Each logician declares,{" "}
              <em>&ldquo;I see at least one red hat.&rdquo;</em> For this to
              be true of <em>every</em> logician simultaneously, no one can
              be staring at two blue hats. So{" "}
              <strong>at most one of the three hats is blue.</strong> Two
              possibilities survive:
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>(a) <strong>all three hats are red</strong>, or</li>
              <li>(b) <strong>exactly one hat is blue and the other two are red</strong>.</li>
            </ul>
            <p>
              <strong>Round 2.</strong> Now <em>imagine</em> we were in case
              (b) &mdash; one blue, two red. Pick either red-wearer and step
              into their shoes: they see <em>one blue hat and one red hat</em>.
              They have just learned (from round 1) that at most one hat is
              blue. The blue they see uses up that single permitted blue, so
              their own hat <em>must</em> be red. They would announce it on
              the spot.
            </p>
            <p>
              But all three say <em>&ldquo;I don't know.&rdquo;</em> So no
              red-wearer is in this position &mdash; which is only possible
              if no one is wearing blue at all. Case (b) is dead.
            </p>
            <p>
              <strong>Round 3.</strong> Only case (a) remains, and every
              logician has just made the same deduction. Together they
              exclaim,{" "}
              <em>&ldquo;Now I know my hat colour!&rdquo;</em>
            </p>
            <p>
              <strong>Answer.</strong>{" "}
              <strong>All three hats are red.</strong>
            </p>
            <p>
              The pattern is the same as in the previous puzzle: an{" "}
              <em>&ldquo;I don't know&rdquo;</em> spoken by a perfect
              reasoner is itself a piece of evidence &mdash; it rules out
              every world in which they <em>could</em> have known. Listen
              hard enough and silence becomes a sentence.
            </p>
          </div>
        )}
      </div>
    </figure>
  );
}
