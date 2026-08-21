import { handleWebhookEvent, verifyWebhook, billingEnabled } from "@/lib/billing";

/**
 * Stripe's webhook. This is the only thing that changes an organization's plan.
 *
 * The signature check is not optional decoration: without it, anyone who finds
 * this URL can post a fabricated subscription event and grant themselves any
 * plan they like. The raw body is required — parsing and re-serialising the
 * JSON changes the bytes and the signature no longer verifies.
 */
export async function POST(request: Request) {
  if (!billingEnabled) {
    return Response.json({ error: "Billing is not configured" }, { status: 501 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const payload = await request.text();

  let event;
  try {
    event = verifyWebhook(payload, signature);
  } catch (error) {
    // A bad signature is either a misconfigured secret or someone probing.
    // Either way it is a 400, and it must never reach the handler.
    console.error("[stripe] signature verification failed", error);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const outcome = await handleWebhookEvent(event);
    console.log(`[stripe] ${event.id} ${outcome}`);
    return Response.json({ received: true });
  } catch (error) {
    // A 500 makes Stripe retry with backoff, which is what we want for a
    // transient database failure — the alternative is silently losing an
    // upgrade a customer has already paid for.
    console.error(`[stripe] failed handling ${event.type}`, error);
    return Response.json({ error: "Handler failed" }, { status: 500 });
  }
}
