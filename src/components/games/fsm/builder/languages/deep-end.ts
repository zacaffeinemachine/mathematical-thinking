// Languages of machines/deep-end. See ../languages.ts for the rules.
import type { Language } from "../languages.ts";

const B = ["0", "1"];
const XY = ["x", "y"];

// how many times p appears in s, counting overlapping appearances
const count = (s: string, p: string) => [...s].filter((_, i) => s.startsWith(p, i)).length;

// the stretches of 0s lying between each 1 and the next one
const gapsBetweenOnes = (s: string) =>
  s.includes("1") ? s.slice(s.indexOf("1"), s.lastIndexOf("1") + 1).split("1").slice(1, -1) : [];

const blocks = (s: string, letter: string) => s.match(new RegExp(`${letter}+`, "g")) ?? [];

export const L: Record<string, Language> = {
  // a 0, then a 1, then a 0, then a 1, with anything in between
  "deep-end/scattered-not-consecutive": {
    alphabet: B,
    accepts: (s) => /0.*1.*0.*1/.test(s),
  },
  // every block of x has even length and every block of y has odd length
  "deep-end/one-rule-each-letter": {
    alphabet: XY,
    accepts: (s) => blocks(s, "x").every((b) => b.length % 2 === 0) && blocks(s, "y").every((b) => b.length % 2 === 1),
  },
  // 01 appears as often as 10, overlaps counted
  "deep-end/two-patterns-equally": {
    alphabet: B,
    accepts: (s) => count(s, "01") === count(s, "10"),
  },
  // every stretch of 0s between two 1s has even length
  "deep-end/even-gaps": {
    alphabet: B,
    accepts: (s) => gapsBetweenOnes(s).every((g) => g.length % 2 === 0),
  },
  // 11 appears an even number of times, overlaps counted
  "deep-end/overlaps-count": {
    alphabet: B,
    accepts: (s) => count(s, "11") % 2 === 0,
  },
  // first and last blocks of 1s have lengths of the same parity
  "deep-end/first-and-last-block": {
    alphabet: B,
    bound: 12,
    accepts: (s) => {
      const b = blocks(s, "1");
      return b.length === 0 || b[0]!.length % 2 === b[b.length - 1]!.length % 2;
    },
  },
  // every stretch of 0s between one 1 and the next has length 1, 2 or 3
  "deep-end/never-too-close": {
    alphabet: B,
    bound: 12,
    accepts: (s) => gapsBetweenOnes(s).every((g) => g.length >= 1 && g.length <= 3),
  },
  // two appearances of 101 that share no symbol
  "deep-end/twice-without-sharing": {
    alphabet: B,
    bound: 12,
    accepts: (s) => [...s].some((_, i) => s.startsWith("101", i) && s.indexOf("101", i + 3) !== -1),
  },
  // every block of 1s has length divisible by 3, or every block of 0s does
  "deep-end/thirds-either-letter": {
    alphabet: B,
    bound: 13,
    accepts: (s) => blocks(s, "1").every((b) => b.length % 3 === 0) || blocks(s, "0").every((b) => b.length % 3 === 0),
  },
  // the number of blocks of x of even length is a multiple of 3
  "deep-end/even-blocks-in-threes": {
    alphabet: XY,
    bound: 12,
    accepts: (s) => blocks(s, "x").filter((b) => b.length % 2 === 0).length % 3 === 0,
  },
};
