// Languages of machines/somewhere-inside. See ../languages.ts for the rules.
import type { Language } from "../languages.ts";

const B = ["0", "1"];
import { LOWER } from "./alphabets.ts";

// how many times `t` occurs in `s`, overlaps counted separately
const occurrences = (s: string, t: string) => {
  let n = 0;
  for (let i = 0; i + t.length <= s.length; i++) if (s.startsWith(t, i)) n++;
  return n;
};

export const L: Record<string, Language> = {
  "somewhere-inside/two-in-a-row":   { alphabet: B, accepts: (s) => s.includes("00") },
  "somewhere-inside/three-in-a-row": { alphabet: B, accepts: (s) => s.includes("101") },
  "somewhere-inside/four-in-a-row":  { alphabet: B, accepts: (s) => s.includes("0110") },
  "somewhere-inside/never-in-a-row": { alphabet: B, accepts: (s) => !s.includes("11") },
  "somewhere-inside/both-blocks":    { alphabet: B, accepts: (s) => s.includes("01") && s.includes("10") },
  "somewhere-inside/word-in-the-middle": { alphabet: ["a", "b", "c"], accepts: (s) => s.includes("abc") },
  // if the string contains 11, then it contains 00
  "somewhere-inside/only-if-the-other": {
    alphabet: B,
    accepts: (s) => !s.includes("11") || s.includes("00"),
  },
  // 11 occurs exactly once, overlapping occurrences counted separately
  "somewhere-inside/once-only": { alphabet: B, accepts: (s) => occurrences(s, "11") === 1 },
  // the odd part (symbols at positions 1, 3, 5, ... counting from 1) contains dfa
  "somewhere-inside/every-other-symbol": {
    alphabet: LOWER,
    relevant: ["d", "f", "a"],
    bound: 9,
    accepts: (s) => [...s].filter((_, i) => i % 2 === 0).join("").includes("dfa"),
  },
};
