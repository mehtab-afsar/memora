import { db } from "@/db";
import { memories, memoryEvidence, contradictions } from "@/db/schema";

const projectId = "31626b33-8a91-4f16-a926-a66f413763ce";
const environmentId = "13fd88f3-faa1-4808-af3f-e407b67bf414";

async function main() {
  const rows = [
    { content: "Prefers concise, bullet-point responses over long prose", type: "preference" as const, confidence: 0.96, importance: 0.7, status: "active" as const },
    { content: "Works at Innosphere Ventures as a founder", type: "fact" as const, confidence: 0.94, importance: 0.9, status: "active" as const },
    { content: "Wants to launch an AI memory infrastructure startup", type: "goal" as const, confidence: 0.88, importance: 0.95, status: "active" as const },
    { content: "Uses TypeScript for backend, Python for ML experiments", type: "fact" as const, confidence: 0.91, importance: 0.6, status: "active" as const },
    { content: "Previous Docker deployment failed due to a missing DATABASE_URL env var", type: "event" as const, confidence: 0.85, importance: 0.5, status: "active" as const },
    { content: "Team decided to use Postgres + pgvector over a dedicated vector DB", type: "decision" as const, confidence: 0.9, importance: 0.65, status: "active" as const },
    { content: "Always answer in a direct, non-sycophantic tone", type: "instruction" as const, confidence: 0.97, importance: 0.8, status: "active" as const },
    { content: "Manager/collaborator on the project is referred to as 'the team'", type: "relationship" as const, confidence: 0.6, importance: 0.3, status: "stale" as const },
    { content: "Was considering moving the project to Vercel for hosting", type: "context" as const, confidence: 0.4, importance: 0.4, status: "stale" as const },
    { content: "Lives in Bangalore", type: "fact" as const, confidence: 0.7, importance: 0.5, status: "superseded" as const },
    { content: "Old onboarding flow used Clerk for auth", type: "context" as const, confidence: 0.5, importance: 0.2, status: "archived" as const },
    { content: "Prefers Python over TypeScript for all projects", type: "preference" as const, confidence: 0.55, importance: 0.5, status: "flagged" as const },
  ];

  const inserted = await db
    .insert(memories)
    .values(rows.map((r) => ({ ...r, projectId, environmentId, endUserId: "user_demo_1", sourceType: "api" })))
    .returning({ id: memories.id, content: memories.content, status: memories.status });

  for (const m of inserted) {
    await db.insert(memoryEvidence).values({
      memoryId: m.id,
      sourceType: "conversation",
      sourceId: "conv_demo",
      excerpt: m.content,
      eventType: "extracted",
    });
  }

  const flagged = inserted.find((m) => m.status === "flagged");
  const typeScriptFact = inserted[3];
  if (flagged && typeScriptFact) {
    await db.insert(contradictions).values({
      projectId,
      memoryIdA: flagged.id,
      memoryIdB: typeScriptFact.id,
      reasoning:
        "Candidate states a preference for Python over TypeScript, which conflicts with the existing memory noting TypeScript is used for backend work — opposing valence on the same subject.",
    });
  }

  console.log(`Seeded ${inserted.length} memories.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
