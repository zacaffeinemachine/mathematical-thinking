// ---------------------------------------------------------------------------
//  Boolean equations: parse what a student types, and compare it with the
//  intended answer by the patterns it allows.
//
//  Two answers count as the same exactly when they hold on the same patterns
//  of the letters. So `a(1+b) = 0`, `a + ab = 0` and `ab = a` are all accepted
//  for "if a then b", which is the chapter's own point about shapes.
//
//  Syntax: single letters, the digits 0 and 1, `+` (a `-` is read as `+`,
//  since subtraction is addition here), `*` or `·` or plain juxtaposition for
//  multiplication, `^` with a whole-number exponent, brackets, and `=`.
//  Several equations may be separated by commas; all of them must hold.
// ---------------------------------------------------------------------------

type Node =
  | { k: "var"; name: string }
  | { k: "const"; v: 0 | 1 }
  | { k: "add"; l: Node; r: Node }
  | { k: "mul"; l: Node; r: Node }
  | { k: "pow"; b: Node; e: number };

export class ParseError extends Error {}

function tokenize(src: string): string[] {
  const out: string[] = [];
  const s = src.replace(/[·⋅×]/g, "*").replace(/[−–]/g, "-");
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "^") {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      let num = "";
      while (j < s.length && /[0-9]/.test(s[j])) num += s[j++];
      if (!num) throw new ParseError("A ^ must be followed by a whole number.");
      out.push("^" + num);
      i = j;
      continue;
    }
    if (/[a-zA-Z01+\-*()=,;]/.test(c)) { out.push(c === ";" ? "," : c); i++; continue; }
    if (/[2-9]/.test(c)) throw new ParseError("The only numbers here are 0 and 1.");
    throw new ParseError(`The symbol "${c}" is not part of the notation.`);
  }
  return out;
}

class Parser {
  private p = 0;
  private t: string[];
  constructor(t: string[]) { this.t = t; }
  private peek() { return this.t[this.p]; }
  private next() { return this.t[this.p++]; }
  atEnd() { return this.p >= this.t.length; }

  expression(): Node {
    const n = this.expr();
    if (this.peek() === "=") throw new ParseError("Type the simplified expression only, with no = sign.");
    if (!this.atEnd()) throw new ParseError("Something is left over at the end.");
    return n;
  }

  equations(): [Node, Node][] {
    const eqs: [Node, Node][] = [this.equation()];
    while (this.peek() === ",") { this.next(); eqs.push(this.equation()); }
    if (!this.atEnd()) throw new ParseError("Something is left over at the end.");
    return eqs;
  }
  private equation(): [Node, Node] {
    const l = this.expr();
    if (this.peek() !== "=") throw new ParseError("Each answer must be an equation, with one = sign.");
    this.next();
    const r = this.expr();
    if (this.peek() === "=") throw new ParseError("Use one = sign per equation.");
    return [l, r];
  }
  private expr(): Node {
    let n = this.term();
    while (this.peek() === "+" || this.peek() === "-") { this.next(); n = { k: "add", l: n, r: this.term() }; }
    return n;
  }
  private startsFactor(t: string | undefined) {
    return t !== undefined && (/^[a-zA-Z01]$/.test(t) || t === "(");
  }
  private term(): Node {
    let n = this.factor();
    for (;;) {
      if (this.peek() === "*") { this.next(); n = { k: "mul", l: n, r: this.factor() }; }
      else if (this.startsFactor(this.peek())) n = { k: "mul", l: n, r: this.factor() };
      else return n;
    }
  }
  private factor(): Node {
    let n = this.atom();
    while (this.peek()?.startsWith("^")) n = { k: "pow", b: n, e: Number(this.next().slice(1)) };
    return n;
  }
  private atom(): Node {
    const t = this.next();
    if (t === undefined) throw new ParseError("The equation stops too early.");
    if (t === "0" || t === "1") return { k: "const", v: t === "1" ? 1 : 0 };
    if (/^[a-zA-Z]$/.test(t)) return { k: "var", name: t };
    if (t === "(") {
      const n = this.expr();
      if (this.next() !== ")") throw new ParseError("A bracket is not closed.");
      return n;
    }
    throw new ParseError(`Did not expect "${t}" there.`);
  }
}

function letters(n: Node, into: Set<string>) {
  if (n.k === "var") into.add(n.name);
  else if (n.k === "add" || n.k === "mul") { letters(n.l, into); letters(n.r, into); }
  else if (n.k === "pow") letters(n.b, into);
}

function evaluate(n: Node, env: Record<string, number>): number {
  switch (n.k) {
    case "var": return env[n.name];
    case "const": return n.v;
    case "add": return evaluate(n.l, env) ^ evaluate(n.r, env);
    case "mul": return evaluate(n.l, env) & evaluate(n.r, env);
    case "pow": return n.e === 0 ? 1 : evaluate(n.b, env);
  }
}

/** Every pattern of the given letters, as strings of 0s and 1s in letter order. */
export function patterns(vars: string): string[] {
  const n = vars.length;
  return Array.from({ length: 1 << n }, (_, i) => i.toString(2).padStart(n, "0"));
}

/**
 * The patterns (as 0/1 strings over `vars`) on which every equation in `src`
 * holds. Throws ParseError on bad input or on a letter not in `vars`.
 */
