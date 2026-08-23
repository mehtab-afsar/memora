/**
 * Password rules, with no imports.
 *
 * Split from `password-reset.ts` because that file imports the database driver,
 * and a client component importing it drags `pg` into the browser bundle and
 * fails the build. These are pure and both sides need them.
 */

export const MIN_PASSWORD_LENGTH = 10;

/** Returns a message to show, or null when the password is acceptable. */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    // Length rather than character classes: requiring a symbol and a digit
    // reliably produces "Password1!" and nothing safer.
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
