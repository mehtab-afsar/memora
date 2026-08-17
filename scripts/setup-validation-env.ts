import { createEnvironment } from "@/lib/org";

const projectId = "31626b33-8a91-4f16-a926-a66f413763ce";

async function main() {
  const environment = await createEnvironment(projectId, "validation");
  console.log("Created validation environment:", environment.id);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
