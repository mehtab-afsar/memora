import Anthropic from "@anthropic-ai/sdk";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";
import type { EvalQuestion } from "./dataset";

/**
 * The two model calls the harness makes on top of the pipeline under test:
 *
 * - `answerFromMemories` stands in for the customer's application — it may use
 *   only what recall() returned, so a miss in retrieval shows up as a wrong
 *   answer rather than being covered by the model's own knowledge.
 * - `grade` marks that answer against the gold answer.
 *
 * Neither is billed to the tenant's usage_events; this spend is the harness's,
 * and it is reported separately from pipeline cost.
 */

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type JudgeUsage = { inputTokens: number; outputTokens: number };

const usage: JudgeUsage = { inputTokens: 0, outputTokens: 0 };

export function judgeUsage(): JudgeUsage {
  return { ...usage };
}

async function callTool<T>(model: string, system: string, userMessage: string, tool: Tool): Promise<T> {
  const response = await client.messages.create({
    model,
    // Adaptive thinking is on by default on current models, and it shares this
    // budget: at 1024 a grade came back truncated and empty, which the harness
    // then scored as a wrong answer. Give it room.
    max_tokens: 8192,
    system,
    messages: [{ role: "user", content: userMessage }],
    tools: [tool],
    tool_choice: { type: "tool", name: tool.name },
  });

  usage.inputTokens += response.usage.input_tokens;
  usage.outputTokens += response.usage.output_tokens;

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error(
      `Judge model did not return a ${tool.name} tool call (stop_reason: ${response.stop_reason})`
    );
  }
  return toolUse.input as T;
}

const ANSWER_TOOL: Tool = {
  name: "answer",
  description: "Answer the question using only the supplied memories.",
  input_schema: {
    type: "object",
    properties: {
      answer: {
        type: "string",
        description:
          "The answer, in one or two sentences. If the memories do not contain enough to answer, say exactly that you do not know.",
      },
    },
    required: ["answer"],
  },
};

const ANSWER_SYSTEM = `You answer questions about a user from a set of retrieved memories.

Rules:
- Use ONLY the memories provided. Do not use outside knowledge or guess.
- If the memories do not answer the question, say you do not know. Never invent a plausible answer.
- If two memories conflict, say so and give both, rather than silently picking one.
- A memory may carry what it "previously" said. That is what used to be true — use it to answer questions about the past, and never as the current value.
- Be brief: one or two sentences.`;

export async function answerFromMemories(
  model: string,
  question: string,
  memories: {
    content: string;
    type: string;
    relevanceScore: number;
    history?: { content: string }[];
  }[]
): Promise<string> {
  const rendered =
    memories.length === 0
      ? "(no memories were retrieved)"
      : memories
          .map((m, i) => {
            const past = (m.history ?? []).map((h) => `previously: ${h.content}`).join("; ");
            return `${i + 1}. [${m.type}, score ${m.relevanceScore.toFixed(2)}] ${m.content}${past ? ` (${past})` : ""}`;
          })
          .join("\n");

  const { answer } = await callTool<{ answer: string }>(
    model,
    ANSWER_SYSTEM,
    `Memories:\n${rendered}\n\nQuestion: ${question}`,
    ANSWER_TOOL
  );
  return answer;
}

const GRADE_TOOL: Tool = {
  name: "grade",
  description: "Grade a candidate answer against the reference answer.",
  input_schema: {
    type: "object",
    properties: {
      correct: { type: "boolean", description: "True if the candidate answer conveys the reference answer." },
      reason: { type: "string", description: "One short sentence explaining the verdict." },
    },
    required: ["correct", "reason"],
  },
};

const GRADE_SYSTEM = `You grade answers produced by a memory system.

Mark an answer CORRECT when it conveys the same substance as the reference answer. Wording, brevity and extra correct detail do not matter.

Mark it INCORRECT when it:
- states something the reference contradicts (for example naming a previous employer as the current one),
- claims not to know something the reference answers,
- or invents specifics the reference does not support.

Two special cases:
- When the reference says the answer is unknown, the candidate is CORRECT only if it says it does not know, and INCORRECT if it supplies an answer anyway.
- When the reference describes a conflict between two recorded facts, the candidate is CORRECT if it surfaces both sides or flags the conflict, and INCORRECT if it silently asserts one side as settled fact.`;

const GRADE_ATTEMPTS = 3;

export async function grade(
  model: string,
  question: EvalQuestion,
  candidate: string
): Promise<{ correct: boolean; reason: string }> {
  let last = "";

  // Tool inputs come back malformed occasionally — once with the key itself
  // mangled ("corr...ect" instead of "correct"). Treating a missing verdict as
  // `false` would silently mark a right answer wrong, so retry, and only give
  // up loudly. The caller keeps the rest of the run alive.
  for (let attempt = 0; attempt < GRADE_ATTEMPTS; attempt++) {
    const verdict = await callTool<{ correct?: boolean; reason?: string }>(
      model,
      GRADE_SYSTEM,
      `Question: ${question.q}\n\nReference answer: ${question.gold}\n\nCandidate answer: ${candidate}`,
      GRADE_TOOL
    );

    if (typeof verdict.correct === "boolean") {
      return { correct: verdict.correct, reason: verdict.reason ?? "" };
    }
    last = JSON.stringify(verdict);
  }

  throw new Error(
    `Judge returned no usable verdict after ${GRADE_ATTEMPTS} attempts for: ${question.q} (last: ${last})`
  );
}
