// Languages of machines/two-conditions. See ../languages.ts for the rules.
import type { Language } from "../languages.ts";

const B = ["0", "1"];

const count = (s: string, c: string) => [...s].filter((x) => x === c).length;

export const L: Record<string, Language> = {
  "two-conditions/both-parities": {
    alphabet: B,
    accepts: (s) => count(s, "0") % 2 === 0 && count(s, "1") % 2 === 0,
  },
  "two-conditions/either-one": {
    alphabet: B,
    accepts: (s) => count(s, "0") % 2 === 0 || s.endsWith("1"),
  },
  "two-conditions/opposite": { alphabet: B, accepts: (s) => count(s, "1") % 3 !== 0 },
  "two-conditions/wanted-and-forbidden": {
    alphabet: B,
    accepts: (s) => s.includes("11") && !s.includes("00"),
  },
  "two-conditions/two-counts": {
    alphabet: B,
    bound: 16,
    accepts: (s) => count(s, "0") % 3 === 0 || count(s, "1") % 4 === 0,
  },
  // exactly one of: begins with 1, ends with 1
  "two-conditions/exactly-one": {
    alphabet: B,
    accepts: (s) => s.startsWith("1") !== s.endsWith("1"),
  },
  "two-conditions/count-and-block": {
    alphabet: B,
    bound: 12,
    accepts: (s) => s.length % 2 === 0 && s.includes("101"),
  },
};
