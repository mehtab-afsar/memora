export const metadata = { title: "Sub-processors — Memora" };

/**
 * The one legal page whose content is entirely determined by the code rather
 * than by a lawyer: who else touches customer data, and why.
 *
 * Derived from src/lib/anthropic.ts, src/lib/voyage.ts and the deployment
 * target. If a provider is added or swapped, this list changes in the same
 * commit — a stale sub-processor list is a contractual problem, not a docs one.
 */
export default function SubProcessorsPage() {
  const processors = [
    {
      name: "Anthropic",
      purpose:
        "Extracts memories from submitted text, judges them against existing memories, and writes profile summaries.",
      data: "The text you submit, and the memories derived from it.",
      region: "United States",
      note: "API inputs and outputs are not used to train their models.",
    },
    {
      name: "Voyage AI",
      purpose: "Turns memories and search queries into embeddings, which is what makes semantic recall possible.",
      data: "Memory text and query text.",
      region: "United States",
      note: null,
    },
    {
      name: "Supabase (on Amazon Web Services)",
      purpose: "Hosts the PostgreSQL database where all memories, evidence and account records are stored.",
      data: "Everything the service stores.",
      region: "Asia Pacific (Singapore), ap-southeast-1",
      note: "Data at rest stays in this region.",
    },
  ];

  return (
    <>
      <h1>Sub-processors</h1>
      <p>
        Third parties that process customer data on our behalf. We will give notice before adding to
        this list. Last updated [DATE].
      </p>

      {processors.map((p) => (
        <div key={p.name} className="rounded-lg border border-border p-4">
          <h2 className="!mt-0">{p.name}</h2>
          <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-xs uppercase tracking-wider">Purpose</dt>
            <dd>{p.purpose}</dd>
            <dt className="text-xs uppercase tracking-wider">Data</dt>
            <dd>{p.data}</dd>
            <dt className="text-xs uppercase tracking-wider">Region</dt>
            <dd>{p.region}</dd>
            {p.note && (
              <>
                <dt className="text-xs uppercase tracking-wider">Note</dt>
                <dd>{p.note}</dd>
              </>
            )}
          </dl>
        </div>
      ))}

      <h2>What this means in practice</h2>
      <p>
        Text you send to <code>remember()</code> is transmitted to Anthropic and Voyage AI to be
        processed. If your users&apos; messages contain personal data, that personal data leaves our
        infrastructure and reaches theirs. Anyone who cannot accept that should not send that data —
        redaction before submission is the customer&apos;s control, and we do not currently perform
        it on your behalf.
      </p>

      <h2>Still to confirm</h2>
      <p>
        [Whether the entity signs a DPA with each of the above, and whether Standard Contractual
        Clauses are needed for transfers out of the EEA and UK. These are questions for a lawyer, not
        a description of the software.]
      </p>
    </>
  );
}
