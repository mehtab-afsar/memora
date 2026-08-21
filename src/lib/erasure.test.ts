import { describe, expect, it } from "vitest";
import { subjectHash } from "@/lib/erasure";

/**
 * The database-touching parts of erasure are exercised by scripts/smoke-erasure.ts
 * against a real Postgres, because what they have to get right — that a foreign
 * key cascade actually removes the evidence and the embedding — is a property of
 * the schema, not of this code, and a mocked db would assert only that we called
 * delete.
 *
 * What is worth testing in isolation is the subject hash, because the erasure
 * log's entire claim is that it identifies nobody while still letting an
 * operator prove a specific request was actioned.
 */
describe("subjectHash", () => {
  const scope = { projectId: "p1", environmentId: "e1", endUserId: "user-42" };

  it("is stable, so an operator can recompute it to prove an erasure happened", () => {
    expect(subjectHash(scope)).toBe(subjectHash({ ...scope }));
  });

  it("does not contain the identifier it was derived from", () => {
    expect(subjectHash(scope)).not.toContain("user-42");
    expect(subjectHash(scope)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs across projects for the same end user", () => {
    // Otherwise an erasure log leaked from one project would tell you which
    // users had been erased in every other project too.
    expect(subjectHash(scope)).not.toBe(subjectHash({ ...scope, projectId: "p2" }));
  });

  it("differs across environments, which are separate data stores", () => {
    expect(subjectHash(scope)).not.toBe(subjectHash({ ...scope, environmentId: "e2" }));
  });

  it("distinguishes users whose ids concatenate to the same string", () => {
    // A naive join would hash "p:e:ab" identically for endUserId "ab" and for
    // an environment named "e:a" with user "b".
    expect(subjectHash({ projectId: "p", environmentId: "e", endUserId: "a:b" })).not.toBe(
      subjectHash({ projectId: "p", environmentId: "e:a", endUserId: "b" })
    );
  });
});
