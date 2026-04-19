// -----------------------------------------------------------------------
//  Visibility controls — the one file you edit to release material.
// -----------------------------------------------------------------------
//
//  Comment out an entry to hide it from students; uncomment to reveal.
//  Changes take effect on the next `npm run build` (and redeploy).
//
//  Rules of the game:
//    • A hidden chapter is hidden from the home page. Its landing page
//      and every one of its sub-pages show a polite "not yet released"
//      message if a student URL-guesses them.
//    • A hidden page is hidden from the chapter's page list and from the
//      in-chapter TOC and prev/next links. Same "not yet released" wall
//      for URL-guessers.
//    • Hiding a chapter implicitly hides all its pages — you do NOT need
//      to comment out each sub-page.
//
//  Note: this is listing-level gating, not hard access control. The HTML
//  is still generated; the wall keeps casual URL-guessing students out,
//  but a determined one can inspect the build. For hard gating, add basic
//  auth at the host level.
// -----------------------------------------------------------------------

export const VISIBLE_CHAPTERS: readonly string[] = [
  "guarini",
  "logical-thinking",
];

export const VISIBLE_PAGES: readonly string[] = [
  "guarini/knight-moves",
  "guarini/swap-knights",
  "guarini/row-swap",
  "guarini/classical",
  "guarini/greater-challenge",
  "guarini/forbidden-fruit",
  "guarini/exercises",

  "logical-thinking/wason",
  "logical-thinking/hat-hurdle",
  "logical-thinking/judicious-jinx",
  "logical-thinking/exercises",
];

export function isChapterVisible(slug: string): boolean {
  return VISIBLE_CHAPTERS.includes(slug);
}

export function isPageVisible(chapter: string, pageSlug: string): boolean {
  if (!isChapterVisible(chapter)) return false;
  return VISIBLE_PAGES.includes(`${chapter}/${pageSlug}`);
}
