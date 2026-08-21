# Data-subject rights

Memora holds text about people who never signed up for it — the end users of
whatever product a customer built. When one of them asks their provider "what do
you have on me?" or "delete it", the provider has to be able to act, and the
answer cannot be "we archived it".

Two operations exist for that, both scoped to a single project environment by
the API key used.

## Export — what do you hold about me?

```http
GET /api/v1/users/:end_user_id
Authorization: Bearer <read key>
```

Returns every memory held about that end user — including **archived and
superseded** ones, because "we still hold it but stopped using it" is still
holding it — each with the source excerpts it was extracted from, plus the
generated profile if there is one.

```ts
const data = await memora.exportUser("user-42");
```

## Erasure — delete it, actually

```http
DELETE /api/v1/users/:end_user_id?confirm=erase
Authorization: Bearer <write key>
```

```ts
const { memoriesErased, subjectHash } = await memora.eraseUser("user-42");
```

This destroys the rows. Not reversible, and there is no undo:

| Removed | How |
|---|---|
| `memories` | deleted directly |
| `memory_evidence` | cascade — the excerpts, in the subject's own words |
| the embeddings | they live on the memory row |
| `reconciliation_jobs` | cascade |
| `contradictions` | cascade, either side |
| `user_profiles` | deleted directly — no foreign key, so it needs its own delete |

The embedding mattering is not obvious. An embedding is derived from the content
and, with effort, partially invertible; one left behind is personal data left
behind. It lives on the memory row, so it goes with it — but any future cache or
copy of an embedding has to be included here too.

A single memory can be erased the same way:

```http
DELETE /api/v1/memories/:id?confirm=erase
```

Without `?confirm=erase`, both `DELETE`s archive instead. That is the ordinary,
reversible operation, and it stays the default because the audit trail is the
product.

## What is deliberately not erased

`api_requests`, `usage_events`, `rate_limit_windows` and `idempotency_keys`.
None of them store an end-user identifier or any submitted content — they hold
an org, a project, a key id and a count. They are billing and abuse records.
Erasing them would be erasing our own records rather than the subject's data.

## The erasure log

Every erasure writes a row to `erasure_records`: project, environment, counts,
timestamp, and a **hash of the subject** rather than their id.

An operator has to be able to demonstrate a request was actioned — but writing
the end-user id into that log would retain, forever, exactly the identifier we
were asked to forget. The hash is over `project:environment:end_user_id`
(length-prefixed, so two different subjects cannot produce the same input), so
someone holding the id can recompute it and show the erasure happened, while the
log on its own names nobody, and a hash from one project reveals nothing about
another.

The API returns the same hash so the caller can keep their own proof.

## Verifying it

```bash
pnpm smoke:erasure
```

Seeds a subject and a bystander in a real database, erases the subject, and
checks that nothing of theirs remains in any table, that the bystander is
untouched, that the log identifies the subject without naming them, and that
erasing twice is a no-op. The claim erasure makes is a property of the schema's
foreign keys, so it is checked against Postgres rather than a mock.

## Still open

- **No dashboard UI.** Both operations are API-only. A support person handling a
  request has to call the API or ask an engineer.
- **Backups.** Erasure removes the row from the live database. Whatever the
  hosting provider retains in point-in-time backups still contains it until
  those backups age out, and the retention window needs stating in the privacy
  policy.
- **Provider-side retention.** Anthropic and Voyage receive the text at
  extraction time. Their retention is theirs, covered by their terms, and
  erasing here does not reach it.
