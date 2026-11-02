// Checks listing.ts against Chapters/Infinity.tex and the class slides.
//
//   cd Site && node --experimental-strip-types src/components/games/infinity/frog/listing.test.ts
//
// Exits non-zero on the first disagreement.
import {
  diagonalPair,
  diagonalPlace,
  firstHit,
  frogPad,
  friendlyFrog,
  friendlyShot,
  shellOf,
  shellPair,
  shellPlace,
  shotAt,
  type Pair,
} from "./listing.ts";

let checks = 0;
function ok(cond: boolean, msg: string) {
  checks++;
  if (!cond) throw new Error(`FAIL: ${msg}`);
}
const same = (a: Pair, b: Pair) => a.d === b.d && a.k === b.k;
const show = (p: Pair) => `(${p.d},${p.k})`;

// ---- The book's own figures, typed in by hand ---------------------------
// figure:frog-diagonals, the eleven numbered nodes.
const BOOK_DIAGONAL: [number, number][] = [
  [1, 1], [2, 1], [1, 2], [3, 1], [2, 2], [1, 3], [4, 1], [3, 2], [2, 3], [1, 4], [5, 1],
];
// figure:frog-shells, the sixteen numbered nodes, and the dashed arrow to (1,5).
const BOOK_SHELL: [number, number][] = [
  [1, 1], [2, 1], [2, 2], [1, 2], [1, 3], [2, 3], [3, 3], [3, 2], [3, 1],
  [4, 1], [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [1, 4], [1, 5],
];
BOOK_DIAGONAL.forEach(([d, k], i) =>
  ok(same(diagonalPair(i + 1), { d, k }), `diagonal place ${i + 1} should be (${d},${k}), got ${show(diagonalPair(i + 1))}`),
);
BOOK_SHELL.forEach(([d, k], i) =>
  ok(same(shellPair(i + 1), { d, k }), `shell place ${i + 1} should be (${d},${k}), got ${show(shellPair(i + 1))}`),
);

// ---- The book's rules, followed step by step ----------------------------
// Diagonals: "Each diagonal contains only finitely many pairs"; the pairs
// with d + k = s form one diagonal, walked as the figure walks it, from
// (s-1, 1) up to (1, s-1).
const N = 2000;
const diag: Pair[] = [];
for (let s = 2; diag.length < N; s++) for (let k = 1; k <= s - 1; k++) diag.push({ d: s - k, k });
// Square corners: "Start at (1,1). Step right to (2,1), up to (2,2), and left
// to (1,2). Now step up to (1,3), right along to (2,3) and (3,3), and down
// through (3,2) to (3,1). Now step right to (4,1), up the column to (4,4),
// and left along the row back to (1,4). Continue in this fashion."
const shell: Pair[] = [{ d: 1, k: 1 }];
for (let s = 2; shell.length < N; s++) {
  if (s % 2 === 0) {
    for (let k = 1; k <= s; k++) shell.push({ d: s, k });
    for (let d = s - 1; d >= 1; d--) shell.push({ d, k: s });
  } else {
    for (let d = 1; d <= s; d++) shell.push({ d, k: s });
    for (let k = s - 1; k >= 1; k--) shell.push({ d: s, k });
  }
}
for (let n = 1; n <= N; n++) {
  ok(same(diagonalPair(n), diag[n - 1]), `diagonal place ${n}: rule gives ${show(diag[n - 1])}, code ${show(diagonalPair(n))}`);
  ok(same(shellPair(n), shell[n - 1]), `shell place ${n}: rule gives ${show(shell[n - 1])}, code ${show(shellPair(n))}`);
  ok(diagonalPlace(diag[n - 1]) === n, `g${show(diag[n - 1])} should be ${n}`);
  ok(shellPlace(shell[n - 1]) === n, `shell place of ${show(shell[n - 1])} should be ${n}`);
}

// The book's closed forms for the diagonal list, typed as printed.
for (let n = 1; n <= N; n++) {
  const s = Math.floor((Math.sqrt(8 * n - 7) + 3) / 2);
  const d = (s * (s - 1)) / 2 - n + 1;
  const k = n - ((s - 2) * (s - 1)) / 2;
  ok(same({ d, k }, diagonalPair(n)), `book formula for place ${n}`);
  const g = ((d + k - 2) * (d + k - 1)) / 2 + k;
  ok(g === n, `book g at place ${n}`);
  ok(shotAt("diagonal", n) === d + n * k, `book f(n) at ${n}`);
}

// "The s-th shell is finished exactly at position s^2", and the walk is
// continuous: every step goes to a neighbouring pair.
for (let s = 1; s <= 40; s++) {
  ok(shellOf(shellPair(s * s)) === s && shellOf(shellPair(s * s + 1)) === s + 1, `shell ${s} ends at ${s * s}`);
}
for (let n = 1; n < N; n++) {
  const a = shellPair(n), b = shellPair(n + 1);
  ok(Math.abs(a.d - b.d) + Math.abs(a.k - b.k) === 1, `square-corner step ${n} is not to a neighbour`);
}

// ---- Every pair in a window, reached exactly once -----------------------
for (const W of [6, 8, 30]) {
  for (const [name, at] of [["diagonal", diagonalPair], ["shell", shellPair]] as const) {
    const seen = new Map<string, number>();
    const last = name === "diagonal" ? diagonalPlace({ d: W, k: W }) : W * W;
    for (let n = 1; n <= last; n++) {
      const p = at(n);
      const key = show(p);
      ok(p.d >= 1 && p.k >= 1, `${name} place ${n} is not a pair of natural numbers`);
      ok(!seen.has(key), `${name} list repeats ${key} at ${seen.get(key)} and ${n}`);
      seen.set(key, n);
    }
    for (let d = 1; d <= W; d++)
      for (let k = 1; k <= W; k++) ok(seen.has(`(${d},${k})`), `${name} list misses (${d},${k}) in the ${W} by ${W} window`);
  }
}

// ---- The worked numbers in the book and the slides ----------------------
// "if the frog picks (d,k) = (5,2), it traces out the pads 7, 9, 11, 13"
ok([1, 2, 3, 4].map((t) => frogPad({ d: 5, k: 2 }, t)).join() === "7,9,11,13", "the (5,2) frog");
// Deck 03, "What to Shoot": pads 2, 4, 7, 7, 12, 19, 11 at times 1 to 7.
ok([1, 2, 3, 4, 5, 6, 7].map((n) => shotAt("diagonal", n)).join() === "2,4,7,7,12,19,11", "the deck's first seven shots");
// Deck 03: (2,1) is soaked at tick two on pad four, (1,3) at tick six on pad nineteen.
ok(diagonalPlace({ d: 2, k: 1 }) === 2 && frogPad({ d: 2, k: 1 }, 2) === 4, "the (2,1) frog");
ok(diagonalPlace({ d: 1, k: 3 }) === 6 && frogPad({ d: 1, k: 3 }, 6) === 19, "the (1,3) frog");
// Deck 03, "Which Place Is It?": the pair on the d + k = 5 diagonal two steps along is eighth.
ok(diagonalPlace({ d: 3, k: 2 }) === 8, "eighth place");

// Friendly Fire: at time t the sheet says pad t*t, and the frog that jumps by
// k is soaked at time k and not before.
for (let k = 1; k <= 200; k++) {
  for (let t = 1; t < k; t++) ok(friendlyShot(t) !== friendlyFrog(k, t), `jump ${k} hit early at ${t}`);
  ok(friendlyShot(k) === friendlyFrog(k, k), `jump ${k} not hit at time ${k}`);
}
ok([1, 2, 3].map(friendlyShot).join() === "1,4,9", "the book's pads 1, 4, 9");

// The shooter's guarantee: in each list, every frog in a window is soaked
// at its own place at the latest.
for (const order of ["diagonal", "shell"] as const) {
  for (let d = 1; d <= 20; d++)
    for (let k = 1; k <= 20; k++) {
      const f = { d, k };
      const own = order === "diagonal" ? diagonalPlace(f) : shellPlace(f);
      const h = firstHit(order, f);
      ok(h <= own && shotAt(order, h) === frogPad(f, h), `${order} frog ${show(f)}`);
      ok(shotAt(order, own) === frogPad(f, own), `${order} frog ${show(f)} at its own place`);
    }
}

console.log(`listing.test.ts: all ${checks} checks passed.`);
