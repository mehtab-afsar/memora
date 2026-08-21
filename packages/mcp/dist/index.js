#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Memora, MemoraError } from "@memora/client";
import { z } from "zod";
/**
 * Memora as an MCP server: long-term memory for coding agents and chat clients.
 *
 * Configure with MEMORA_API_KEY (required), MEMORA_BASE_URL, and MEMORA_USER_ID
 * — the last one is the end user this client writes for, so the agent does not
 * have to pass an id on every call.
 */
const apiKey = process.env.MEMORA_API_KEY;
if (!apiKey) {
    console.error("MEMORA_API_KEY is required. Create a key in the Memora dashboard.");
    process.exit(1);
}
const memora = new Memora({ apiKey, baseUrl: process.env.MEMORA_BASE_URL });
const defaultUserId = process.env.MEMORA_USER_ID ?? "default";
const server = new McpServer({ name: "memora", version: "0.1.0" });
/** Tool results are text; surface API failures as readable text, not stack traces. */
async function run(fn) {
    try {
        return { content: [{ type: "text", text: await fn() }] };
    }
    catch (error) {
        const message = error instanceof MemoraError
            ? `Memora error ${error.status}: ${error.message}`
            : error instanceof Error
                ? error.message
                : String(error);
        return { content: [{ type: "text", text: message }], isError: true };
    }
}
server.registerTool("remember", {
    title: "Remember",
    description: "Store something durable about the user — a preference, a decision, a constraint, a fact. " +
        "Send what they actually said; Memora decides what is worth keeping and reconciles it " +
        "against what it already knows. Do not use this for transient chatter.",
    inputSchema: {
        content: z.string().min(1).describe("What the user said or decided, in their own words where possible."),
        user_id: z.string().optional().describe(`End user id. Defaults to ${defaultUserId}.`),
        agent_id: z.string().optional().describe("Which agent learned this, if the product runs several."),
        session_id: z.string().optional().describe("The conversation or run this came from."),
    },
}, async ({ content, user_id, agent_id, session_id }) => run(async () => {
    const { outcomes } = await memora.remember({
        userId: user_id ?? defaultUserId,
        content,
        agentId: agent_id,
        sessionId: session_id,
    });
    if (outcomes.length === 0)
        return "Nothing durable to remember in that.";
    return outcomes
        .map((o) => `• ${o.candidateContent}${o.reconciliation === "pending" ? " (reconciling)" : ""}`)
        .join("\n");
}));
server.registerTool("recall", {
    title: "Recall",
    description: "Retrieve what is known about the user that bears on the current task. Call this before " +
        "asking the user something they may have already told you. Results are ranked and each " +
        "carries the reason it was returned.",
    inputSchema: {
        query: z.string().min(1).describe("What you need to know, phrased as a question or topic."),
        user_id: z.string().optional().describe(`End user id. Defaults to ${defaultUserId}.`),
        top_k: z.number().int().min(1).max(50).optional().describe("How many memories to return. Default 5."),
    },
}, async ({ query, user_id, top_k }) => run(async () => {
    const { results } = await memora.recall({
        userId: user_id ?? defaultUserId,
        query,
        topK: top_k ?? 5,
    });
    if (results.length === 0)
        return "No relevant memories.";
    return results
        .map((r) => {
        const conflict = r.status === "flagged" ? " [CONFLICTS with another memory — do not treat as settled]" : "";
        return `• ${r.content}${conflict}\n  (${r.reason})`;
    })
        .join("\n");
}));
server.registerTool("record_experience", {
    title: "Record experience",
    description: "Record what happened when you attempted a task — what you did, whether it worked, and why. " +
        "This is how the next attempt at the same task gets to start from what this one learned. " +
        "Record failures especially.",
    inputSchema: {
        task: z.string().min(1).describe("What you were trying to do."),
        action: z.string().min(1).describe("What you actually did."),
        outcome: z.enum(["success", "failure"]),
        cause: z.string().optional().describe("On failure: what went wrong."),
        resolution: z.string().optional().describe("What fixed it, or would have."),
        context: z.string().optional().describe("Anything about the situation that mattered."),
    },
}, async (input) => run(async () => {
    const { experience } = await memora.experiences.record(input);
    return `Recorded. Lesson: ${experience.lesson}`;
}));
server.registerTool("recommend", {
    title: "Recommend",
    description: "Ask what previous attempts at a task suggest before starting it. Returns a recommendation " +
        "grounded in recorded experiences, or nothing when there is nothing relevant — it will not guess.",
    inputSchema: {
        task: z.string().min(1).describe("The task you are about to attempt."),
    },
}, async ({ task }) => run(async () => {
    const result = await memora.experiences.recommend(task);
    if (!result.recommendation)
        return "No prior experience with anything like this task.";
    return `${result.recommendation}\n\nWhy: ${result.reasoning}\nConfidence: ${result.confidence}`;
}));
await server.connect(new StdioServerTransport());
