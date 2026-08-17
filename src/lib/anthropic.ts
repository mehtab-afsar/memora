import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import { MEMORY_TYPES, type MemoryType } from "@/lib/memory-types";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-5";

async function callTool<T>(system: string, userMessage: string, tool: Tool): Promise<T> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: "user", content: userMessage }],
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
  });

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(`Anthropic did not return a ${tool.name} tool call`);
  }
  return toolUse.input as T;
}

// ---------------------------------------------------------------------------
// Stage 1 — Extraction
// ---------------------------------------------------------------------------

export type MemoryCandidate = {
  content: string;
  type: MemoryType;
  importance: number;
  confidence: number;
  rationale: string;
};

const EXTRACT_SYSTEM_PROMPT = `You extract durable memory candidates about a specific end-user from a piece of text (a conversation turn, a message, a note).

Memory types:
- preference: a like/dislike or stated preference ("prefers concise answers")
- fact: a stable, objective fact about the user ("works at Acme Corp")
- goal: something the user is trying to achieve ("wants to launch a SaaS startup")
- relationship: a connection to another person/org ("manager is Priya")
- event: something that happened at a point in time ("deployed to production on Aug 12")
- instruction: a standing directive for how to behave ("always answer in bullet points")
- decision: a choice that was made ("the team chose PostgreSQL over MongoDB")
- context: background information useful for future interactions that doesn't fit the above

Importance/confidence rubric — this is the most important part of your job:
- Casual, throwaway, or purely reactive remarks ("lol nice", "Ferrari looks cool", "that's funny") are NOT memories. Extract nothing for them.
- A statement is only worth remembering if it plausibly holds true beyond this single exchange, and would materially help a future interaction with this user.
- importance (0-1): how much this would matter to get right in a future interaction. Trivial detail -> low. Core fact/goal/preference -> high.
- confidence (0-1): how certain you are this is actually true and durable, based on how it was stated. An explicit, direct statement ("I use TypeScript") -> high. An inference or hedge ("might be into TypeScript") -> lower.
- A single input may contain zero, one, or multiple candidate memories. Extract each fact/preference/etc. separately rather than combining unrelated statements into one.
- Normalize each candidate's content into a clear third-person statement about the user (e.g. "Prefers concise responses" not "I like it when you're brief").

When in doubt about whether something is durable enough to remember, err toward NOT extracting it — false memories are worse than missed ones.`;

const extractMemoriesTool: Tool = {
  name: "extract_memories",
  description: "Extract zero or more durable memory candidates from the input text.",
  input_schema: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "Normalized, third-person statement of the fact/preference/etc.",
            },
            type: { type: "string", enum: [...MEMORY_TYPES] },
            importance: { type: "number" },
            confidence: { type: "number" },
            rationale: { type: "string" },
          },
          required: ["content", "type", "importance", "confidence", "rationale"],
          additionalProperties: false,
        },
      },
    },
    required: ["candidates"],
    additionalProperties: false,
  },
  strict: true,
};

export async function extractMemories(text: string): Promise<MemoryCandidate[]> {
  const result = await callTool<{ candidates: MemoryCandidate[] }>(
    EXTRACT_SYSTEM_PROMPT,
    text,
    extractMemoriesTool
  );
  return result.candidates;
}

// ---------------------------------------------------------------------------
// Stage 4 — Decision (ADD / UPDATE / MERGE / IGNORE / FLAG)
// ---------------------------------------------------------------------------

export type ExistingMemoryForDecision = {
  id: string;
  content: string;
  type: string;
  confidence: number;
  createdAt: string;
  lastConfirmedAt: string;
  similarity: number;
};

export type MemoryDecision = {
  decision: "ADD" | "UPDATE" | "MERGE" | "IGNORE" | "FLAG";
  target_memory_id: string | null;
  merged_content: string | null;
  contradiction: {
    detected: boolean;
    conflicting_memory_id: string | null;
    reasoning: string | null;
  };
  reasoning: string;
};

