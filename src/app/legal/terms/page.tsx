import Link from "next/link";

export const metadata = { title: "Terms of Service — Memora" };

export default function TermsPage() {
  return (
    <>
      <h1>Terms of Service</h1>
      <p>
        An agreement between <strong>[LEGAL ENTITY NAME]</strong> (&ldquo;we&rdquo;) and the
        organisation using Memora (&ldquo;you&rdquo;). Last updated [DATE].
      </p>

      <h2>The service</h2>
      <p>
        Memora stores and retrieves memories derived from text you submit. You keep an account,
        create API keys, and call the API. We may change the service, and will give reasonable notice
        before removing something you depend on.
      </p>

      <h2>Your data stays yours</h2>
      <p>
        You own everything you submit and everything derived from it. We store and process it to
        provide the service, and for nothing else. We do not sell it, and we do not use it to train
        our own models. Text is sent to the AI providers listed as{" "}
        <Link href="/legal/sub-processors">sub-processors</Link> in order to process it.
      </p>

      <h2>What you are responsible for</h2>
      <p>
        You are responsible for having the right to send us the data you send, including consent from
        your own users where the law requires it. You must not use the service to store data you are
        not permitted to store, and you must not attempt to access another customer&apos;s data.
      </p>
      <p>
        [Whether the service may be used for special-category data — health, biometric, and so on —
        needs an explicit answer. The current architecture does not prohibit it, and the honest
        default until the compliance work is done is to say no.]
      </p>

      <h2>Plans, quotas and payment</h2>
      <p>
        Each plan carries a monthly write and read allowance and a per-minute rate limit. Exceeding a
        rate limit returns <code>429</code>; exhausting a monthly quota returns <code>402</code> until
        the next period or an upgrade. Subscriptions renew monthly until cancelled. Cancelling stops
        the next renewal; it does not refund the current period.
      </p>
      <p>[Pricing, refund policy, and tax treatment to be set.]</p>

      <h2>Availability</h2>
      <p>
        No uptime commitment is offered today, and none should be implied. [An SLA, with credits, is
        a prerequisite for enterprise customers and cannot honestly be offered before backups have
        been tested and monitoring exists.]
      </p>

      <h2>Ending the agreement</h2>
      <p>
        You may close your account at any time. We may suspend an account for non-payment or for use
        that breaches these terms, with notice where circumstances allow. On termination you may
        export your data for [PERIOD], after which it is deleted.
      </p>

      <h2>Liability</h2>
      <p>
        [To be drafted by a lawyer. The customary shape — service provided as is, liability capped at
        fees paid in the preceding twelve months, no liability for indirect or consequential loss —
        is jurisdiction-dependent and unenforceable if written carelessly. This section is a
        placeholder, not a draft.]
      </p>

      <h2>Governing law</h2>
      <p>[JURISDICTION. Follows from where the entity is incorporated.]</p>

      <h2>Contact</h2>
      <p>[CONTACT EMAIL]</p>
    </>
  );
}
