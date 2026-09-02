import type { Puzzle } from "../PuzzleAnswer.tsx";

// ---------------------------------------------------------------------------
//  Answer keys for the Chapter 2 puzzle page (src/pages/logical-thinking/
//  puzzles.mdx). The puzzle statements live in the MDX; only the answer sheet
//  and its key live here.
//
//  Every key was settled by exhaustive search, not by hand. The script is
//  reproduced in SITE_OVERVIEW.md, "The puzzle answer-sheet pattern"; rerun it
//  before changing any entry below. Each puzzle names the place in
//  Chapters/Logical-Thinking.tex it comes from. Check the .tex, never
//  SUMMARY.md, which is stale for this chapter.
//
//  Two authoring rules, both load-bearing because no explanation is ever shown:
//    • Every keyed answer must be forced by the statement as the MDX gives it.
//      Where a puzzle leaves something open, the sheet must offer "Cannot be
//      determined" and key it, rather than quietly asking for a guess.
//    • Options must be exhaustive. A student who has reasoned correctly must
//      find their conclusion on the sheet.
// ---------------------------------------------------------------------------

const HAT = ["Red", "Blue", "Cannot be determined"];
const KIND = ["Oracle", "Chimera"];

// ===========================================================================
//  §2.5 — Knowing What Others Know
// ===========================================================================

// The Hat Hurdle, §2.5 and its solution point. The book asks for the
// deduction, which no answer sheet can mark, so the sheet fixes Logician 3's
// hat and asks what follows. Logician 1's "I do not know" forces Logicians 2
// and 3 to differ, so Logician 2 is blue; the two remaining hats are one of
// each colour and nothing separates Logician 1 from Logician 4.
export const hatHurdle: Puzzle = {
  fields: [
    { kind: "choice", label: "Logician 2's hat is", options: HAT, answer: 1 },
    { kind: "choice", label: "Logician 1's hat is", options: HAT, answer: 2 },
    {
      kind: "choice",
      label: "What told Logician 2 the answer was",
      options: [
        "Logician 4's reply",
        "Logician 3's reply",
        "Logician 1's reply",
        "Logician 3's hat on its own",
      ],
      answer: 2,
    },
  ],
};

// The Judicious Jinx, §2.5 and its solution point. Round 1 rules out fewer
// than two reds; a logician seeing exactly one red would then know their own
// colour, so "I don't know" from all three means each sees two reds.
export const judiciousJinx: Puzzle = {
  fields: [
    { kind: "choice", label: "Elara's hat is", options: HAT, answer: 0 },
    { kind: "choice", label: "Phoebe's hat is", options: HAT, answer: 0 },
    { kind: "choice", label: "Orion's hat is", options: HAT, answer: 0 },
  ],
};

// ===========================================================================
//  §2.6 — Asking About Answers
// ===========================================================================

// §2.6, Exercise 1. A plain question is answered yes by an oracle over the
// Coral box and by a chimera over the Amber one, so a) pins nothing down; the
// embedded question of Point "A question that works on either kind" makes both
// kinds answer alike, so b) pins the box down and the kind stays open.
//
// A THIRD PART WAS CUT on the author's instruction: Ariadne, of unknown kind,
// reporting what Thalia would answer. It was removed here, from puzzles.mdx
// and from the book's §2.6 exercise together, so the three stay in step.
export const oneAnswerTwoWays: Puzzle = {
  fields: [
    {
      kind: "choice",
      label: "In a) the ruby is in the",
      options: ["Coral box", "Amber box", "Cannot be determined"],
      answer: 2,
    },
    {
      kind: "choice",
      label: "In b) the ruby is in the",
      options: ["Coral box", "Amber box", "Cannot be determined"],
      answer: 0,
    },
    {
      kind: "choice",
      label: "You learn what kind Thalia is in",
      options: ["Neither of the two", "a) only", "b) only", "a) and b)"],
      answer: 0,
    },
  ],
};

