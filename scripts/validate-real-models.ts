import { remember, recall, explain, getMemoryInProject } from "@/lib/memory-engine";
import { recordExperience, recallExperiences, recommendForTask } from "@/lib/experience-engine";

const projectId = "31626b33-8a91-4f16-a926-a66f413763ce";
const environmentId = "a24e5ea9-f33e-49d6-b75f-4838a1642bd8"; // clean "validation" env, no seed contamination
const endUserId = "validation_user_1";

let pass = 0;
let fail = 0;

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.log(`  FAIL  ${label}${detail ? " — " + detail : ""}`);
  }
}

async function main() {
  console.log("=== Memory pipeline ===\n");

  console.log("T1: trivial remark should extract nothing");
  const t1 = await remember({
    projectId,
    environmentId,
    endUserId,
    content: "lol that's hilarious",
    sourceType: "validation",
  });
  console.log("  outcomes:", JSON.stringify(t1.outcomes));
  check("T1 extracts zero candidates", t1.outcomes.length === 0);

  console.log("\nT2: clear fact should ADD");
  const t2 = await remember({
    projectId,
    environmentId,
    endUserId,
    content: "I work at Innosphere Ventures as a founder",
    sourceType: "validation",
  });
  console.log("  outcomes:", JSON.stringify(t2.outcomes, null, 2));
  check("T2 produces at least one ADD", t2.outcomes.some((o) => o.decision === "ADD"));
  const t2MemoryId = t2.outcomes.find((o) => o.decision === "ADD")?.memoryId;

  console.log("\nT3: redundant restatement should IGNORE + reconfirm");
  const t3 = await remember({
    projectId,
    environmentId,
    endUserId,
    content: "Just to confirm, I'm a founder at Innosphere Ventures",
    sourceType: "validation",
  });
  console.log("  outcomes:", JSON.stringify(t3.outcomes, null, 2));
  check(
    "T3 produces an IGNORE (with or without reconfirm target)",
    t3.outcomes.some((o) => o.decision === "IGNORE")
  );

  console.log("\nT4: changed detail should ADD then UPDATE (new version)");
  const t4a = await remember({
    projectId,
    environmentId,
    endUserId,
    content: "I live in Austin",
    sourceType: "validation",
  });
  const t4aId = t4a.outcomes.find((o) => o.decision === "ADD")?.memoryId;
  console.log("  first outcome:", JSON.stringify(t4a.outcomes));
  const t4b = await remember({
    projectId,
    environmentId,
    endUserId,
    content: "I moved to Denver last month",
    sourceType: "validation",
  });
  console.log("  second outcome:", JSON.stringify(t4b.outcomes));
  const updateOutcome = t4b.outcomes.find((o) => o.decision === "UPDATE");
  check("T4 second statement produces an UPDATE", !!updateOutcome);
  if (updateOutcome?.memoryId && t4aId) {
    const detail = await explain(updateOutcome.memoryId, { projectId, environmentId });
    check(
      "T4 version chain has 2 versions (Austin -> Denver)",
      (detail?.versions.length ?? 0) >= 2,
      `chain length ${detail?.versions.length}`
    );
    console.log(
      "  version chain:",
      detail?.versions.map((v) => v.content)
    );
  }

  console.log("\nT5: contradictory statement should FLAG");
  const t5a = await remember({
    projectId,
    environmentId,
    endUserId,
    content: "I love using Python for everything, it's my favorite language",
    sourceType: "validation",
  });
  console.log("  first outcome:", JSON.stringify(t5a.outcomes));
  const t5b = await remember({
    projectId,
    environmentId,
    endUserId,
    content: "I really hate Python, it's the worst language I've used",
    sourceType: "validation",
  });
  console.log("  second outcome:", JSON.stringify(t5b.outcomes));
  const flagOutcome = t5b.outcomes.find((o) => o.decision === "FLAG");
  check("T5 second statement produces a FLAG", !!flagOutcome);
  if (flagOutcome?.memoryId) {
    const detail = await explain(flagOutcome.memoryId, { projectId, environmentId });
    check("T5 flagged memory has a linked contradiction", (detail?.contradictions.length ?? 0) > 0);
  }

  console.log("\nT6: recall() should surface the work-related memory for a work query");
  const t6 = await recall({ projectId, environmentId, endUserId, query: "What does this person do for work?" });
  console.log("  results:", JSON.stringify(t6.slice(0, 3), null, 2));
  const topResult = t6[0];
  check(
    "T6 top result mentions Innosphere/founder",
    !!topResult && /innosphere|founder/i.test(topResult.content),
    topResult?.content
  );
  check(
    "T6 results carry similarity/confidence/freshness/reason",
    !!topResult && typeof topResult.similarity === "number" && typeof topResult.reason === "string"
  );

  if (t2MemoryId) {
    const memoryCheck = await getMemoryInProject(t2MemoryId, projectId);
    console.log("\n  T2 memory after reconfirmation — lastConfirmedAt:", memoryCheck?.lastConfirmedAt);
  }

  console.log("\n=== Experience pipeline ===\n");

  console.log("E1: record a failure without a lesson — should auto-generate one");
  const e1 = await recordExperience(
    { projectId, environmentId },
    {
      task: "Deploy application",
      action: "Used Docker configuration A",
      outcome: "failure",
      cause: "Missing DATABASE_URL environment variable",
      resolution: "Added DATABASE_URL to the container's env",
      sourceType: "validation",
    }
  );
  console.log("  auto-generated lesson:", e1.lesson);
  check("E1 lesson was generated and non-empty", e1.lesson.trim().length > 0);
  check("E1 lesson mentions DATABASE_URL", /database_url/i.test(e1.lesson));

  console.log("\nE2: record a second, successful attempt at a similar task");
  await recordExperience(
    { projectId, environmentId },
    {
      task: "Deploy application to production",
      action: "Used Docker configuration B with all required env vars pre-set",
      outcome: "success",
      lesson: "Configuration B with a full env checklist deploys cleanly.",
      sourceType: "validation",
    }
  );

  console.log("\nE3: recallExperiences() for a similar new deployment task");
  const e3 = await recallExperiences({ projectId, environmentId }, "How do I deploy this app to prod?");
  console.log("  results:", JSON.stringify(e3, null, 2));
  check("E3 finds at least one relevant past experience", e3.length > 0);
  check(
    "E3 results carry relevanceScore",
    e3.length > 0 && typeof e3[0].relevanceScore === "number"
  );

  console.log("\nE4: recommendForTask() for a related task — should give a grounded recommendation");
  const e4 = await recommendForTask({ projectId, environmentId }, "Deploy the app to our production environment");
  console.log("  recommendation:", JSON.stringify(e4, null, 2));
  check("E4 returns a non-null recommendation", e4 !== null);
  check(
    "E4 recommendation cites supporting experiences",
    !!e4 && e4.supportingExperiences.length > 0
  );

  console.log("\nE5: recommendForTask() for an unrelated task — should return null, not a guess");
  const e5 = await recommendForTask({ projectId, environmentId }, "Write a haiku about the ocean");
  console.log("  recommendation:", JSON.stringify(e5, null, 2));
  check("E5 returns null (no hallucinated recommendation)", e5 === null);

  console.log(`\n=== Summary: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("SCRIPT ERROR:", err);
  process.exit(1);
});
