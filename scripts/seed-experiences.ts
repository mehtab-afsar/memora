import { db } from "@/db";
import { experiences } from "@/db/schema";
import { listExperiences } from "@/lib/experience-engine";

const projectId = "31626b33-8a91-4f16-a926-a66f413763ce";
const environmentId = "13fd88f3-faa1-4808-af3f-e407b67bf414";

// Fake but realistic-shaped embeddings for UI/query testing without a live Voyage key —
// close enough in vector space that a query about "deploying" ranks them sensibly.
function fakeEmbedding(seed: number): number[] {
  const v = Array.from({ length: 1024 }, (_, i) => Math.sin(seed * 999 + i) * 0.01);
  v[0] = 0.9 + seed * 0.01;
  return v;
}

async function main() {
  const [failure] = await db
    .insert(experiences)
    .values({
      projectId,
      environmentId,
      task: "Deploy application",
      action: "Used Docker configuration A",
      outcome: "failure",
      cause: "Missing DATABASE_URL environment variable",
      resolution: "Added DATABASE_URL to the container's env",
      lesson: "Deployment requires DATABASE_URL to be set before the container starts.",
      embedding: fakeEmbedding(1),
      sourceType: "api",
    })
    .returning();

  // A second attempt at the exact same task — exercises task-grouping in the dashboard
  // (exact-text match, per the plan — not fuzzy clustering).
  const [secondFailure] = await db
    .insert(experiences)
    .values({
      projectId,
      environmentId,
      task: "Deploy application",
      action: "Used Docker configuration A with DATABASE_URL added",
      outcome: "failure",
      cause: "Container ran out of memory during build",
      resolution: null,
      lesson: "Configuration A's build step needs more memory than the default container limit.",
      embedding: fakeEmbedding(1.02),
      sourceType: "api",
    })
    .returning();

  const [success] = await db
    .insert(experiences)
    .values({
      projectId,
      environmentId,
      task: "Deploy application to production",
      action: "Used Docker configuration B with all required env vars pre-set",
      outcome: "success",
      lesson: "Configuration B with a full env checklist deploys cleanly.",
      embedding: fakeEmbedding(1.05),
      sourceType: "api",
    })
    .returning();

  console.log("Seeded experiences:", failure.id, secondFailure.id, success.id);

  // recallExperiences() needs a live VOYAGE_API_KEY (embeds the query) — not available yet,
  // so verify the pure-DB list path here instead; recall() itself gets curl-tested for
  // graceful failure the same way remember()/recall() were in the earlier phases.
  const { experiences: listed, total } = await listExperiences({ projectId, environmentId });
  console.log(
    "listExperiences:",
    total,
    "total,",
    listed.map((e) => ({ task: e.task, outcome: e.outcome }))
  );

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
