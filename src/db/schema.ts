import {
  customType,
  pgTable,
  uuid,
  text,
  timestamp,
  real,
  integer,
  jsonb,
  pgEnum,
  vector,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Dashboard identity (humans logging into the web UI)
// ---------------------------------------------------------------------------

export const planEnum = pgEnum("plan", ["free", "starter", "pro", "enterprise"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // Limits live in src/lib/plans.ts; this is the only thing persisted, so a
  // plan's numbers can change without a migration.
  plan: planEnum("plan").notNull().default("free"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("users_email_idx").on(table.email),
]);

export const membershipRoleEnum = pgEnum("membership_role", ["owner"]);

export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: membershipRoleEnum("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("memberships_org_user_idx").on(table.orgId, table.userId),
]);

// Auth.js Credentials provider only supports JWT sessions (a documented
// Auth.js limitation), so no adapter/session/account tables are needed here
// — auth state lives entirely in a signed JWT cookie, `users` is queried
// directly from the Credentials `authorize()` callback.

// ---------------------------------------------------------------------------
// Org -> Project -> Environment -> API key
// ---------------------------------------------------------------------------

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const environments = pgTable("environments", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // e.g. 'development' | 'production'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const apiKeyScopeEnum = pgEnum("api_key_scope", ["read", "write"]);

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  environmentId: uuid("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // A key that only ever reads should not be able to write. Existing keys keep
  // both scopes so nothing breaks on migration.
  scopes: apiKeyScopeEnum("scopes").array().notNull().default(["read", "write"]),
  keyPrefix: text("key_prefix").notNull(), // shown in UI, e.g. 'sk_live_ab12'
  keyHash: text("key_hash").notNull(), // sha256(full key)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("api_keys_key_hash_idx").on(table.keyHash),
]);

// ---------------------------------------------------------------------------
// Memory Intelligence Engine
// ---------------------------------------------------------------------------

export const memoryTypeEnum = pgEnum("memory_type", [
  "preference",
  "fact",
  "goal",
  "relationship",
  "event",
  "instruction",
  "decision",
  "context",
]);

export const memoryStatusEnum = pgEnum("memory_status", [
  "active",
  "stale",
  "superseded",
  "archived",
  "flagged",
]);

export const evidenceEventTypeEnum = pgEnum("evidence_event_type", [
  "extracted",
  "reconfirmed",
  "updated",
  "verified",
]);

export const contradictionStatusEnum = pgEnum("contradiction_status", ["detected", "resolved"]);
export const contradictionResolutionEnum = pgEnum("contradiction_resolution", [
  "kept_a",
  "kept_b",
  "merged",
  "ignored",
]);

/**
 * Postgres full-text search vector. Embeddings miss exact strings — cluster
 * names, ticket ids, channel handles — which is precisely where a keyword index
 * earns its place, so recall() fuses the two rankings.
 */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => "tsvector",
});

// Voyage voyage-3 embeddings are 1024-dimensional.
export const EMBEDDING_DIMENSIONS = 1024;

export const memories = pgTable("memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
  endUserId: text("end_user_id").notNull(), // opaque id from the calling application, not a users.id fk
  // Optional narrower scopes, both opaque ids from the caller. A product with
  // several agents needs to know which of them learned a fact, and a
  // session-scoped memory is one that should not outlive its conversation.
  agentId: text("agent_id"),
  sessionId: text("session_id"),
  content: text("content").notNull(),
  type: memoryTypeEnum("type").notNull(),
  confidence: real("confidence").notNull(),
  importance: real("importance").notNull(),
  status: memoryStatusEnum("status").notNull().default("active"),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id"),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  supersedesId: uuid("supersedes_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true }).notNull().defaultNow(),
  // Null until the reconciliation pass has judged this row against its
  // neighbours. Writes are append-only, so a memory is readable before it has
  // been judged — see src/lib/reconcile.ts.
  reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
  contentTsv: tsvector("content_tsv").generatedAlwaysAs(sql`to_tsvector('english', content)`),
}, (table) => [
  index("memories_scope_idx").on(table.projectId, table.environmentId, table.endUserId, table.status),
  index("memories_agent_idx").on(table.projectId, table.environmentId, table.agentId),
  index("memories_session_idx").on(table.projectId, table.environmentId, table.sessionId),
  index("memories_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  index("memories_content_tsv_idx").using("gin", table.contentTsv),
]);

export const memoryEvidence = pgTable("memory_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  memoryId: uuid("memory_id").notNull().references(() => memories.id, { onDelete: "cascade" }),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id"),
  excerpt: text("excerpt").notNull(),
  eventType: evidenceEventTypeEnum("event_type").notNull(),
  // Claude's stated reasoning for an update/merge decision — why this version replaced the last.
  reasoning: text("reasoning"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("memory_evidence_memory_id_idx").on(table.memoryId),
]);

// ---------------------------------------------------------------------------
// Reconciliation queue — one job per appended memory. A durable table rather
// than an in-process queue: the version chain, the evidence and the
// contradiction flags are the product, so a dropped job is a missing
// explanation, not just a skipped optimisation.
// ---------------------------------------------------------------------------

export const reconciliationStatusEnum = pgEnum("reconciliation_status", [
  "pending",
  "running",
  "done",
  "failed",
]);

export const reconciliationJobs = pgTable("reconciliation_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  memoryId: uuid("memory_id").notNull().references(() => memories.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
  endUserId: text("end_user_id").notNull(),
  status: reconciliationStatusEnum("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
}, (table) => [
  index("reconciliation_jobs_claim_idx").on(table.status, table.createdAt),
  index("reconciliation_jobs_scope_idx").on(table.projectId, table.environmentId, table.endUserId, table.status),
]);