const DECIDE_SYSTEM_PROMPT = `You decide how a new candidate memory relates to a user's existing nearby memories, and choose exactly one action:

- ADD: no existing memory is meaningfully similar — this is genuinely new information.
- UPDATE: an existing memory covers the same topic, but the candidate changes the details (e.g. "lives in Austin" -> "lives in Denver"). The old memory should be superseded by a new one. Set target_memory_id to the memory being superseded.
- MERGE: the candidate adds detail to an existing memory without replacing it (e.g. "likes Python" + "especially for data science"). Set target_memory_id and merged_content (the full, combined statement).
- IGNORE: the candidate is a redundant restatement of an existing memory with no new information, OR is itself too trivial to be worth persisting. These are different cases: if it's a redundant restatement of a specific existing memory, set target_memory_id to that memory's id (this counts as a reconfirmation of it). If it's simply too trivial to persist at all, leave target_memory_id null.
- FLAG: the candidate CONTRADICTS an existing memory with opposing valence on the same subject (e.g. "prefers Python" vs "hates Python") and you cannot confidently tell which is current. Set contradiction.detected=true, contradiction.conflicting_memory_id to the conflicting memory's id, and explain the conflict in contradiction.reasoning.

Only ADD, UPDATE, or MERGE should be used when you are NOT flagging a contradiction — contradiction.detected must be false in those cases (except UPDATE, where a value clearly superseding an old one is a normal update, not a contradiction, since it's a change over time rather than two claims that can't both be true right now).

Always explain your reasoning in the top-level "reasoning" field.`;

const decideMemoryActionTool: Tool = {
  name: "decide_memory_action",
  description: "Decide how a candidate memory relates to nearby existing memories.",
  input_schema: {
    type: "object",
    properties: {
      decision: { type: "string", enum: ["ADD", "UPDATE", "MERGE", "IGNORE", "FLAG"] },
      target_memory_id: { type: ["string", "null"] },
      merged_content: { type: ["string", "null"] },
      contradiction: {
        type: "object",
        properties: {
          detected: { type: "boolean" },
          conflicting_memory_id: { type: ["string", "null"] },
          reasoning: { type: ["string", "null"] },
        },
        required: ["detected", "conflicting_memory_id", "reasoning"],
        additionalProperties: false,
      },
      reasoning: { type: "string" },
    },
    required: ["decision", "target_memory_id", "merged_content", "contradiction", "reasoning"],
    additionalProperties: false,
  },
  strict: true,
};

export async function decideMemoryAction(
  candidate: MemoryCandidate,
  nearestExisting: ExistingMemoryForDecision[]
): Promise<MemoryDecision> {
  if (nearestExisting.length === 0) {
    return {
      decision: "ADD",
      target_memory_id: null,
      merged_content: null,
      contradiction: { detected: false, conflicting_memory_id: null, reasoning: null },
      reasoning: "No existing memories for this user — nothing to compare against.",
    };
  }

  const userMessage = `Candidate memory:\n${JSON.stringify(candidate, null, 2)}\n\nNearest existing memories for this user (most similar first):\n${JSON.stringify(nearestExisting, null, 2)}`;

  return callTool<MemoryDecision>(DECIDE_SYSTEM_PROMPT, userMessage, decideMemoryActionTool);
}

// ---------------------------------------------------------------------------
// verify() — re-run confidence assessment for an existing memory
// ---------------------------------------------------------------------------

export type VerifyResult = {
  confidence: number;
  status: "active" | "stale";
  reasoning: string;
};

const verifyMemoryTool: Tool = {
  name: "verify_memory",
  description: "Re-assess a memory's confidence given its evidence trail and current context.",
  input_schema: {
    type: "object",
    properties: {
      confidence: { type: "number" },
      status: { type: "string", enum: ["active", "stale"] },
      reasoning: { type: "string" },
    },
    required: ["confidence", "status", "reasoning"],
    additionalProperties: false,
  },
  strict: true,
};

const VERIFY_SYSTEM_PROMPT = `You re-assess whether a stored memory is still likely to be true and how confident we should be in it, given its content, how long ago it was first observed/last confirmed, and its evidence trail.

Lower confidence and mark status "stale" when: the memory concerns something that commonly changes over time (location, job, current project, opinions), it hasn't been reconfirmed in a long time, or the evidence is thin (a single passing mention).

Keep confidence high and status "active" when: the memory is unlikely to change (durable facts, deeply stated preferences), or it has been reconfirmed recently/repeatedly.`;

