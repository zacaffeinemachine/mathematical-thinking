// Languages of machines/numbers. See ../languages.ts for the rules.
import type { Language } from "../languages.ts";

const B = ["0", "1"];
const C = ["1", "2"];

// the value of a binary string read left to right (most significant digit first)
const value = (s: string) => BigInt("0b" + s);
// the total value of a sequence of 1- and 2-credit coins
const credits = (s: string) => [...s].reduce((t, c) => t + Number(c), 0);

export const L: Record<string, Language> = {
  "numbers/even":       { alphabet: B, accepts: (s) => s.length > 0 && value(s) % 2n === 0n },
  "numbers/divisible-by-four":   { alphabet: B, accepts: (s) => s.length > 0 && value(s) % 4n === 0n },
  "numbers/divisible-by-six":   { alphabet: B, accepts: (s) => s.length > 0 && value(s) % 6n === 0n },
  "numbers/remainder-not-zero": { alphabet: B, accepts: (s) => s.length > 0 && value(s) % 3n === 1n },
  "numbers/big-enough": { alphabet: B, accepts: (s) => s.length > 0 && value(s) >= 8n },
  "numbers/paying-five":   { alphabet: C, bound: 12, accepts: (s) => credits(s) === 5 },
  // non-empty, total a multiple of 5
  "numbers/multiple-of-five": { alphabet: C, accepts: (s) => s.length > 0 && credits(s) % 5 === 0 },
  // read right to left: the first symbol is the last (least significant) digit
  "numbers/backwards": {
    alphabet: B,
    accepts: (s) => s.length > 0 && value([...s].reverse().join("")) % 5n === 0n,
  },
};