export const contradictions = pgTable("contradictions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  memoryIdA: uuid("memory_id_a").notNull().references(() => memories.id, { onDelete: "cascade" }),
  memoryIdB: uuid("memory_id_b").notNull().references(() => memories.id, { onDelete: "cascade" }),
  status: contradictionStatusEnum("status").notNull().default("detected"),
  resolution: contradictionResolutionEnum("resolution"),
  reasoning: text("reasoning").notNull(),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
}, (table) => [
  index("contradictions_project_id_idx").on(table.projectId),
]);

// ---------------------------------------------------------------------------
// Experience Memory — append-only log of task attempts and outcomes.
// Deliberately not modeled like `memories`: no dedup decision engine, no
// status lifecycle, no versioning, no evidence table. Two attempts at the
// same task are two valid rows, not a conflict. Scoped by project+environment
// only (no end_user_id) — this is what the *agent* learned doing a task, not
// a fact about a specific end-user.
// ---------------------------------------------------------------------------

export const experienceOutcomeEnum = pgEnum("experience_outcome", ["success", "failure"]);

export const experiences = pgTable("experiences", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
  task: text("task").notNull(),
  action: text("action").notNull(),
  context: text("context"),
  outcome: experienceOutcomeEnum("outcome").notNull(),
  cause: text("cause"),
  resolution: text("resolution"),
  lesson: text("lesson").notNull(),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("experiences_scope_idx").on(table.projectId, table.environmentId),
  index("experiences_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
]);

// ---------------------------------------------------------------------------
// Request guards — rate limiting and idempotency.
//
// Both live in Postgres rather than Redis: there is already exactly one
// database, adding a second stateful dependency to enforce limits is a poor
// trade, and at these volumes a row lock is cheaper than an extra network hop.
// ---------------------------------------------------------------------------

export const rateLimitWindows = pgTable("rate_limit_windows", {
  apiKeyId: uuid("api_key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
  // Start of the fixed window this count belongs to.
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
}, (table) => [
  uniqueIndex("rate_limit_windows_key_window_idx").on(table.apiKeyId, table.windowStart),
]);

/**
 * One row per billable API call. Quota is counted from this rather than derived
 * from memories, because a write that extracted nothing still spent a model
 * call — and because a request log is what anyone debugging a bill asks for.
 */
export const apiRequestKindEnum = pgEnum("api_request_kind", ["writes", "reads"]);

export const apiRequests = pgTable("api_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  kind: apiRequestKindEnum("kind").notNull(),
  route: text("route").notNull(),
  statusCode: integer("status_code").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("api_requests_quota_idx").on(table.orgId, table.kind, table.createdAt),
  index("api_requests_key_idx").on(table.apiKeyId, table.createdAt),
]);

export const idempotencyKeys = pgTable("idempotency_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  apiKeyId: uuid("api_key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  // Hash of method + path + body. A replay with the same key but a different
  // body is a client bug, and is rejected rather than served a stale response.
  requestHash: text("request_hash").notNull(),
  statusCode: integer("status_code").notNull(),
  responseBody: text("response_body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idempotency_keys_scope_idx").on(table.apiKeyId, table.key),
  index("idempotency_keys_created_idx").on(table.createdAt),
]);

// ---------------------------------------------------------------------------
// Usage metering — every Claude/Voyage call, logged before any billing exists,
// so tier/pricing decisions later come from real consumption, not guesses.
// ---------------------------------------------------------------------------

export const usageSourceEnum = pgEnum("usage_source", ["api", "dashboard"]);
export const usageProviderEnum = pgEnum("usage_provider", ["anthropic", "voyage"]);

export const usageEvents = pgTable("usage_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id").notNull().references(() => environments.id, { onDelete: "cascade" }),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  source: usageSourceEnum("source").notNull(),
  provider: usageProviderEnum("provider").notNull(),
  operation: text("operation").notNull(), // Claude tool name, or 'document'/'query' for Voyage
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  totalTokens: integer("total_tokens"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("usage_events_project_created_idx").on(table.projectId, table.createdAt),
  index("usage_events_api_key_idx").on(table.apiKeyId),
]);

// ---------------------------------------------------------------------------
// Relations (for query ergonomics)
// ---------------------------------------------------------------------------

export const organizationsRelations = relations(organizations, ({ many }) => ({
  memberships: many(memberships),
  projects: many(projects),
}));

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(memberships),
}));

export const membershipsRelations = relations(memberships, ({ one }) => ({
  org: one(organizations, { fields: [memberships.orgId], references: [organizations.id] }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  org: one(organizations, { fields: [projects.orgId], references: [organizations.id] }),
  environments: many(environments),
  memories: many(memories),
}));

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  project: one(projects, { fields: [environments.projectId], references: [projects.id] }),
  apiKeys: many(apiKeys),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  environment: one(environments, { fields: [apiKeys.environmentId], references: [environments.id] }),
}));

export const memoriesRelations = relations(memories, ({ one, many }) => ({
  project: one(projects, { fields: [memories.projectId], references: [projects.id] }),
  environment: one(environments, { fields: [memories.environmentId], references: [environments.id] }),
  evidence: many(memoryEvidence),
}));

export const reconciliationJobsRelations = relations(reconciliationJobs, ({ one }) => ({
  memory: one(memories, { fields: [reconciliationJobs.memoryId], references: [memories.id] }),
}));

export const memoryEvidenceRelations = relations(memoryEvidence, ({ one }) => ({
  memory: one(memories, { fields: [memoryEvidence.memoryId], references: [memories.id] }),
}));
