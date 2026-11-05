// Pure logic for the machine builder: running a student's machine, checking
// that every state has an arrow for every symbol, and deciding exactly
// whether it accepts the strings a problem asks for.
//
// No solution machine is stored anywhere. A problem gives its language as a
// predicate on strings (languages.ts), which is the problem statement in
// code. From the predicate, minimalDfa builds the smallest machine for the
// language by Myhill-Nerode, in memory, at the moment Check is pressed. It
// is never drawn. compare then walks the student's machine and that one side
// by side over every reachable pair of states, so the verdict is exact at
// every length, not a sample, and a wrong machine gets the shortest string
// it gets wrong.
//
// Pure TypeScript with .ts imports, so `npm test` can load it in Node.

export type Sym = string;

// The machine as the canvas holds it, without the drawing.
export interface MachineSpec {
  states: string[];                                  // ids, in the order they were added
  start: string | null;
  accepting: string[];
  arrows: Record<string, Partial<Record<Sym, string>>>;  // arrows[state][symbol] = next state
}

// A complete machine on states 0..n-1, used for the target.
export interface Dfa {
  n: number;
  start: number;
  accept: boolean[];
  delta: number[][];                                 // delta[state][index of symbol in alphabet]
  reps: string[];                                    // the shortest string reaching each state
}

// Every string over the alphabet of length 0 to maxLen, shortest first, and
// within a length in the order the alphabet is written.
export function allStrings(alphabet: Sym[], maxLen: number): string[] {
  const out: string[] = [""];
  let level: string[] = [""];
  for (let len = 1; len <= maxLen; len++) {
    const next: string[] = [];
    for (const s of level) for (const a of alphabet) next.push(s + a);
    out.push(...next);
    level = next;
  }
  return out;
}

// The smallest complete machine for the language `accepts`, built from the
// predicate alone. Two strings land in the same state exactly when no suffix
// tells them apart. If the smallest machine has m states, two states that
// differ are told apart by a suffix of length at most m - 2, so comparing
// every suffix up to length bound - 1 is exact whenever m <= bound + 1. The
// tests confirm, for every language on the site, that raising the bound
// changes nothing.
export function minimalDfa(alphabet: Sym[], accepts: (s: string) => boolean, bound = 8): Dfa {
  const suffixes = allStrings(alphabet, Math.max(0, bound - 1));
  const sig = (x: string) => suffixes.map((z) => (accepts(x + z) ? "1" : "0")).join("");
  const index = new Map<string, number>();
  const reps: string[] = [];
  const delta: number[][] = [];
  const add = (x: string) => {
    const s = sig(x);
    let k = index.get(s);
    if (k === undefined) {
      k = reps.length;
      index.set(s, k);
      reps.push(x);
    }
    return k;
  };
  add("");
  for (let q = 0; q < reps.length; q++) {
    if (reps.length > 256) throw new Error("minimalDfa: more than 256 states; the bound is too small or the language is not one a machine can recognise");
    delta[q] = alphabet.map((a) => add(reps[q] + a));
  }
  return { n: reps.length, start: 0, accept: reps.map((r) => !!accepts(r)), delta, reps };
}

// ---- running the student's machine -------------------------------------------

export interface Walk {
  path: (string | null)[];   // path[i] = the state after reading i symbols; null once stuck
  stuckAt: number | null;    // index of the symbol that had no arrow, or null
  accepted: boolean;
}

export function runMachine(m: MachineSpec, word: string): Walk {
  const acc = new Set(m.accepting);
  const path: (string | null)[] = [m.start];
  let cur: string | null = m.start;
  let stuckAt: number | null = null;
  for (let i = 0; i < word.length; i++) {
    if (cur !== null) {
      const next: string | undefined = m.arrows[cur]?.[word[i]];
      if (next === undefined || !m.states.includes(next)) {
        stuckAt = i;
        cur = null;
      } else cur = next;
    }
    path.push(cur);
  }
  return { path, stuckAt, accepted: cur !== null && acc.has(cur) };
}

// ---- the check -----------------------------------------------------------------