export function solutions(src: string, vars: string): string[] {
  const eqs = new Parser(tokenize(src)).equations();
  const used = new Set<string>();
  for (const [l, r] of eqs) { letters(l, used); letters(r, used); }
  const stray = [...used].filter((x) => !vars.includes(x));
  if (stray.length)
    throw new ParseError(`Use only the letters ${vars.split("").join(", ")}.`);
  return patterns(vars).filter((p) => {
    const env: Record<string, number> = {};
    vars.split("").forEach((v, i) => (env[v] = Number(p[i])));
    return eqs.every(([l, r]) => evaluate(l, env) === evaluate(r, env));
  });
}

export function sameSolutions(a: string, b: string, vars: string): boolean {
  const x = solutions(a, vars), y = solutions(b, vars);
  return x.length === y.length && x.every((p, i) => p === y[i]);
}

/**
 * Read a typed set of solutions, such as `{(0, 1), (1, 0)}`, as a list of 0/1
 * strings in letter order. The empty set may be written `{}`, `∅` or `none`.
 * Brackets and commas are optional, so `01, 10` is read the same way. Repeats
 * are dropped. Throws ParseError when a tuple is malformed or the wrong length.
 */
export function parseSolutionSet(src: string, letters: string): string[] {
  const n = letters.length;
  let s = src.trim().replace(/[⟨〈]/g, "(").replace(/[⟩〉]/g, ")");
  if (/^(∅|\{\s*\}|none|empty)$/i.test(s)) return [];
  if (s.startsWith("{") !== s.endsWith("}"))
    throw new ParseError("The braces { } do not match.");
  if (s.startsWith("{")) s = s.slice(1, -1).trim();
  if (!s) return [];
  if (/[{}∅]/.test(s)) throw new ParseError("Write the set with one pair of braces around it.");
  if (/[^01(),;\s]/.test(s)) {
    const c = s.match(/[^01(),;\s]/)![0];
    throw new ParseError(
      /[2-9]/.test(c) ? "The only entries are 0 and 1." : `The symbol "${c}" is not part of the notation.`,
    );
  }

  let tuples: string[];
  if (/[()]/.test(s)) {
    const re = /\(([^()]*)\)/g;
    tuples = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(s))) tuples.push(m[1]);
    if (s.replace(re, "").replace(/[\s,;]/g, "") !== "")
      throw new ParseError("Put every solution in brackets, like (0, 1).");
  } else {
    tuples = s.split(/[,;\s]+/).filter(Boolean);
  }

  const out: string[] = [];
  for (const t of tuples) {
    const bits = t.replace(/[\s,;]/g, "");
    if (bits.length !== n)
      throw new ParseError(
        `Each solution lists ${n} values, one for each of ${letters.split("").join(", ")}.`,
      );
    if (!out.includes(bits)) out.push(bits);
  }
  return out;
}

// ---------------------------------------------------------------------------
//  Simplification answers.
//
//  Every expression has exactly one fully multiplied-out form: a sum of
//  distinct products of distinct letters (plus possibly the constant 1), or
//  the single constant 0. So an answer is accepted when it has that shape
//  and takes the same value as the original on every pattern. Checking the
//  shape is what stops the original expression being typed back.
// ---------------------------------------------------------------------------

function sumTerms(n: Node, out: Node[]) {
  if (n.k === "add") { sumTerms(n.l, out); sumTerms(n.r, out); }
  else out.push(n);
}

function productFactors(n: Node, out: Node[]) {
  if (n.k === "mul") { productFactors(n.l, out); productFactors(n.r, out); }
  else out.push(n);
}

/** Throws ParseError unless `src` is written fully multiplied out. */
function checkMultipliedOut(root: Node) {
  const terms: Node[] = [];
  sumTerms(root, terms);
  const seen = new Set<string>();
  for (const t of terms) {
    const fs: Node[] = [];
    productFactors(t, fs);
    let key: string;
    if (fs.length === 1 && fs[0].k === "const") {
      if (fs[0].v === 0) {
        if (terms.length > 1) throw new ParseError("Leave out any + 0.");
        return;
      }
      key = "1";
    } else {
      const names: string[] = [];
      for (const f of fs) {
        if (f.k === "add") throw new ParseError("Multiply out every bracket.");
        if (f.k === "pow") throw new ParseError("A finished answer has no powers.");
        if (f.k === "const") throw new ParseError("A finished answer has no 0 or 1 inside a product.");
        if (f.k === "var") {
          if (names.includes(f.name)) throw new ParseError("A letter appears twice in one product.");
          names.push(f.name);
        }
      }
      key = names.sort().join("");
    }
    if (seen.has(key)) throw new ParseError("A term appears twice.");
    seen.add(key);
  }
}

/**
 * Whether `src` is `target` fully simplified. Throws ParseError when `src`
 * cannot be read, uses a letter outside `vars`, or is not multiplied out.
 */
export function isSimplified(src: string, target: string, vars: string): boolean {
  const a = new Parser(tokenize(src)).expression();
  const used = new Set<string>();
  letters(a, used);
  if ([...used].some((x) => !vars.includes(x)))
    throw new ParseError(`Use only the letters ${vars.split("").join(", ")}.`);
  checkMultipliedOut(a);
  const b = new Parser(tokenize(target)).expression();
  return patterns(vars).every((p) => {
    const env: Record<string, number> = {};
    vars.split("").forEach((v, i) => (env[v] = Number(p[i])));
    return evaluate(a, env) === evaluate(b, env);
  });
}
