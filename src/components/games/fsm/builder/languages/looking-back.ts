// Languages of machines/looking-back. See ../languages.ts for the rules.
import type { Language } from "../languages.ts";

const B = ["0", "1"];

export const L: Record<string, Language> = {
  // length at least 2, last two symbols the same
  "looking-back/last-two-agree":  { alphabet: B, accepts: (s) => s.length >= 2 && s.at(-1) === s.at(-2) },
  // length at least 2, last two symbols different
  "looking-back/last-two-differ": { alphabet: B, accepts: (s) => s.length >= 2 && s.at(-1) !== s.at(-2) },
  // length at least 3, third-to-last symbol is 1
  "looking-back/third-from-end":  { alphabet: B, accepts: (s) => s.length >= 3 && s.at(-3) === "1", bound: 12 },
  // length at least 3, last three symbols all the same
  "looking-back/three-of-a-kind": {
    alphabet: B,
    accepts: (s) => s.length >= 3 && s.at(-1) === s.at(-2) && s.at(-2) === s.at(-3),
    bound: 12,
  },
  // length at least 2, first symbol equals second-to-last symbol
  "looking-back/beginning-meets-end": { alphabet: B, accepts: (s) => s.length >= 2 && s[0] === s.at(-2), bound: 12 },
  // length at least 4, fourth-to-last symbol is 1
  "looking-back/fourth-from-end": { alphabet: B, accepts: (s) => s.length >= 4 && s.at(-4) === "1", bound: 17 },
  // length at least 3, at least two of the last three symbols are 1
  "looking-back/vote": {
    alphabet: B,
    accepts: (s) => s.length >= 3 && [...s.slice(-3)].filter((c) => c === "1").length >= 2,
    bound: 12,
  },
};