export async function verifyMemory(input: {
  content: string;
  type: string;
  currentConfidence: number;
  createdAt: string;
  lastConfirmedAt: string;
  evidenceCount: number;
}): Promise<VerifyResult> {
  return callTool<VerifyResult>(VERIFY_SYSTEM_PROMPT, JSON.stringify(input, null, 2), verifyMemoryTool);
}

// ---------------------------------------------------------------------------
// generateLesson() — Experience Memory: summarize a task attempt into one
// generalizable takeaway when the caller doesn't supply one directly.
// ---------------------------------------------------------------------------

const generateLessonTool: Tool = {
  name: "generate_lesson",
  description: "Summarize a task attempt into one crisp, generalizable lesson.",
  input_schema: {
    type: "object",
    properties: {
      lesson: { type: "string" },
    },
    required: ["lesson"],
    additionalProperties: false,
  },
  strict: true,
};

const GENERATE_LESSON_SYSTEM_PROMPT = `You summarize a single task attempt into one crisp, generalizable lesson — the kind of thing worth remembering before attempting a similar task again.

Focus on the generalizable cause-and-effect, not a restatement of what happened. For a failure with a cause and resolution, the lesson should capture the fix in a way that transfers to future attempts (e.g. "Deployment requires DATABASE_URL to be set" rather than "The deployment failed and was then fixed"). For a success, capture what specifically worked and is worth repeating.

One sentence. No preamble.`;

export async function generateLesson(input: {
  task: string;
  action: string;
  outcome: "success" | "failure";
  cause?: string;
  resolution?: string;
}): Promise<string> {
  const result = await callTool<{ lesson: string }>(
    GENERATE_LESSON_SYSTEM_PROMPT,
    JSON.stringify(input, null, 2),
    generateLessonTool
  );
  return result.lesson;
}

// ---------------------------------------------------------------------------
// synthesizeRecommendation() — Experience Memory: given a new task and the
// most relevant past attempts, recommend what to do — grounded only in the
// retrieved experiences, never called when there are none.
// ---------------------------------------------------------------------------

export type ExperienceForRecommendation = {
  id: string;
  task: string;
  action: string;
  outcome: "success" | "failure";
  cause: string | null;
  resolution: string | null;
  lesson: string;
};

export type Recommendation = {
  recommendation: string;
  confidence: number;
  reasoning: string;
  supporting_experience_ids: string[];
};

const synthesizeRecommendationTool: Tool = {
  name: "synthesize_recommendation",
  description: "Recommend an approach for a new task, grounded in past experience attempts.",
  input_schema: {
    type: "object",
    properties: {
      recommendation: { type: "string" },
      confidence: { type: "number" },
      reasoning: { type: "string" },
      supporting_experience_ids: { type: "array", items: { type: "string" } },
    },
    required: ["recommendation", "confidence", "reasoning", "supporting_experience_ids"],
    additionalProperties: false,
  },
  strict: true,
};

const SYNTHESIZE_RECOMMENDATION_SYSTEM_PROMPT = `You are given a new task and a set of past attempts at similar tasks (each with what was done, whether it succeeded or failed, and — for failures — the cause and resolution if known).

Recommend what to do for the new task, grounded ONLY in the given experiences:
- If a past approach succeeded, recommend repeating it.
- If a past approach failed and no resolution is known, recommend avoiding it and explain why.
- If a past approach failed but a resolution is known, recommend the corrected approach (the original action plus the fix), not the raw failing action.
- If the past experiences are mixed or only weakly related to the new task, say so plainly in the reasoning and lower your confidence rather than forcing a confident-sounding answer.

confidence (0-1) should reflect how directly the past experiences apply — high when a near-identical task has a clear successful outcome, low when the match is loose or the evidence is thin.

supporting_experience_ids must list only the ids of experiences you actually relied on, not all of the ones you were given.`;

export async function synthesizeRecommendation(
  task: string,
  pastExperiences: ExperienceForRecommendation[]
): Promise<Recommendation> {
  const userMessage = `New task:\n${task}\n\nPast experiences:\n${JSON.stringify(pastExperiences, null, 2)}`;
  return callTool<Recommendation>(
    SYNTHESIZE_RECOMMENDATION_SYSTEM_PROMPT,
    userMessage,
    synthesizeRecommendationTool
  );
}
