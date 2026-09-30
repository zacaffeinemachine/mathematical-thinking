import type { Puzzle } from "../PuzzleAnswer.tsx";

// ---------------------------------------------------------------------------
//  Answer keys for boolean-algebra/puzzles.mdx, fifteen logic puzzles to be
//  solved by the method of Chapter 4: one yes/no letter per unknown, one
//  equation per clue, then solve the system. The statements live in the MDX,
//  only the sheets and their keys live here, in the order the page uses them.
//
//  None of these is in the book. Every key was settled by exhaustive search,
//  not by hand. The script is reproduced in SITE_OVERVIEW.md, "Fifteen
//  Puzzles"; rerun it before changing any entry below.
//
//  The same authoring rules as puzzles/logicalThinking.ts, plus one:
//    • Every keyed answer must be forced by the statement as the MDX gives it.
//      Where something is left open, the sheet offers "Cannot be determined"
//      and keys it.
//    • Options must be exhaustive.
//    • No if-then sentence and no quantity word ranging over nothing, in any
//      clue or any speaker's sentence. Vacuous truth is not examined in this
//      course. Every clue here is built from and, or, not, "exactly", "at
//      least", and "the same kind / different kinds".
// ---------------------------------------------------------------------------

const KIND = ["Oracle", "Chimera"];
const KIND_OPEN = ["Oracle", "Chimera", "Cannot be determined"];
const PRESS = ["Press", "Leave alone"];
const FLIP = ["Flipped", "Not flipped"];
const TRUTH = ["True", "False"];

// 1. At the Jetty. a = 1 + as, which forces a = 1 and then s = 0.
export const atTheJetty: Puzzle = {
  fields: [
    { kind: "choice", label: "Ariadne is", options: KIND, answer: 0 },
    { kind: "choice", label: "Selene is", options: KIND, answer: 1 },
  ],
};

// 2. Three Switches. Lamp A gives x1 + x3 = 0, lamp C gives x2 + x3 = 0, so
// all three agree, and lamp B gives x1 + x2 + x3 = 1, so they are all 1.
export const threeSwitches: Puzzle = {
  fields: [
    { kind: "choice", label: "Switch 1 was", options: FLIP, answer: 0 },
    { kind: "choice", label: "Switch 2 was", options: FLIP, answer: 0 },
    { kind: "choice", label: "Switch 3 was", options: FLIP, answer: 0 },
  ],
};

// 3. Three at the Well. Unique: Ariadne oracle, Selene and Thalia chimeras.
// Chosen so the key differs from every island puzzle in Chapter 2.
export const threeAtTheWell: Puzzle = {
  fields: [
    { kind: "choice", label: "Ariadne is", options: KIND, answer: 0 },
    { kind: "choice", label: "Selene is", options: KIND, answer: 1 },
    { kind: "choice", label: "Thalia is", options: KIND, answer: 1 },
  ],
};

// 4. Three Caskets. The gold and lead inscriptions have truth values g and
// 1 + g, which add to 1, so exactly one of them is true. The silver one must
// then be false, which puts the portrait in silver, and the true one is lead.
export const threeCaskets: Puzzle = {
  fields: [
    {
      kind: "choice",
      label: "The portrait is in the",
      options: ["Gold casket", "Silver casket", "Lead casket"],
      answer: 1,
    },
    {
      kind: "choice",
      label: "The one true inscription is on the",
      options: ["Gold casket", "Silver casket", "Lead casket", "None of them"],
      answer: 2,
    },
  ],
};

// 5. The Last Biscuit. Ivy's truth value is 1 + Gus's, so one of those two is
// the truth-teller, Fern and Hugo both lie, and Hugo's lie convicts Hugo. Gus
// named Ivy, so Gus lied and Ivy told the truth.
const SIBLINGS = ["Fern", "Gus", "Hugo", "Ivy"];
export const theLastBiscuit: Puzzle = {
  fields: [
    { kind: "choice", label: "The biscuit was taken by", options: SIBLINGS, answer: 2 },
    { kind: "choice", label: "The one who told the truth is", options: SIBLINGS, answer: 3 },
  ],
};

// 6. Exam Results. An island puzzle in other clothes: passing plays the part
// of being an oracle. Unique: Jonas failed, Kira and Lena passed.
const RESULT = ["Passed", "Failed"];
export const examResults: Puzzle = {
  fields: [
    { kind: "choice", label: "Jonas", options: RESULT, answer: 1 },
    { kind: "choice", label: "Kira", options: RESULT, answer: 0 },
    { kind: "choice", label: "Lena", options: RESULT, answer: 0 },
  ],
};