// §2.6, Exercise 2. Ariadne's sentence says the Coral box and Thalia's being
// an oracle agree; Thalia's says the Amber box and Ariadne's being an oracle
// agree. Exhaustive search over three boxes and two kinds leaves two
// arrangements, and the ruby is in the Topaz box in both. The two speakers are
// of different kinds in both, and which is which is not determined.
export const twoSpeakersThreeBoxes: Puzzle = {
  fields: [
    {
      kind: "choice",
      label: "The ruby is in the",
      options: ["Coral box", "Amber box", "Topaz box", "Cannot be determined"],
      answer: 2,
    },
    {
      kind: "choice",
      label: "The two speakers are",
      options: [
        "Both oracles",
        "Both chimeras",
        "One of each, and which is which cannot be determined",
        "Nothing at all can be said about them",
      ],
      answer: 2,
    },
  ],
};

// §2.6, Exercise 6. Exactly two of the three are oracles. Exhaustive search
// over two boxes and the three arrangements with two oracles leaves one case:
// Selene is the chimera and the ruby is in the Amber box.
export const twoOraclesAndAChimera: Puzzle = {
  fields: [
    {
      kind: "choice",
      label: "The chimera is",
      options: ["Ariadne", "Selene", "Thalia"],
      answer: 1,
    },
    {
      kind: "choice",
      label: "The ruby is in the",
      options: ["Coral box", "Amber box", "Cannot be determined"],
      answer: 1,
    },
  ],
};

// §2.6, Exercise 4 c). Each question is answered yes or no, so four questions
// have sixteen possible sequences of answers, and Point "Two answers cannot
// separate three boxes" is the same counting argument one step smaller.
export const howManyBoxes: Puzzle = {
  fields: [
    {
      kind: "number",
      label: "Four questions can deal with at most",
      answer: 16,
      unit: "boxes",
    },
  ],
};

// ===========================================================================
//  §2.7 — Miscellaneous Problems
// ===========================================================================

// §2.7, Five on the Shore. Unique solution by exhaustive search over the
// thirty-two arrangements.
export const fiveOnTheShore: Puzzle = {
  fields: [
    { kind: "choice", label: "Elara is an", options: KIND, answer: 1 },
    { kind: "choice", label: "Orion is an", options: KIND, answer: 0 },
    { kind: "choice", label: "Phoebe is an", options: KIND, answer: 1 },
    { kind: "choice", label: "Selene is an", options: KIND, answer: 0 },
    { kind: "choice", label: "Helios is an", options: KIND, answer: 1 },
  ],
};

// §2.7, Oracles and Chimeras. Unique: Ariadne and Selene are chimeras and
// Thalia is the only oracle.
export const oraclesAndChimeras: Puzzle = {
  fields: [
    { kind: "choice", label: "Ariadne is an", options: KIND, answer: 1 },
    { kind: "choice", label: "Selene is an", options: KIND, answer: 1 },
    { kind: "choice", label: "Thalia is an", options: KIND, answer: 0 },
  ],
};

// §2.7, Treacherous Trio. Unique: all three are chimeras.
export const treacherousTrio: Puzzle = {
  fields: [
    { kind: "choice", label: "Ariadne is an", options: KIND, answer: 1 },
    { kind: "choice", label: "Selene is an", options: KIND, answer: 1 },
    { kind: "choice", label: "Thalia is an", options: KIND, answer: 1 },
  ],
};

// §2.7, Counting Chimeras. The ten statements contradict one another in pairs,
// so at most one being is an oracle. Nine chimeras is the only count that
// stands: the ninth being speaks truly and the other nine lie.
export const countingChimeras: Puzzle = {
  fields: [
    { kind: "number", label: "The number of chimeras is", answer: 9 },
  ],
};

// §2.7, Counting Chimeras Again. "At least k" is true for every k up to the
// true count, so the first k beings are the oracles. Five is the only count
// that balances.
export const countingChimerasAgain: Puzzle = {
  fields: [
    { kind: "number", label: "The number of chimeras is", answer: 5 },
  ],
};

// §2.7, An Endless Queue. Working down from a first being who is an oracle,
// the queue settles into oracle, oracle, chimera, chimera, repeating for ever.
// So the being at place n is an oracle exactly when n leaves remainder 1 or 2
// on division by four.
export const endlessQueue: Puzzle = {
  fields: [
    { kind: "choice", label: "The 42nd being is an", options: KIND, answer: 0 },
    { kind: "choice", label: "The 43rd being is an", options: KIND, answer: 1 },
    { kind: "choice", label: "The 44th being is an", options: KIND, answer: 1 },
    { kind: "choice", label: "The 45th being is an", options: KIND, answer: 0 },
  ],
};
