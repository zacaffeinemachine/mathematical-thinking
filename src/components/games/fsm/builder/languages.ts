// The language each machine-building problem asks for, keyed by the
// `language` prop of <MachineBuilder>. A language is a predicate on strings,
// written from the problem statement and nothing else. It is the statement
// in code, not a solution: no machine is written down here or anywhere else.
//
// The predicate ships to the browser (MDX cannot pass a function to an
// island), so it lives here and the page names it by key.
//
// Rules:
//   - Write the predicate from the words of the problem, independently of
//     any machine. tests/machine-builder.test.ts checks every <Tests> string
//     on the page against it, so a predicate and a statement that drift
//     apart are caught.
//   - Keys are "<page>/<problem>", unique across the site.
//   - `bound` (default 8) must exceed the size of the smallest machine. The
//     test checks that raising it changes nothing.

export interface Language {
  alphabet: string[];
  accepts: (s: string) => boolean;
  bound?: number;
}

const B = ["0", "1"];

export const LANGUAGES: Record<string, Language> = {
  // ---- machines/ends-and-beginnings ----------------------------------------
  "ends-and-beginnings/ends-1":        { alphabet: B, accepts: (s) => s.endsWith("1") },
  "ends-and-beginnings/ends-00":       { alphabet: B, accepts: (s) => s.endsWith("00") },
  "ends-and-beginnings/ends-010":      { alphabet: B, accepts: (s) => s.endsWith("010") },
  "ends-and-beginnings/begins-1":      { alphabet: B, accepts: (s) => s.startsWith("1") },
  "ends-and-beginnings/begins-00":     { alphabet: B, accepts: (s) => s.startsWith("00") },
  // every 0 is immediately followed by a 1
  "ends-and-beginnings/zero-then-one": {
    alphabet: B,
    accepts: (s) => [...s].every((c, i) => c !== "0" || s[i + 1] === "1"),
  },
  // every 1 is immediately preceded by a 0
  "ends-and-beginnings/one-after-zero": {
    alphabet: B,
    accepts: (s) => [...s].every((c, i) => c !== "1" || (i > 0 && s[i - 1] === "0")),
  },
  // every 0 comes before every 1
  "ends-and-beginnings/zeros-first": {
    alphabet: B,
    accepts: (s) => !s.includes("10"),
  },
  // length at least 1, first symbol equals last symbol
  "ends-and-beginnings/same-ends": {
    alphabet: B,
    accepts: (s) => s.length >= 1 && s[0] === s[s.length - 1],
  },
  // begins with 01 and ends with 10
  "ends-and-beginnings/both-ends": {
    alphabet: B,
    accepts: (s) => s.startsWith("01") && s.endsWith("10"),
  },
  // the first symbol appears again somewhere later
  "ends-and-beginnings/first-again": {
    alphabet: B,
    accepts: (s) => s.length >= 2 && s.slice(1).includes(s[0]),
  },
};
