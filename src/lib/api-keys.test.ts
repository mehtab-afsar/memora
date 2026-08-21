import { describe, expect, it } from "vitest";
import { generateApiKey, hashApiKey } from "@/lib/api-keys";

describe("generateApiKey", () => {
  it("marks production keys live and everything else test", () => {
    expect(generateApiKey("production").fullKey.startsWith("sk_live_")).toBe(true);
    expect(generateApiKey("Production").fullKey.startsWith("sk_live_")).toBe(true);
    expect(generateApiKey("development").fullKey.startsWith("sk_test_")).toBe(true);
    expect(generateApiKey("staging").fullKey.startsWith("sk_test_")).toBe(true);
  });

  it("returns a prefix that is a safe-to-display head of the key", () => {
    const { fullKey, prefix } = generateApiKey("production");
    expect(fullKey.startsWith(prefix)).toBe(true);
    expect(prefix).toMatch(/^sk_(live|test)_.{4}$/);
    expect(prefix.length).toBeLessThan(fullKey.length);
  });

  it("never returns the same secret twice", () => {
    const keys = new Set(Array.from({ length: 50 }, () => generateApiKey("production").fullKey));
    expect(keys.size).toBe(50);
  });

  it("returns the hash of the full key, not of the prefix", () => {
    const { fullKey, prefix, hash } = generateApiKey("production");
    expect(hash).toBe(hashApiKey(fullKey));
    expect(hash).not.toBe(hashApiKey(prefix));
  });
});

describe("hashApiKey", () => {
  it("is a stable sha256 hex digest", () => {
    // Fixed vector: if this digest changes, every key already in the database
    // stops resolving.
    expect(hashApiKey("sk_test_example")).toBe(
      "d3b9b59ae0caf2d895e5f0ec95c03c85d2ca5aab669cf1c956071e4bd0ad82b4"
    );
    expect(hashApiKey("a")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey("a")).not.toBe(hashApiKey("b"));
  });
});
