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

import { allStrings, checkMachine, minimalDfa, runMachine, type Dfa, type MachineSpec } from "../src/components/games/fsm/builder/engine.ts";
import { LANGUAGES } from "../src/components/games/fsm/builder/languages.ts";

const PAGES = ["machines/ends-and-beginnings"];

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

for (const [key, lang] of Object.entries(LANGUAGES)) {
  test(`language ${key}`, () => {
    const b = lang.bound ?? 8;
    const d = minimalDfa(lang.alphabet, lang.accepts, b);
    assert.ok(d.n < b, `${key}: ${d.n} states is not safely below the bound ${b}`);
    assert.equal(minimalDfa(lang.alphabet, lang.accepts, b + 4).n, d.n, `${key}: a larger bound changes the machine`);

    // agrees with the predicate
    const spec = specOf(d, lang.alphabet);
    for (const w of allStrings(lang.alphabet, 14))
      assert.equal(runMachine(spec, w).accepted, !!lang.accepts(w), `${key}: disagrees on "${w}"`);

    // pairwise distinguishable representatives: a lower bound on the size
    const suffixes = allStrings(lang.alphabet, 10);
    for (let i = 0; i < d.n; i++)
      for (let j = i + 1; j < d.n; j++)
        assert.ok(
          suffixes.some((z) => !!lang.accepts(d.reps[i] + z) !== !!lang.accepts(d.reps[j] + z)),
          `${key}: "${d.reps[i]}" and "${d.reps[j]}" are not told apart`,
        );

    // the check
    const ok = checkMachine(spec, lang.alphabet, d);
    assert.deepEqual(ok, { status: "ok", states: d.n, fewest: d.n });

    for (let q = 0; q < d.n; q++) {
      const flipped: MachineSpec = {
        ...spec,
        accepting: spec.accepting.includes(`S${q}`) ? spec.accepting.filter((s) => s !== `S${q}`) : [...spec.accepting, `S${q}`],
      };
      const r = checkMachine(flipped, lang.alphabet, d);
      const first = allStrings(lang.alphabet, 12).find((w) => runMachine(flipped, w).accepted !== !!lang.accepts(w));
      assert.equal(r.status, "wrong", `${key}: flipping S${q} went unnoticed`);
      if (r.status === "wrong") {
        assert.equal(r.word, first, `${key}: not the shortest wrong string`);
        assert.equal(r.accepts, runMachine(flipped, r.word).accepted);
      }
    }

    const holed: MachineSpec = { ...spec, arrows: { ...spec.arrows, S0: { ...spec.arrows.S0 } } };
    delete holed.arrows.S0[lang.alphabet[1]];
    assert.deepEqual(checkMachine(holed, lang.alphabet, d), { status: "missing", missing: [{ state: "S0", symbol: lang.alphabet[1] }] });
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