// 7. The Concert. Five clues, each one needed: dropping any clue lets a
// second group through. Unique: Alma and Dario go.
const GOES = ["Goes", "Stays home"];
export const theConcert: Puzzle = {
  fields: [
    { kind: "choice", label: "Alma", options: GOES, answer: 0 },
    { kind: "choice", label: "Bruno", options: GOES, answer: 1 },
    { kind: "choice", label: "Clara", options: GOES, answer: 1 },
    { kind: "choice", label: "Dario", options: GOES, answer: 0 },
    { kind: "choice", label: "Elena", options: GOES, answer: 1 },
  ],
};

// 8. Four Doors, Three Guards. Only door 3 leaves each guard exactly one
// true claim.
export const fourDoors: Puzzle = {
  fields: [
    {
      kind: "choice",
      label: "The prize is behind",
      options: ["Door 1", "Door 2", "Door 3", "Door 4"],
      answer: 2,
    },
  ],
};

// 9. The Fourth Voice. Dione's sentence gives d = s + d, in which d cancels
// and leaves s = 0: it settles Selene and says nothing about Dione. Two worlds survive, differing only in Dione, so Dione's row is
// keyed "Cannot be determined". This is the row the page exists for.
export const theFourthVoice: Puzzle = {
  fields: [
    { kind: "choice", label: "Ariadne is", options: KIND_OPEN, answer: 0 },
    { kind: "choice", label: "Selene is", options: KIND_OPEN, answer: 1 },
    { kind: "choice", label: "Thalia is", options: KIND_OPEN, answer: 0 },
    { kind: "choice", label: "Dione is", options: KIND_OPEN, answer: 2 },
  ],
};

// 10. Six Lamps in a Row. Start ●○○●○● . A row of six has exactly one set of
// presses that puts everything out: buttons 1, 3, 4 and 5.
export const sixLamps: Puzzle = {
  fields: [1, 2, 3, 4, 5, 6].map((n, i) => ({
    kind: "choice" as const,
    label: `Button ${n}`,
    options: PRESS,
    answer: [0, 1, 0, 0, 0, 1][i],
  })),
};

// 11. Five on the Ferry. Unique, and each sentence is needed: Castor, Iris
// and Nyx oracles, Leander and Pallas chimeras.
export const fiveOnTheFerry: Puzzle = {
  fields: [
    { kind: "choice", label: "Castor is", options: KIND, answer: 0 },
    { kind: "choice", label: "Iris is", options: KIND, answer: 0 },
    { kind: "choice", label: "Leander is", options: KIND, answer: 1 },
    { kind: "choice", label: "Nyx is", options: KIND, answer: 0 },
    { kind: "choice", label: "Pallas is", options: KIND, answer: 1 },
  ],
};

// 12. A Card of Sentences. At most one "exactly k are false" can be true, and
// all four false would make sentence 4 true. So exactly one is true, three
// are false, and the true one is sentence 3.
export const aCardOfSentences: Puzzle = {
  fields: [1, 2, 3, 4].map((n) => ({
    kind: "choice" as const,
    label: `Sentence ${n} is`,
    options: TRUTH,
    answer: n === 3 ? 0 : 1,
  })),
};

// 13. The Round Table. Each seat gives a_i = a_(i-1) + a_(i+1). With at least
// one oracle, the only solutions are the three turns of oracle, oracle,
// chimera, oracle, oracle, chimera. The count is forced at 4 and no two
// chimeras are neighbours, but every single seat is open.
export const theRoundTable: Puzzle = {
  fields: [
    { kind: "number", label: "The number of oracles at the table is", answer: 4 },
    { kind: "choice", label: "Ariadne is", options: KIND_OPEN, answer: 2 },
    {
      kind: "choice",
      label: "Do two chimeras sit side by side?",
      options: ["Yes", "No", "Cannot be determined"],
      answer: 1,
    },
  ],
};

// 14. Five Lamps in a Row. For five lamps the system has a solution exactly
// when lamps 1 + 2 + 4 + 5 = 0 at the start, so 16 of the 32 starting
// patterns can be put out, and "only the leftmost lit" is not one of them.
export const fiveLamps: Puzzle = {
  fields: [
    {
      kind: "choice",
      label: "With only lamp 1 lit, can every lamp be put out?",
      options: ["Yes", "No"],
      answer: 1,
    },
    {
      kind: "number",
      label: "The number of starting patterns that can be put out is",
      answer: 16,
      unit: "out of 32",
    },
  ],
};

// 15. The Lamp Grid. Start
//     ● ● ○
//     ○ ○ ●
//     ○ ● ●
// The 3 × 3 grid has exactly one set of presses for every starting pattern.
// Here it is top left, top right, centre and middle right.
const GRID = [
  "Top left", "Top middle", "Top right",
  "Middle left", "Centre", "Middle right",
  "Bottom left", "Bottom middle", "Bottom right",
];
export const theLampGrid: Puzzle = {
  fields: GRID.map((label, i) => ({
    kind: "choice" as const,
    label,
    options: PRESS,
    answer: [0, 1, 0, 1, 0, 0, 1, 1, 1][i],
  })),
};
