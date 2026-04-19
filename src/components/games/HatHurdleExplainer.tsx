import { useState } from "react";

export default function HatHurdleExplainer() {
  const [riddleOpen, setRiddleOpen] = useState(false);
  const [riddleAnswer, setRiddleAnswer] = useState("");
  const [riddleError, setRiddleError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const submitRiddle = () => {
    const normalized = riddleAnswer.trim().toLowerCase();
    if (normalized === "near") {
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
              When the great detective falls, a pale boy in white inherits
              the hunt. He kneels among scattered toys &mdash; dice, dominoes,
              tiny finger-puppets &mdash; and from that quiet litter he
              builds, piece by piece, the cage that finally closes around
              the boy-god. In a single word: name him.
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
                Not quite &mdash; recall who finally outplayed Light after the
                great detective was gone.
              </p>
            )}
          </div>
        )}

        {unlocked && (
          <div className="w-full max-w-xl p-5 rounded-lg border border-[var(--rule)] bg-[var(--surface)] text-sm leading-relaxed space-y-3">
            <p>
              The trick is to listen to the <em>silences</em>. A logician saying
              <em> &ldquo;I don't know&rdquo;</em> looks like nothing &mdash; but
              it carries information about what they <em>can see</em>.
            </p>
            <p>Walk down the line, in the order the warden asks:</p>
            <ol className="list-decimal pl-6 space-y-2">
              <li>
                <strong>Logician 4</strong> sees no one. They could never have
                known their hat colour, so their <em>&ldquo;I don't know&rdquo;</em>
                {" "}was inevitable. <em>It tells the others nothing.</em>
              </li>
              <li>
                <strong>Logician 3</strong> faces only the brick wall. Same
                story: their answer was forced. <em>Still no information.</em>
              </li>
              <li>
                <strong>Logician 2</strong> sees Logician 3's hat &mdash; just
                one hat &mdash; which is not enough to pin down their own.
                Their <em>&ldquo;I don't know&rdquo;</em> at this stage is also
                forced.
              </li>
              <li>
                <strong>Logician 1</strong> is the one with real information:
                they see <em>both</em> 2 and 3.{" "}
                <strong>If 2 and 3 wore the same colour</strong> &mdash; say
                both red &mdash; then since only two red hats exist, Logician 1
                would <em>know</em> their own hat must be blue. The fact that
                Logician 1 says <em>&ldquo;I don't know&rdquo;</em> announces,
                loud and clear:{" "}
                <strong>2 and 3 are wearing different colours.</strong>
              </li>
            </ol>
            <p>
              Now Logician 2 has everything they need. They can see Logician 3's
              hat, and they have just learned that their own hat is the{" "}
              <em>opposite</em> colour. So Logician 2 announces:{" "}
              <strong>
                &ldquo;My hat is the colour <em>opposite</em> to the one I see
                on Logician 3.&rdquo;
              </strong>
            </p>
            <p>
              The lesson: in puzzles like this, an <em>&ldquo;I don't
              know&rdquo;</em> from someone with a wide view is far more
              informative than a confident answer from someone with no view at
              all. Information hides in what a careful reasoner <em>cannot</em>{" "}
              conclude.
            </p>
          </div>
        )}
      </div>
    </figure>
  );
}
