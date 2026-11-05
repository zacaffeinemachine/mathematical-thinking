// Languages of machines/counting. See ../languages.ts for the rules.
import type { Language } from "../languages.ts";

const B = ["0", "1"];
const count = (s: string, c: string) => [...s].filter((x) => x === c).length;

export const L: Record<string, Language> = {
  "counting/parity":           { alphabet: B, accepts: (s) => count(s, "1") % 2 === 0 },
  "counting/other-parity":     { alphabet: B, accepts: (s) => count(s, "0") % 2 === 1 },
  "counting/threshold":        { alphabet: B, accepts: (s) => count(s, "1") >= 3 },
  "counting/exactly-two":      { alphabet: B, accepts: (s) => count(s, "1") === 2 },
  "counting/ceiling":          { alphabet: B, accepts: (s) => count(s, "0") <= 2 },
  "counting/remainder":        { alphabet: B, accepts: (s) => count(s, "0") % 4 === 0 },
  // even number of 0s and odd number of 1s
  "counting/two-counts":       { alphabet: B, accepts: (s) => count(s, "0") % 2 === 0 && count(s, "1") % 2 === 1 },
  // (number of 1s) minus (number of 0s) is divisible by 3, sign included
  "counting/difference":       { alphabet: B, accepts: (s) => Math.abs(count(s, "1") - count(s, "0")) % 3 === 0 },
  "counting/bigger-remainder": { alphabet: B, accepts: (s) => count(s, "1") % 6 === 0 },
  // even number of 0s and number of 1s divisible by 3
  "counting/two-remainders":   { alphabet: B, accepts: (s) => count(s, "0") % 2 === 0 && count(s, "1") % 3 === 0 },
};
