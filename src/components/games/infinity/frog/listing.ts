// =====================================================================
//  The shooter's lists, exactly as Chapters/Infinity.tex writes them.
//
//  Friendly Fire (book section "Friendly Fire"): the frog sits on pad 0 and
//  secretly picks a jump size k = 1, 2, 3, .... At time t it is on pad t k.
//  The plan is "at time t, target the frog that chose k = t", so the shot
//  at time t goes to pad t * t, and the frog that jumps by k is soaked at
//  time k.
//
//  The upgraded frog (book section "The Frog Gets an Upgrade"): the frog
//  picks a starting offset d and a jump size k, both natural numbers, so
//  both at least 1. At time t it is on pad d + t k, and before the clock
//  starts it sits on pad d. A pair is written (d, k): d along the bottom of
//  the grid, k up the side.
//
//    The diagonal list: (1,1), (2,1), (1,2), (3,1), (2,2), (1,3), (4,1), ...
//      Each diagonal holds the pairs with the same d + k, walked from k = 1
//      upward. Pair (d, k) sits at place (d+k-2)(d+k-1)/2 + k.
//
//    The square-corner list ("A second way to make the list"):
//      (1,1), (2,1), (2,2), (1,2), (1,3), (2,3), (3,3), (3,2), (3,1), ...
//      Shell s holds the pairs whose larger entry is s. An even shell runs
//      up column s and then left along row s, an odd shell runs right along
//      row s and then down column s. Shell s finishes at place s * s.
//
//  The shot at time n goes to pad d_n + n k_n, where (d_n, k_n) is the
//  n-th pair of whichever list the shooter uses.
//
//  listing.test.ts checks all of this against the book.
// =====================================================================

export interface Pair {
  d: number;
  k: number;
}

// ---- Friendly Fire -----------------------------------------------------

/** The pad the sheet says to shoot at time t. */
export const friendlyShot = (t: number) => t * t;
/** Where the frog that jumps by k sits at time t. */
export const friendlyFrog = (k: number, t: number) => t * k;

// ---- The upgraded frog -------------------------------------------------

/** Where the frog (d, k) sits at time t. Time 0 is before the clock starts. */
export const frogPad = (p: Pair, t: number) => p.d + t * p.k;

/** How many pairs lie on the diagonals before the one where d + k = s. */
export const pairsBeforeDiagonal = (s: number) => ((s - 2) * (s - 1)) / 2;

/** The book's g(d, k): the place of a pair in the diagonal list. */
export const diagonalPlace = (p: Pair) => pairsBeforeDiagonal(p.d + p.k) + p.k;

/** The n-th pair of the diagonal list, n = 1, 2, 3, .... */
export function diagonalPair(n: number): Pair {
  // The book's s_n = floor((sqrt(8n - 7) + 3) / 2), nudged in case the
  // square root rounds the wrong way for a large n.
  let s = Math.floor((Math.sqrt(8 * n - 7) + 3) / 2);
  while (pairsBeforeDiagonal(s) >= n) s--;
  while (pairsBeforeDiagonal(s + 1) < n) s++;
  const k = n - pairsBeforeDiagonal(s);
  return { d: s - k, k };
}

/** The shell a pair belongs to: the larger of its two entries. */
export const shellOf = (p: Pair) => Math.max(p.d, p.k);

/** The place of a pair in the square-corner list. */
export function shellPlace(p: Pair): number {
  const s = shellOf(p);
  const before = (s - 1) * (s - 1);
  if (s % 2 === 0) {
    // Up column s from (s,1) to (s,s), then left along row s to (1,s).
    return before + (p.d === s ? p.k : 2 * s - p.d);
  }
  // Right along row s from (1,s) to (s,s), then down column s to (s,1).
  return before + (p.k === s ? p.d : 2 * s - p.k);
}

/** The n-th pair of the square-corner list, n = 1, 2, 3, .... */
export function shellPair(n: number): Pair {
  let s = Math.ceil(Math.sqrt(n));
  while (s * s < n) s++;
  while ((s - 1) * (s - 1) >= n) s--;
  const i = n - (s - 1) * (s - 1); // 1 .. 2s - 1 along the shell
  if (s % 2 === 0) return i <= s ? { d: s, k: i } : { d: 2 * s - i, k: s };
  return i <= s ? { d: i, k: s } : { d: s, k: 2 * s - i };
}

export type Order = "diagonal" | "shell";

export const pairAt = (order: Order, n: number) =>
  order === "diagonal" ? diagonalPair(n) : shellPair(n);
export const placeOf = (order: Order, p: Pair) =>
  order === "diagonal" ? diagonalPlace(p) : shellPlace(p);

/** The pad the shooter aims at, at time n, reading the given list. */
export function shotAt(order: Order, n: number): number {
  const p = pairAt(order, n);
  return p.d + n * p.k;
}

/**
 * The first time the shot lands on the frog. It is never later than the
 * frog's own place in the list, and it can be earlier, when the shooter is
 * aiming at some other frog that happens to stand on the same pad.
 */
export function firstHit(order: Order, frog: Pair): number {
  const own = placeOf(order, frog);
  for (let n = 1; n < own; n++) if (shotAt(order, n) === frogPad(frog, n)) return n;
  return own;
}

// ---- Words -------------------------------------------------------------

export function ordinal(n: number): string {
  const r100 = n % 100;
  if (r100 >= 11 && r100 <= 13) return `${n}th`;
  const r = n % 10;
  return `${n}${r === 1 ? "st" : r === 2 ? "nd" : r === 3 ? "rd" : "th"}`;
}

/** 1 + 2 + 3, or 1 + 2 + 3 + … + 40 when there are many terms. */
export function runningSum(terms: number[]): string {
  if (terms.length <= 6) return terms.join(" + ");
  return `${terms.slice(0, 3).join(" + ")} + … + ${terms[terms.length - 1]}`;
}

export const fmt = (n: number) => n.toLocaleString("en-GB");
