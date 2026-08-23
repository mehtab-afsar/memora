/**
 * The demo user's identifiers, split from the seeding logic in
 * `demo-data.ts` so the dashboard can reference them.
 *
 * That file imports the database driver, and a client component importing it
 * drags `pg` into the browser bundle — which fails the build rather than
 * degrading. Constants that both sides need live here, with no imports.
 */

export const DEMO_USER_ID = "demo-user-priya";

/** Questions that show something worth seeing, rather than merely working. */
export const DEMO_QUERIES = [
  "Where does she live?",
  "How should I talk to her?",
  "What does she think about Postgres?",
  "What is she working on right now?",
  "Can I book her for a 9am?",
];
