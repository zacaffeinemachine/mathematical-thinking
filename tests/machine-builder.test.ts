// The machine builder (src/components/games/fsm/builder) and the pages that
// use it. Run from Site/ with:  npm test
//
// For every language in languages.ts:
//   - the smallest machine built from the predicate agrees with the
//     predicate on every string up to length 14, and raising the bound
//     changes nothing;
//   - its state count is a true minimum: the shortest strings reaching the
//     states are told apart pairwise by some suffix, so no machine with
//     fewer states can tell them all apart (this is what "No machine does it
//     with fewer states" claims);
//   - the check accepts that machine, rejects it with one accepting state
//     flipped (and names the shortest wrong string, found here by brute
//     force), and reports a removed arrow as missing.
// For every page: each <Problem> holds one <MachineBuilder>, its language
// exists, and every <Tests> string agrees with the predicate.
//
// No machine is written down. The ones checked are built from the predicates
// in memory.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { allStrings, checkMachine, runMachine, targetOf, type Dfa, type MachineSpec } from "../src/components/games/fsm/builder/engine.ts";
import { LANGUAGES } from "../src/components/games/fsm/builder/languages.ts";

const PAGES = [
  "machines/ends-and-beginnings", "machines/counting", "machines/length", "machines/somewhere-inside",
  "machines/looking-back", "machines/numbers", "machines/two-conditions", "machines/deep-end", "machines/exact-words",
];

const specOf = (d: Dfa, alphabet: string[]): MachineSpec => {
  const name = (i: number) => `S${i}`;
  const arrows: MachineSpec["arrows"] = {};
  for (let q = 0; q < d.n; q++) arrows[name(q)] = Object.fromEntries(alphabet.map((a, k) => [a, name(d.delta[q][k])]));
  return {
    states: Array.from({ length: d.n }, (_, i) => name(i)),
    start: name(d.start),
    accepting: Array.from({ length: d.n }, (_, i) => i).filter((i) => d.accept[i]).map(name),
    arrows,
  };
};

// The longest length at which every string over an alphabet of size k fits
// in a budget, so the brute-force sweeps stay fast on larger alphabets.
const maxLen = (k: number, budget = 120000, cap = 14) => {
  let n = 0, count = 1;
  while (n < cap && count * k <= budget) { count *= k; n++; }
  return n;
};

