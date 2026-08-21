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

      <h2>Retention, deletion and erasure</h2>
      <p>
        Memory data is kept until the customer removes it or closes their account. Deleting a memory
        through the API or the dashboard <strong>archives</strong> it by default: it stops being
        returned by recall, but the row and its evidence remain in the database. That is deliberate —
        the product&apos;s purpose is an audit trail, and the trail has to survive a deletion to be
        worth anything.
      </p>
      <p>
        Archiving is not erasure, so <strong>erasure is a separate operation</strong>.{" "}
        <code>DELETE /api/v1/users/:id?confirm=erase</code> permanently destroys everything held
        about one end user: the memories, the source excerpts they were extracted from, the
        embeddings derived from them, any pending processing and the generated profile. It cannot be
        undone. A single memory can be erased the same way with{" "}
        <code>DELETE /api/v1/memories/:id?confirm=erase</code>.
      </p>
      <p>
        We keep a record that an erasure happened — when, in which project, and how much was
        destroyed — because a customer answering a regulator has to be able to show the request was
        actioned. That record identifies the subject only by a salted hash of their identifier, so it
        proves the erasure without retaining the identifier we were asked to forget.
      </p>
      <p>
        <code>GET /api/v1/users/:id</code> returns everything held about one end user, including
        archived memories and the excerpts behind each one, for answering an access or portability
        request.
      </p>
      <p>
        Request logs and usage records are excluded from erasure. They record an organization, a
        project, an API key and a count — no end-user identifier and no submitted content — and they
        are what an operator needs to answer a disputed invoice or investigate abuse.
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
