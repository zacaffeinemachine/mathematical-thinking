// Every sentence a student can see from the circuit problem components, in
// one place, so the tone can be changed once for all of them. Plain English,
// no em-dashes, no semicolons.

export const MSG = {
  // Builder.
  builderRight: (rows: number) => `Correct. Your circuit matches the table on all ${rows} rows.`,
  unwired: (labels: string[]) =>
    labels.length === 1 ? `The bulb ${labels[0]} is not wired to anything yet.` : `The bulbs ${labels.join(", ")} are not wired to anything yet.`,
  emptyPin: "A gate has an empty input. It is marked in red.",
  loop: "That wire would make a loop. Circuits here have no loops.",
  counterexample: (row: string) => `Not yet. Your circuit is wrong on the row ${row}. The switches are now set to that row, and the marked bulb shows what it should do.`,
  shouldBe: (want: 0 | 1) => (want ? "should be lit" : "should be dark"),
  notAllowed: (t: string) => `The table is right, but this problem does not allow ${t} gates.`,
  tooManyInputs: (k: number, lim: number) => `The table is right, but one gate has ${k} inputs. The limit is ${lim}.`,
  tooManyGates: (n: number, lim: number) => `The table is right, but the circuit uses ${n} gates. The limit is ${lim}.`,
  tooDeep: (d: number, lim: number) => `The table is right, but the depth is ${d}. The limit is ${lim}.`,
  tooManyOfType: (t: string, n: number, lim: number) =>
    `The table is right, but the circuit uses ${n} ${t} gates. The limit is ${lim}.`,
  wireHint: "Now tap a pin to connect to, or tap empty space to cancel.",
  builderHint: "Drag a gate to move it. Drag from pin to pin to draw a wire. Tap a gate or wire, then the x, to delete it.",
  emptyCanvas: "Tap a gate above the canvas to add it. Then drag from a pin to a pin to draw a wire.",
  // Predict.
  predictRight: "Correct. The wires now show their values.",
  predictWrong: "Not quite. At least one answer is wrong.",
  predictIncomplete: "Answer every question mark first.",
  // Fill.
  fillRight: "Correct. Every row is right. The switches now work, so you can try the rows yourself.",
  fillWrong: (n: number) => (n === 1 ? "One row is wrong. It is marked." : `${n} rows are wrong. They are marked.`),
  fillIncomplete: "Fill every empty cell first.",
  // Find.
  findOneRight: "Done. That setting gives exactly what was asked.",
  findOneWrong: "Not this setting. The bulbs do not show what was asked.",
  findAllRight: (n: number) => (n === 1 ? "Correct. That is the only setting." : `Correct. These are all ${n} settings.`),
  findAllNone: "Correct. No setting works.",
  findAllHasWrong: "Not yet. At least one setting in your list does not give what was asked.",
  findAllMissing: "Every setting in your list works, but some are missing.",
  findDuplicate: "That setting is already in your list.",
  // Pick.
  pickRight: "Correct.",
  pickWrong: "Not quite.",
} as const;