export type CheckResult =
  | { status: "no-states" }
  | { status: "missing"; missing: { state: string; symbol: Sym }[] }
  | { status: "wrong"; word: string; accepts: boolean }       // accepts: what the student's machine does
  | { status: "ok"; states: number; fewest: number };

export function missingArrows(m: MachineSpec, alphabet: Sym[]): { state: string; symbol: Sym }[] {
  const out: { state: string; symbol: Sym }[] = [];
  for (const s of m.states)
    for (const a of alphabet) {
      const t = m.arrows[s]?.[a];
      if (t === undefined || !m.states.includes(t)) out.push({ state: s, symbol: a });
    }
  return out;
}

// The shortest string (shortest first, then in alphabet order) on which the
// student's complete machine and the target disagree, or null if none does.
// Breadth-first over pairs of states, so it is exact at every length.
export function compare(m: MachineSpec, alphabet: Sym[], target: Dfa): { word: string; accepts: boolean } | null {
  const acc = new Set(m.accepting);
  if (m.start === null) return null;
  const seen = new Set<string>();
  const queue: { p: string; q: number; w: string }[] = [{ p: m.start, q: target.start, w: "" }];
  seen.add(`${m.start}|${target.start}`);
  for (let head = 0; head < queue.length; head++) {
    const { p, q, w } = queue[head];
    if (acc.has(p) !== target.accept[q]) return { word: w, accepts: acc.has(p) };
    alphabet.forEach((a, k) => {
      const p2 = m.arrows[p]![a]!;
      const q2 = target.delta[q][k];
      const key = `${p2}|${q2}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push({ p: p2, q: q2, w: w + a });
      }
    });
  }
  return null;
}

export function checkMachine(m: MachineSpec, alphabet: Sym[], target: Dfa): CheckResult {
  if (m.states.length === 0 || m.start === null) return { status: "no-states" };
  const missing = missingArrows(m, alphabet);
  if (missing.length > 0) return { status: "missing", missing };
  const bad = compare(m, alphabet, target);
  if (bad) return { status: "wrong", word: bad.word, accepts: bad.accepts };
  return { status: "ok", states: m.states.length, fewest: target.n };
}

// ---- drawn arrows ----------------------------------------------------------------
//
// On the canvas an arrow joins two states and is labelled with the symbols it
// reads, so a drawing can have an unlabelled arrow, or two arrows leaving one
// state with the same symbol. specFromEdges turns the drawing into a machine
// and reports both. An arrow for a symbol is entered in the machine only when
// it is the one arrow leaving its state with that symbol.

export interface DrawnEdge { from: string; to: string; label: string[]; bend?: number; angle?: number }

export function specFromEdges(
  states: string[],
  start: string | null,
  accepting: string[],
  edges: DrawnEdge[],
  alphabet: Sym[],
): { spec: MachineSpec; unlabeled: number[]; clashes: { state: string; symbol: Sym; edges: number[] }[] } {
  const arrows: MachineSpec["arrows"] = Object.fromEntries(states.map((s) => [s, {}]));
  const unlabeled: number[] = [];
  const clashes: { state: string; symbol: Sym; edges: number[] }[] = [];
  edges.forEach((e, i) => { if (e.label.length === 0) unlabeled.push(i); });
  for (const s of states)
    for (const a of alphabet) {
      const hits = edges.map((e, i) => (e.from === s && e.label.includes(a) ? i : -1)).filter((i) => i >= 0);
      if (hits.length === 1) arrows[s][a] = edges[hits[0]].to;
      else if (hits.length > 1) clashes.push({ state: s, symbol: a, edges: hits });
    }
  return { spec: { states, start, accepting, arrows }, unlabeled, clashes };
}

// What a student typed as a label, read as a list of symbols in alphabet
// order. Commas and spaces are ignored. Returns null if anything else was
// typed.
export function parseLabel(text: string, alphabet: Sym[]): Sym[] | null {
  const chars = [...text].filter((c) => c !== "," && c.trim() !== "");
  if (chars.some((c) => !alphabet.includes(c))) return null;
  return alphabet.filter((a) => chars.includes(a));
}
