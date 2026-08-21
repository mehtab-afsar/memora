# Billing

Everything except the Stripe account is built. The app runs fine without it —
quotas and rate limits are enforced regardless; what is missing is the ability
to *buy* a higher plan.

## About reusing the aibra.ai account

Stripe separates two things that are easy to confuse:

- **A login** can own many accounts, and you switch between them in the
  dashboard.
- **An account** is a business: its own bank details, tax settings, payouts,
  invoices and customers.

So: **same login, new account** for Memora — not the aibra.ai account itself.
Use the account switcher, "Create new account", name it Memora.

The reason is that products in one Stripe account share customers, invoice
numbering, payout schedule and tax registrations. Selling two unrelated products
from one account means aibra.ai invoices and Memora invoices interleave in the
same sequence, revenue reporting has to be filtered by product forever, and if
the two ever end up in different legal entities — a separate company, an
acquisition, an investor asking for clean Memora-only numbers — untangling them
is genuinely painful. Separating on day one costs one click.

The one case for the same account: if Memora is a product line of the same legal
entity, invoicing the same customers, and always will be.

## Setup

### 1. Create the products

Stripe dashboard → **Product catalogue** → add a product per paid plan. The
numbers must match `src/lib/plans.ts`, which is where the enforced limits live.

| Product | Price | Recurring |
|---|---|---|
| Memora Starter | to be decided | monthly |
| Memora Pro | to be decided | monthly |

Pricing is not set yet. The one hard number we have: the pipeline costs about
**$9.87 in model spend per 1,000 memories**, so whatever a plan charges has to
sit above its write quota multiplied by that, with room.

Copy each **price** id — `price_...`, not the product id.

### 2. Keys

Developers → API keys → secret key (`sk_test_...` while testing).

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
```

### 3. Webhook

This is the part that actually matters — see "Why the webhook is the only
writer" below.

**Local:**

```bash
stripe listen --forward-to localhost:3001/api/stripe/webhook
# prints whsec_... — put it in .env.local as STRIPE_WEBHOOK_SECRET
```

**Production:** Developers → Webhooks → add endpoint
`https://<your-domain>/api/stripe/webhook`, subscribing to:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `checkout.session.completed`
- `invoice.payment_failed`

### 4. Test it

```bash
stripe trigger customer.subscription.created
```

Then upgrade from **Billing** in the dashboard using Stripe's test card
`4242 4242 4242 4242`, any future expiry, any CVC. The organization's plan
should change, and the quota bars should move to the new limits.

Test the unhappy paths too — they are where billing bugs live:

```bash
stripe trigger invoice.payment_failed          # plan must NOT drop
stripe trigger customer.subscription.deleted   # plan must drop to free
```

## Why the webhook is the only writer

`organizations.plan` is a cached projection of what Stripe told us. Nothing else
sets it — in particular not the checkout success redirect.

That redirect is a URL in a browser the customer controls. A checkout flow that
grants a plan on redirect can be granted to yourself by typing the URL. It also
fails in the honest direction: customers close the tab after paying, and their
upgrade must still apply.

## Deliberate decisions worth knowing

**`past_due` keeps the plan.** A failed renewal starts Stripe's dunning period
and it retries over several days. Cutting off a paying customer's production API
the moment a card expires is a good way to lose them over something Stripe
usually fixes by itself. Entitlement ends at `unpaid` or `canceled`.

**An unrecognised price does not downgrade anyone.** If a subscription arrives on
a price id we do not know, the customer keeps a paid plan. An out-of-date price
map is our problem; silently demoting someone who is paying is worse than
briefly over-serving them.

**Webhook failures return 500 on purpose**, so Stripe retries with backoff. The
alternative is quietly losing an upgrade somebody has already paid for.

**Stripe's billing portal handles card updates, invoices and cancellation.**
Every one of those flows has edge cases we would otherwise own, and none of them
differentiate the product.

## What is still missing

- **Prices.** Nothing can be bought until they are set.
- **Overage.** Today hitting a quota returns `402` and the customer must
  upgrade. Metered overage billing is possible — `api_requests` already records
  every billable call — but it is a pricing decision first.
- **Tax.** Stripe Tax needs enabling and registrations adding per jurisdiction.
- **Dunning emails.** Stripe can send them; nobody has turned them on or written
  them.
- **Annual plans, and Enterprise.** Enterprise has no price id because it should
  be a conversation, not a checkout.
