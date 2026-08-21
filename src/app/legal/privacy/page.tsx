import Link from "next/link";

export const metadata = { title: "Privacy Policy — Memora" };

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>
        <strong>[LEGAL ENTITY NAME]</strong> (&ldquo;we&rdquo;) operates Memora. Last updated [DATE].
      </p>

      <h2>Two very different kinds of data</h2>
      <p>
        This distinction runs through everything below. <strong>Account data</strong> is about the
        person who signs up: an email address, a password hash, an organisation name. We are the
        controller of it. <strong>Memory data</strong> is what a customer&apos;s application sends
        us about <em>its own</em> end users. We are only a processor of that — the customer decides
        what to send, why, and for how long we keep it.
      </p>

      <h2>What we store</h2>
      <p>
        <strong>Account data:</strong> email address, a hashed password (never the password itself),
        organisation and project names, and hashed API keys. Keys are stored as SHA-256 hashes, so
        we cannot recover one after it is shown to you once.
      </p>
      <p>
        <strong>Memory data:</strong> the text submitted to <code>remember()</code>, the memories
        derived from it, a numeric embedding of each, an excerpt of the source text kept as evidence,
        and whatever identifier the customer chose for their end user. That identifier is opaque to
        us — customers are advised to use an internal id rather than an email address.
      </p>
      <p>
        <strong>Operational data:</strong> a record of every API request and every model call, for
        quota enforcement and billing.
      </p>

      <h2>Who else processes it</h2>
      <p>
        Text submitted to Memora is sent to Anthropic and Voyage AI to be processed, and stored on
        Supabase infrastructure in Singapore. The full list, with what each receives and why, is on
        the <Link href="/legal/sub-processors">sub-processors</Link> page.
      </p>

      <h2>Retention, and an honest limitation</h2>
      <p>
        Memory data is kept until the customer removes it or closes their account. Deleting a memory
        through the API or the dashboard currently <strong>archives</strong> it: it stops being
        returned by recall, but the row and its evidence remain in the database. That is deliberate —
        the product&apos;s purpose is an audit trail, and the trail has to survive a deletion to be
        worth anything.
      </p>
      <p>
        <strong>It is also not erasure.</strong> A customer responding to a GDPR Article 17 request
        from one of their end users needs the data actually gone, and archiving does not achieve
        that. A hard-delete path is required before we can honestly offer that guarantee. [This gap
        must be closed before onboarding any customer subject to GDPR.]
      </p>

      <h2>Security</h2>
      <p>
        API keys are hashed at rest and scoped to a single environment, so a development key cannot
        read production data. Passwords are hashed with scrypt. Traffic is served over TLS. Database
        access is restricted to the application.
      </p>
      <p>[Encryption at rest, access control policy, incident response and breach notification
      timelines to be documented and committed to here.]</p>

      <h2>Your rights</h2>
      <p>
        If you have an account with us, you can request access to, correction of, or deletion of your
        account data at [CONTACT EMAIL]. If you are an end user of a product built on Memora, we hold
        your data on that company&apos;s behalf and cannot act on it directly — please contact them.
      </p>

      <h2>Placeholders that must be resolved</h2>
      <p>
        [Legal entity and registered address. Governing law. Whether a Data Protection Officer or EU
        or UK representative is required. Standard Contractual Clauses for transfers outside the EEA
        and UK. Cookie disclosure, if analytics are ever added — there are none today.]
      </p>
    </>
  );
}
