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