for (const [key, lang] of Object.entries(LANGUAGES)) {
  test(`language ${key}`, () => {
    const b = lang.bound ?? 8;
    const T = targetOf(lang);
    const d = T.dfa, alph = T.alphabet;
    const L = maxLen(alph.length);
    if (lang.longest !== undefined) {
      // a finite language: the bound only has to cover the longest word
      assert.ok(b - 1 >= lang.longest, `${key}: bound ${b} does not cover words of length ${lang.longest}`);
      for (const w of allStrings(alph, Math.min(lang.longest + 3, L))) if (w.length > lang.longest)
        assert.ok(!lang.accepts(w), `${key}: accepts "${w}", longer than longest = ${lang.longest}`);
    } else {
      assert.ok(d.n < b, `${key}: ${d.n} states is not safely below the bound ${b}`);
    }
    const more = b > 12 ? 2 : alph.length > 4 ? 1 : 4;   // the sweep grows fast with the bound
    assert.equal(targetOf({ ...lang, bound: b + more }).dfa.n, d.n, `${key}: a larger bound changes the machine`);

    // the letters left out of `relevant` really are interchangeable
    if (lang.relevant) {
      const others = lang.alphabet.filter((a) => !lang.relevant!.includes(a)).slice(0, 2);
      const stand = alph[alph.length - 1];
      for (const w of allStrings([...lang.relevant, ...others], maxLen(lang.relevant.length + others.length, 120000, 7))) {
        const mapped = [...w].map((c) => (lang.relevant!.includes(c) ? c : stand)).join("");
        assert.equal(!!lang.accepts(w), !!lang.accepts(mapped), `${key}: "${w}" and "${mapped}" differ, so the other letters are not interchangeable`);
      }
    }

    // agrees with the predicate
    const spec = specOf(d, alph);
    for (const w of allStrings(alph, L))
      assert.equal(runMachine(spec, w).accepted, !!lang.accepts(w), `${key}: disagrees on "${w}"`);

    // pairwise distinguishable representatives: a lower bound on the size
    const suffixes = allStrings(alph, Math.min(b - 1, L));
    for (let i = 0; i < d.n; i++)
      for (let j = i + 1; j < d.n; j++)
        assert.ok(
          suffixes.some((z) => !!lang.accepts(d.reps[i] + z) !== !!lang.accepts(d.reps[j] + z)),
          `${key}: "${d.reps[i]}" and "${d.reps[j]}" are not told apart`,
        );

    // the check
    assert.deepEqual(checkMachine(spec, alph, d), { status: "ok", states: d.n, fewest: d.n });
    const sweep = allStrings(alph, L);
    for (let q = 0; q < d.n; q++) {
      const flipped: MachineSpec = {
        ...spec,
        accepting: spec.accepting.includes(`S${q}`) ? spec.accepting.filter((s) => s !== `S${q}`) : [...spec.accepting, `S${q}`],
      };
      const r = checkMachine(flipped, alph, d);
      assert.equal(r.status, "wrong", `${key}: flipping S${q} went unnoticed`);
      const first = sweep.find((w) => runMachine(flipped, w).accepted !== !!lang.accepts(w));
      if (r.status === "wrong" && first !== undefined) assert.equal(r.word, first, `${key}: not the shortest wrong string`);
      if (r.status === "wrong") assert.equal(r.accepts, runMachine(flipped, r.word).accepted);
    }

    const holed: MachineSpec = { ...spec, arrows: { ...spec.arrows, S0: { ...spec.arrows.S0 } } };
    const gone = alph[alph.length - 1];
    delete holed.arrows.S0[gone];
    assert.deepEqual(checkMachine(holed, alph, d), { status: "missing", missing: [{ state: "S0", symbol: gone }] });
  });
}

// ---- the pages ------------------------------------------------------------------

const strList = (src: string, name: string): string[] => {
  const m = src.match(new RegExp(`${name}=\\{\\[([^\\]]*)\\]\\}`));
  return m ? [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]) : [];
};

for (const page of PAGES) {
  test(`page ${page}`, () => {
    const mdx = readFileSync(new URL(`../src/pages/${page}.mdx`, import.meta.url), "utf8");
    const problems = [...mdx.matchAll(/<Problem\s[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<\/Problem>/g)];
    assert.ok(problems.length > 0, `${page}: no problems found`);
    const ids = new Set<string>();
    for (const [, title, body] of problems) {
      const builders = [...body.matchAll(/<MachineBuilder\b([^>]*)\/>/g)];
      assert.equal(builders.length, 1, `${page} "${title}": expected one MachineBuilder`);
      const attrs = builders[0][1];
      assert.match(attrs, /client:visible/, `${page} "${title}": MachineBuilder needs client:visible`);
      const key = attrs.match(/language="([^"]+)"/)?.[1];
      assert.ok(key && LANGUAGES[key], `${page} "${title}": unknown language ${key}`);
      const id = attrs.match(/\bid="([^"]+)"/)?.[1] ?? key!;
      assert.ok(!ids.has(id), `${page}: id ${id} used twice`);
      ids.add(id);
      const lang = LANGUAGES[key!];
      for (const w of strList(body, "accept")) assert.ok(lang.accepts(w), `${page} "${title}": should accept "${w}"`);
      for (const w of strList(body, "reject")) assert.ok(!lang.accepts(w), `${page} "${title}": should reject "${w}"`);
    }
  });
}

