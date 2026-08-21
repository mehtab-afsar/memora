import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { PLANS, type PlanName } from "@/lib/plans";

/**
 * Billing.
 *
 * Two rules shape everything here.
 *
 * First, **Stripe is the source of truth and the webhook is the only writer**.
 * A checkout redirect is a hint from a browser the customer controls; acting on
 * it means a crafted URL grants a Pro plan. `organizations.plan` is a cached
 * projection of what Stripe told us, and nothing else sets it.
 *
 * Second, **the app runs without Stripe configured**. Everything degrades to a
 * disabled state rather than throwing, so local development and self-hosting
 * need no Stripe account at all — the plan simply stays free and quotas are
 * still enforced.
 */

const secretKey = process.env.STRIPE_SECRET_KEY;

export const billingEnabled = Boolean(secretKey);

const stripe = secretKey
  ? new Stripe(secretKey, {
      // Pinned deliberately: Stripe changes response shapes between versions,
      // and an unpinned integration breaks on their schedule rather than ours.
      apiVersion: "2025-10-29.clover" as Stripe.LatestApiVersion,
      maxNetworkRetries: 3,
    })
  : null;

/**
 * Which Stripe price maps to which plan. Set these from the dashboard after
 * creating the products; a plan without a price id simply cannot be bought.
 */
export const PLAN_PRICE_IDS: Partial<Record<PlanName, string | undefined>> = {
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
};

export function planForPrice(priceId: string): PlanName | null {
  const entry = Object.entries(PLAN_PRICE_IDS).find(([, id]) => id === priceId);
  return (entry?.[0] as PlanName) ?? null;
}

/** Plans a customer can actually buy right now. */
export function purchasablePlans(): { plan: PlanName; priceId: string; label: string }[] {
  return Object.entries(PLAN_PRICE_IDS)
    .filter(([, priceId]) => Boolean(priceId))
    .map(([plan, priceId]) => ({
      plan: plan as PlanName,
      priceId: priceId!,
      label: PLANS[plan as PlanName].label,
    }));
}

function requireStripe(): Stripe {
  if (!stripe) {
    throw new Error(
      "Billing is not configured. Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and the plan price ids."
    );
  }
  return stripe;
}

/**
 * Finds or creates the Stripe customer for an organization. Idempotent: the
 * customer id is stored on first use, so a retried upgrade reuses it rather
 * than creating duplicate customers for the same organization.
 */
async function customerFor(orgId: string, email: string): Promise<string> {
  const client = requireStripe();

  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) throw new Error("Organization not found");
  if (org.stripeCustomerId) return org.stripeCustomerId;

  const customer = await client.customers.create({
    email,
    name: org.name,
    // So a Stripe-side event can always be traced back without a lookup table.
    metadata: { orgId },
  });

  await db
    .update(organizations)
    .set({ stripeCustomerId: customer.id })
    .where(eq(organizations.id, orgId));

  return customer.id;
}

export async function createCheckoutSession(params: {
  orgId: string;
  email: string;
  priceId: string;
  returnUrl: string;
}): Promise<string> {
  const client = requireStripe();
  const customerId = await customerFor(params.orgId, params.email);

  const session = await client.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: `${params.returnUrl}?checkout=success`,
    cancel_url: `${params.returnUrl}?checkout=cancelled`,
    // Carried through to the subscription so the webhook can attribute an
    // event even if the customer record were somehow ambiguous.
    subscription_data: { metadata: { orgId: params.orgId } },
    allow_promotion_codes: true,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return session.url;
}

/**
 * Stripe's hosted billing portal: card updates, invoices, cancellation. Worth
 * using rather than building — every one of those flows has edge cases we would
 * otherwise own, and none of them differentiate the product.
 */
export async function createPortalSession(orgId: string, returnUrl: string): Promise<string> {
  const client = requireStripe();

  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org?.stripeCustomerId) throw new Error("This organization has no billing account yet");

  const session = await client.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: returnUrl,
  });
  return session.url;
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/**
 * Which subscription states still entitle a customer to their plan.
 *
 * `past_due` deliberately does: a failed renewal starts a dunning period, and
 * cutting off a paying customer's API the moment a card expires is a good way
 * to lose them over a problem Stripe usually resolves itself within days.
 * `unpaid` and `canceled` are where entitlement actually ends.
 */
const ENTITLED_STATUSES = new Set(["active", "trialing", "past_due"]);

export function verifyWebhook(payload: string, signature: string): Stripe.Event {
  const client = requireStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

  // Throws on a bad signature, which is the point: without this check anyone
  // who finds the endpoint can grant themselves any plan.
  return client.webhooks.constructEvent(payload, signature, secret);
}

/**
 * Applies a subscription's current state to the organization it belongs to.
 * Called for every subscription lifecycle event — created, updated, deleted —
 * because they all reduce to the same question: what plan is this org on now?
 */
export async function syncSubscription(subscription: Stripe.Subscription): Promise<PlanName> {
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

  const priceId = subscription.items.data[0]?.price.id;
  const mapped = priceId ? planForPrice(priceId) : null;
  const entitled = ENTITLED_STATUSES.has(subscription.status);

  // An unrecognised price is not a reason to downgrade someone who is paying —
  // it means our price ids are out of date, which is our problem, not theirs.
  const plan: PlanName = entitled ? mapped ?? "starter" : "free";

  const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;

  await db
    .update(organizations)
    .set({
      plan,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    })
    .where(eq(organizations.stripeCustomerId, customerId));

  return plan;
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<string> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const plan = await syncSubscription(event.data.object as Stripe.Subscription);
      return `subscription ${event.type.split(".").pop()} -> plan ${plan}`;
    }

    case "checkout.session.completed": {
      // The subscription events do the actual work; this only matters when the
      // subscription was created before we saw the session.
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.subscription) return "checkout completed, no subscription";
      const client = requireStripe();
      const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
      const plan = await syncSubscription(await client.subscriptions.retrieve(id));
      return `checkout completed -> plan ${plan}`;
    }

    case "invoice.payment_failed":
      // Deliberately not a downgrade. Stripe moves the subscription to
      // past_due and retries; the subscription.updated event carries the state
      // change, and this is here so the event is logged rather than ignored.
      return "payment failed — dunning started, plan unchanged";

    default:
      return `ignored ${event.type}`;
  }
}
