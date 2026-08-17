import { db } from "@/db";
import { memories, memoryEvidence } from "@/db/schema";
import { explain, getVersionChain } from "@/lib/memory-engine";

const projectId = "31626b33-8a91-4f16-a926-a66f413763ce";
const environmentId = "13fd88f3-faa1-4808-af3f-e407b67bf414";
const endUserId = "user_demo_1";

async function main() {
  const [v1] = await db
    .insert(memories)
    .values({
      projectId,
      environmentId,
      endUserId,
      content: "Lives in Austin",
      type: "fact",
      confidence: 0.85,
      importance: 0.5,
      status: "superseded",
      sourceType: "api",
    })
    .returning();
  await db.insert(memoryEvidence).values({
    memoryId: v1.id,
    sourceType: "api",
    excerpt: "Lives in Austin",
    eventType: "extracted",
  });

  const [v2] = await db
    .insert(memories)
    .values({
      projectId,
      environmentId,
      endUserId,
      content: "Lives in Denver",
      type: "fact",
      confidence: 0.9,
      importance: 0.5,
      status: "superseded",
      sourceType: "api",
      supersedesId: v1.id,
    })
    .returning();
  await db.insert(memoryEvidence).values({
    memoryId: v2.id,
    sourceType: "api",
    excerpt: "Lives in Denver",
    eventType: "updated",
    reasoning: "User explicitly stated they moved from Austin to Denver — same topic, changed detail.",
  });

  const [v3] = await db
    .insert(memories)
    .values({
      projectId,
      environmentId,
      endUserId,
      content: "Lives in Seattle",
      type: "fact",
      confidence: 0.92,
      importance: 0.5,
      status: "active",
      sourceType: "api",
      supersedesId: v2.id,
    })
    .returning();
  await db.insert(memoryEvidence).values({
    memoryId: v3.id,
    sourceType: "api",
    excerpt: "Lives in Seattle",
    eventType: "updated",
    reasoning: "User explicitly stated they moved again, from Denver to Seattle.",
  });

  console.log("Created chain:", v1.id, "->", v2.id, "->", v3.id);

  const chain = await getVersionChain(v2.id, { projectId, environmentId });
  console.log(
    "getVersionChain(v2) versions:",
    chain?.versions.map((v) => ({ content: v.content, changeReasoning: v.changeReasoning })),
    "currentIndex:",
    chain?.currentIndex
  );

  const detail = await explain(v3.id, { projectId, environmentId });
  console.log("explain(v3).versions:", detail?.versions.map((v) => v.content), "index:", detail?.versionIndex);

  console.log("DETAIL_URL_ID=" + v2.id);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
