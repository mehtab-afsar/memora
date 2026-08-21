import { z } from "zod";
import { memoryTypeEnum } from "@/db/schema";

/**
 * Request contracts for every `/api/v1` route, kept in one place so they can be
 * tested without booting Next, and so the SDK and docs can be generated from
 * the same source as the runtime validation.
 */

const sourceSchema = z.object({ type: z.string().min(1), id: z.string().optional() }).optional();

export const rememberBodySchema = z.object({
  user_id: z.string().min(1),
  content: z.string().min(1),
  /** Which agent learned this, when a product runs more than one. */
  agent_id: z.string().min(1).optional(),
  /** The conversation or run this came from. */
  session_id: z.string().min(1).optional(),
  source: sourceSchema,
});

/** ISO-8601 timestamp, accepted as a string and handed to the engine as a Date. */
const isoDate = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Expected an ISO-8601 timestamp" })
  .transform((value) => new Date(value));

export const recallBodySchema = z.object({
  user_id: z.string().min(1),
  query: z.string().min(1),
  top_k: z.number().int().min(1).max(50).optional(),
  /** Restrict to particular memory types, e.g. ["preference", "instruction"]. */
  type: z.array(z.enum(memoryTypeEnum.enumValues)).min(1).optional(),
  /** Drop anything the system is less sure of than this. */
  min_confidence: z.number().min(0).max(1).optional(),
  /** Only memories first observed within this window. */
  since: isoDate.optional(),
  until: isoDate.optional(),
  /** Narrow to one agent's or one session's memories. */
  agent_id: z.string().min(1).optional(),
  session_id: z.string().min(1).optional(),
});

export const memoryPatchSchema = z.object({
  content: z.string().min(1).optional(),
  confidence: z.number().min(0).max(1).optional(),
  importance: z.number().min(0).max(1).optional(),
});

export const recordExperienceBodySchema = z.object({
  task: z.string().min(1),
  action: z.string().min(1),
  context: z.string().optional(),
  outcome: z.enum(["success", "failure"]),
  cause: z.string().optional(),
  resolution: z.string().optional(),
  lesson: z.string().optional(),
  source: sourceSchema,
});

export const recallExperiencesBodySchema = z.object({
  query: z.string().min(1),
  top_k: z.number().int().min(1).max(50).optional(),
});

export const recommendBodySchema = z.object({
  task: z.string().min(1),
});

export type RememberBody = z.infer<typeof rememberBodySchema>;
export type RecallBody = z.infer<typeof recallBodySchema>;
export type MemoryPatchBody = z.infer<typeof memoryPatchSchema>;
export type RecordExperienceBody = z.infer<typeof recordExperienceBodySchema>;
export type RecallExperiencesBody = z.infer<typeof recallExperiencesBodySchema>;
export type RecommendBody = z.infer<typeof recommendBodySchema>;

/** The 400 response body every route returns for a schema failure. */
export function badRequest(error: z.ZodError): Response {
  return Response.json({ error: error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
}
