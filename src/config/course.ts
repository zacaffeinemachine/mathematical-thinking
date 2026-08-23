// -----------------------------------------------------------------------
//  The teaching team, the office, and the booking link.
// -----------------------------------------------------------------------
//
//  These mirror the macros at the top of `Slides/PreambleSlides.tex`
//  (\instructorname, \tfone, \tftwo, \taone … \tafour, \ohroom, \ohurl),
//  which is what the slide decks print in their title footer. The two
//  files are the only places any of this is written down, so when the
//  office moves or the team changes, change both.
// -----------------------------------------------------------------------

export const COURSE_NAME = "Mathematical Thinking";
export const COURSE_SUBTITLE = "A Course Taught Through Puzzles";

export const INSTRUCTOR = "Abhishek Khetan";

export const TEACHING_FELLOWS: readonly string[] = [
  "Anirban Bhattacharjee",
  "Maadhav Gupta",
];

export const TEACHING_ASSISTANTS: readonly string[] = [
  "Ananya Agarwal",
  "Gauri Makker",
  "Krishna Praneeth Sidde",
  "Vedika Navani",
];

/** Room number of the instructor's office. */
export const OFFICE = "AC04-703";

/**
 * Google Calendar appointment page — students book their own office-hour slot.
 * Booking is optional. Walking in is the ordinary way to come; a slot only
 * guarantees the instructor is in the room at the chosen time. Any copy that
 * uses this link has to say so.
 */
export const BOOKING_URL = "https://calendar.app.google/w3NFv5FVg4SC2GaXA";
