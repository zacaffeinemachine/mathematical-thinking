// The language each machine-building problem asks for, keyed by the
// `language` prop of <MachineBuilder>. A language is a predicate on strings,
// written from the problem statement and nothing else. It is the statement
// in code, not a solution: no machine is written down here or anywhere else.
// One file per page in languages/, merged below.
//
// The predicate ships to the browser (MDX cannot pass a function to an
// island), so it lives here and the page names it by key.
//
// Rules:
//   - Write the predicate from the words of the problem, independently of
//     any machine. tests/machine-builder.test.ts checks every <Tests> string
//     on the page against it, so a predicate and a statement that drift
//     apart are caught.
//   - Keys are "<page>/<problem>", unique across the site.
//   - `bound` (default 8) must exceed the number of states of the smallest
//     machine. The test checks that raising it changes nothing.
//   - `longest`, for a finite language: no accepted string is longer than
//     this. Suffixes of that length already tell any two states apart, so
//     `bound` = `longest` + 1 is exact however many states the machine has.
//     The test checks that every longer string is rejected.
//   - `relevant`, for a large alphabet: the only symbols the language treats
//     individually. Every other symbol must be interchangeable with every
//     other (swapping one for another never changes the answer), and the
//     check then treats them all as one. The test confirms the claim.

export interface Language {
  alphabet: string[];
  accepts: (s: string) => boolean;
  bound?: number;
  relevant?: string[];
  longest?: number;
}

// Re-exported before the page files are imported, so a page file that takes
// LOWER from here finds it initialised.
export { LOWER } from "./languages/alphabets.ts";

import { L as ends_and_beginnings } from "./languages/ends-and-beginnings.ts";
import { L as counting } from "./languages/counting.ts";
import { L as length } from "./languages/length.ts";
import { L as somewhere_inside } from "./languages/somewhere-inside.ts";
import { L as looking_back } from "./languages/looking-back.ts";
import { L as exact_words } from "./languages/exact-words.ts";
import { L as numbers } from "./languages/numbers.ts";
import { L as two_conditions } from "./languages/two-conditions.ts";
import { L as deep_end } from "./languages/deep-end.ts";

export const LANGUAGES: Record<string, Language> = { ...ends_and_beginnings, ...counting, ...length, ...somewhere_inside, ...looking_back, ...exact_words, ...numbers, ...two_conditions, ...deep_end };