test("drawn arrows: labels, clashes, unlabelled arrows", async () => {
  const { specFromEdges, parseLabel } = await import("../src/components/games/fsm/builder/engine.ts");
  const AB = ["0", "1"];
  assert.deepEqual(parseLabel("1, 0", AB), ["0", "1"]);
  assert.deepEqual(parseLabel(" 0 0 ", AB), ["0"]);
  assert.deepEqual(parseLabel("", AB), []);
  assert.equal(parseLabel("0,2", AB), null);
  const r = specFromEdges(["P", "Q"], "P", [], [
    { from: "P", to: "Q", label: ["0"] },
    { from: "P", to: "P", label: ["0", "1"] },
    { from: "Q", to: "P", label: [] },
  ], AB);
  assert.deepEqual(r.unlabeled, [2]);
  assert.deepEqual(r.clashes, [{ state: "P", symbol: "0", edges: [0, 1] }]);
  assert.deepEqual(r.spec.arrows, { P: { "1": "P" }, Q: {} });
});

test("large alphabets: a machine over every letter against the compressed target", async () => {
  const { compare } = await import("../src/components/games/fsm/builder/engine.ts");
  for (const [key, lang] of Object.entries(LANGUAGES)) {
    if (!lang.relevant) continue;
    const T = targetOf(lang);
    const name = (i: number) => `S${i}`;
    const full: MachineSpec = {
      states: Array.from({ length: T.dfa.n }, (_, i) => name(i)),
      start: name(0),
      accepting: Array.from({ length: T.dfa.n }, (_, i) => i).filter((i) => T.dfa.accept[i]).map(name),
      arrows: Object.fromEntries(Array.from({ length: T.dfa.n }, (_, q) => [name(q), Object.fromEntries(lang.alphabet.map((a) => [a, name(T.dfa.delta[q][T.index(a)])]))])),
    };
    assert.equal(compare(full, lang.alphabet, T.dfa, T.index), null, `${key}: the full machine should pass`);
    for (const w of allStrings(lang.alphabet, 2)) assert.equal(runMachine(full, w).accepted, !!lang.accepts(w), `${key}: "${w}"`);
    // send one non-relevant letter somewhere else from the start: the check must notice if it matters
    const stray = lang.alphabet.find((a) => !lang.relevant!.includes(a))!;
    const bent: MachineSpec = { ...full, arrows: { ...full.arrows, S0: { ...full.arrows.S0, [stray]: name((T.dfa.delta[0][T.index(stray)] + 1) % T.dfa.n) } } };
    const r = compare(bent, lang.alphabet, T.dfa, T.index);
    if (r) assert.notEqual(runMachine(bent, r.word).accepted, !!lang.accepts(r.word), `${key}: the reported string is not wrong`);
  }
});

test("labels: other and conventions", async () => {
  const { specFromEdges, parseLabel, parseConvention } = await import("../src/components/games/fsm/builder/engine.ts");
  const LOWER = "abcdefghijklmnopqrstuvwxyz".split("");
  assert.equal(parseConvention("all except a, d, f", LOWER)!.length, 23);
  assert.deepEqual(parseConvention("a-c, z", LOWER), ["a", "b", "c", "z"]);
  assert.equal(parseConvention("a, B", LOWER), null);
  assert.deepEqual(parseLabel("h, other", LOWER), ["h", "other"]);
  assert.deepEqual(parseLabel("V d", LOWER, ["V"]), ["d", "V"]);
  assert.equal(parseLabel("W", LOWER, ["V"]), null);
  const r = specFromEdges(["p", "q", "d"], "p", [], [
    { from: "p", to: "q", label: ["h"] },
    { from: "p", to: "d", label: ["other"] },
    { from: "q", to: "d", label: ["V"] },
    { from: "q", to: "q", label: ["a", "other"] },
    { from: "d", to: "d", label: ["W"] },
  ], LOWER, { V: ["a", "e"] });
  assert.deepEqual(r.expanded.map((e) => e.length), [1, 25, 2, 25, 0]);
  assert.deepEqual(r.clashes.map((c) => [c.state, c.symbol]), [["q", "a"]]);
  assert.deepEqual(r.unknown, [{ edge: 4, token: "W" }]);
});
