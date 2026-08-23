import { describe, expect, it } from "vitest";
import { hashResetToken, normalizeEmail } from "@/lib/password-reset";
import { MIN_PASSWORD_LENGTH, validatePassword } from "@/lib/password-rules";

/**
 * The parts that need a database — single use, expiry, rate limiting, and that
 * redeeming one link kills the others — are covered by
 * scripts/smoke-password-reset.ts against real Postgres, because they are
 * transactional properties rather than logic.
 */

describe("hashResetToken", () => {
  it("is stable, so a link can be looked up", () => {
    expect(hashResetToken("abc")).toBe(hashResetToken("abc"));
  });

  it("does not contain the token", () => {
    // The token in the emailed link is a bearer credential for a whole
    // account; a database dump must not hand over working resets.
    expect(hashResetToken("secret")).not.toContain("secret");
    expect(hashResetToken("secret")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for tokens differing by one character", () => {
    expect(hashResetToken("token-a")).not.toBe(hashResetToken("token-b"));
  });
});

describe("validatePassword", () => {
  it("rejects anything shorter than the minimum", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).not.toBeNull();
  });

  it("accepts the minimum length", () => {
    expect(validatePassword("a".repeat(MIN_PASSWORD_LENGTH))).toBeNull();
  });

  it("does not impose composition rules", () => {
    // Length beats character classes: forcing a symbol and a digit reliably
    // produces "Password1!" and nothing safer.
    expect(validatePassword("correct horse battery staple")).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("matches the address regardless of case or padding", () => {
    expect(normalizeEmail("  Person@Example.COM ")).toBe("person@example.com");
  });
});
