// =====================================================================
//  The arithmetic of the night, exactly as Chapters/Infinity.tex gives it.
//
//  Midnight:      the guest of room n moves to room n + 1, the traveller
//                 takes room 1.
//  One o'clock:   the guest of room n moves to room 2n, the passenger in
//                 seat k takes room 2k - 1.
//  Two o'clock:   passenger (i, j) is seat j of bus i. The diagonal thread
//                 visits (1,1), (2,1), (1,2), (3,1), (2,2), (1,3), ... and
//                 the passenger at position n of the thread takes seat n of
//                 one coach. The pair (d, k) sits at position
//                     g(d, k) = (d + k - 2)(d + k - 1)/2 + k.
//                 Then the one o'clock announcements: passenger (i, j) ends
//                 in room 2 g(i, j) - 1 = (i + j - 2)(i + j - 1) + 2j - 1,
//                 the guest of room n in room 2n.
// =====================================================================

/** Position of passenger (bus i, seat j) on the diagonal thread. */
export const threadPos = (i: number, j: number) => ((i + j - 2) * (i + j - 1)) / 2 + j;

/** The passenger the thread reaches at position n, as [bus, seat]. */
export function threadAt(n: number): [number, number] {
  // Diagonal s holds the pairs with i + j = s, and there are s - 1 of them.
  // The diagonals up to and including s hold (s - 1) s / 2 pairs.
  let s = Math.max(2, Math.floor((1 + Math.sqrt(1 + 8 * n)) / 2));
  while (((s - 1) * s) / 2 < n) s++;
  while (s > 2 && ((s - 2) * (s - 1)) / 2 >= n) s--;
  const j = n - ((s - 2) * (s - 1)) / 2;
  return [s - j, j];
}

/** How many passengers the diagonals before passenger (i, j)'s diagonal hold. */
export const before = (i: number, j: number) => ((i + j - 2) * (i + j - 1)) / 2;

/** The room passenger (bus i, seat j) sleeps in at half past two. */
export const fleetRoom = (i: number, j: number) => 2 * threadPos(i, j) - 1;

/** Numbers as the page prints them: 1,000,000 rather than 1000000. */
export const fmt = (n: number) => n.toLocaleString("en-US");

/** "1st", "2nd", "3rd", "11th", ... */
export function ordinal(n: number): string {
  const r100 = n % 100;
  if (r100 >= 11 && r100 <= 13) return `${fmt(n)}th`;
  const r = n % 10;
  return `${fmt(n)}${r === 1 ? "st" : r === 2 ? "nd" : r === 3 ? "rd" : "th"}`;
}

/** Guests are lettered A, B, C, ... in the book's figures. Past Z they have no letter. */
export const letter = (n: number) => (n >= 1 && n <= 26 ? String.fromCharCode(64 + n) : "");
