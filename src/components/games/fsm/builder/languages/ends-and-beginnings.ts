// Languages of machines/ends-and-beginnings. See ../languages.ts for the rules.
import type { Language } from "../languages.ts";

const B = ["0", "1"];

export const L: Record<string, Language> = {
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
