// Languages of machines/length. See ../languages.ts for the rules.
import type { Language } from "../languages.ts";

const B = ["0", "1"];

export const L: Record<string, Language> = {
  "length/exactly-three":    { alphabet: B, accepts: (s) => s.length === 3 },
  "length/at-most-two":      { alphabet: B, accepts: (s) => s.length <= 2 },
  "length/at-least-four":    { alphabet: B, accepts: (s) => s.length >= 4 },
  "length/even-length":      { alphabet: B, accepts: (s) => s.length % 2 === 0 },
  "length/multiple-of-three": { alphabet: B, accepts: (s) => s.length % 3 === 0 },
  // length a multiple of 3 and last symbol 1
  "length/length-and-last":  { alphabet: B, accepts: (s) => s.length % 3 === 0 && s.endsWith("1") },
  // length even or a multiple of 3 (or both)
  "length/even-or-three":    { alphabet: B, accepts: (s) => s.length % 2 === 0 || s.length % 3 === 0 },
  // length at least 3 and the third symbol (counted from 1) is 0
  "length/fixed-position":   { alphabet: B, accepts: (s) => s.length >= 3 && s[2] === "0" },
  // every symbol at an odd position, counting from 1, is a 1
  "length/every-other":      { alphabet: B, accepts: (s) => [...s].every((c, i) => (i + 1) % 2 === 0 || c === "1") },
  // begins with 1 and has even length, or begins with 0 and has odd length
  "length/first-decides":    {
    alphabet: B,
    accepts: (s) => (s.startsWith("1") && s.length % 2 === 0) || (s.startsWith("0") && s.length % 2 === 1),
  },
};
