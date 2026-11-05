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
    for (const s of level) for (const a of alphabet) { next.push(s + a); out.push(s + a); }   // no spread: it overflows the stack on big levels
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
export function compare(
  m: MachineSpec, alphabet: Sym[], target: Dfa, index?: (a: Sym) => number,
): { word: string; accepts: boolean } | null {
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
      const q2 = target.delta[q][index ? index(a) : k];
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
// On the canvas an arrow joins two states and is labelled with tokens: a
// symbol of the alphabet, the word `other`, or the name of a convention the
// student has defined (a named set of symbols, such as "all except a, d, f").
// `other` on an arrow means every symbol that no other arrow leaving the same
// state reads, the book's "any other letter".
//
// A drawing can be wrong in ways a machine cannot: an unlabelled arrow, a
// label naming a convention that does not exist, or two arrows leaving one
// state with the same symbol. specFromEdges turns the drawing into a machine
// and reports all three. A symbol is entered in the machine only when exactly
// one arrow leaving its state reads it.

export const OTHER = "other";

export interface DrawnEdge { from: string; to: string; label: string[]; bend?: number; angle?: number }

export function specFromEdges(
  states: string[],
  start: string | null,
  accepting: string[],
  edges: DrawnEdge[],
  alphabet: Sym[],
  conventions: Record<string, Sym[]> = {},
): {
  spec: MachineSpec;
  unlabeled: number[];
  unknown: { edge: number; token: string }[];
  clashes: { state: string; symbol: Sym; edges: number[] }[];
  expanded: Sym[][];                      // the symbols each arrow reads, after expanding names and `other`
} {
  const unlabeled: number[] = [];
  const unknown: { edge: number; token: string }[] = [];
  const explicit: Set<Sym>[] = edges.map((e, i) => {
    if (e.label.length === 0) unlabeled.push(i);
    const set = new Set<Sym>();
    for (const t of e.label) {
      if (t === OTHER) continue;
      if (alphabet.includes(t)) set.add(t);
      else if (conventions[t]) for (const a of conventions[t]) set.add(a);
      else unknown.push({ edge: i, token: t });
    }
    return set;
  });
  const expanded: Sym[][] = edges.map((e, i) => {
    const set = new Set(explicit[i]);
    if (e.label.includes(OTHER)) {
      const taken = new Set<Sym>();
      edges.forEach((f, j) => { if (j !== i && f.from === e.from) for (const a of explicit[j]) taken.add(a); });
      for (const a of explicit[i]) taken.add(a);
      for (const a of alphabet) if (!taken.has(a)) set.add(a);
    }
    return alphabet.filter((a) => set.has(a));
  });
  const arrows: MachineSpec["arrows"] = Object.fromEntries(states.map((s) => [s, {}]));
  const clashes: { state: string; symbol: Sym; edges: number[] }[] = [];
  for (const s of states)
    for (const a of alphabet) {
      const hits = edges.map((e, i) => (e.from === s && expanded[i].includes(a) ? i : -1)).filter((i) => i >= 0);
      if (hits.length === 1) arrows[s][a] = edges[hits[0]].to;
      else if (hits.length > 1) clashes.push({ state: s, symbol: a, edges: hits });
    }
  return { spec: { states, start, accepting, arrows }, unlabeled, unknown, clashes, expanded };
}

const splitTokens = (text: string) => text.split(/[\s,]+/).filter((t) => t.length > 0);

// What a student typed as a label, read as a list of tokens: symbols in
// alphabet order, then convention names, then `other`. Commas and spaces
// separate tokens, and a run of symbols with no separator ("01") is read as
// those symbols. Returns null if anything else was typed.
export function parseLabel(text: string, alphabet: Sym[], names: string[] = []): string[] | null {
  const syms = new Set<Sym>(), used = new Set<string>();
  let other = false;
  for (const t of splitTokens(text)) {
    if (alphabet.includes(t)) syms.add(t);
    else if (t.toLowerCase() === OTHER) other = true;
    else if (names.includes(t)) used.add(t);
    else if ([...t].every((c) => alphabet.includes(c))) for (const c of t) syms.add(c);
    else return null;
  }
  return [...alphabet.filter((a) => syms.has(a)), ...names.filter((n) => used.has(n)), ...(other ? [OTHER] : [])];
}

// A convention's definition: a list of symbols ("a, e, i, o, u"), ranges
// ("a-f"), or either after "all except" ("all except a, d, f"). Returns the
// symbols, in alphabet order, or null if something is not a symbol.
export function parseConvention(def: string, alphabet: Sym[]): Sym[] | null {
  let text = def.trim();
  const m = text.match(/^(all|everything|every\s+\w+)\s+(except|but|other\s+than)\b\s*:?\s*|^not\s+/i);
  const complement = !!m;
  if (m) text = text.slice(m[0].length);
  const set = new Set<Sym>();
  for (const t of splitTokens(text)) {
    const r = t.match(/^(.)-(.)$/u);
    if (r && alphabet.includes(r[1]) && alphabet.includes(r[2])) {
      const [i, j] = [alphabet.indexOf(r[1]), alphabet.indexOf(r[2])].sort((x, y) => x - y);
      for (let k = i; k <= j; k++) set.add(alphabet[k]);
    } else if (alphabet.includes(t)) set.add(t);
    else if ([...t].every((c) => alphabet.includes(c))) for (const c of t) set.add(c);
    else return null;
  }
  if (!complement && set.size === 0) return null;
  return alphabet.filter((a) => (complement ? !set.has(a) : set.has(a)));
}

// ---- the target for a problem ----------------------------------------------------
//
// For a large alphabet the language names the few symbols it treats
// individually (`relevant`); every other symbol behaves the same, so the
// target is built over the relevant symbols plus one stand-in for all the
// rest, and `index` maps any symbol of the full alphabet to its column.

export function targetOf(lang: { alphabet: Sym[]; accepts: (s: string) => boolean; bound?: number; relevant?: Sym[]; longest?: number }): {
  dfa: Dfa; alphabet: Sym[]; index: (a: Sym) => number;
} {
  if (!lang.relevant) {
    const dfa = minimalDfa(lang.alphabet, lang.accepts, lang.bound ?? 8);
    return { dfa, alphabet: lang.alphabet, index: (a) => lang.alphabet.indexOf(a) };
  }
  const rest = lang.alphabet.filter((a) => !lang.relevant!.includes(a));
  const small = rest.length ? [...lang.relevant, rest[0]] : [...lang.relevant];
  const dfa = minimalDfa(small, lang.accepts, lang.bound ?? 8);
  return { dfa, alphabet: small, index: (a) => (lang.relevant!.includes(a) ? lang.relevant!.indexOf(a) : small.length - 1) };
}
