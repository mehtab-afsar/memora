export const MEMORY_TYPES = [
  "preference",
  "fact",
  "goal",
  "relationship",
  "event",
  "instruction",
  "decision",
  "context",
] as const;
export type MemoryType = (typeof MEMORY_TYPES)[number];

export const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  preference: "Preference",
  fact: "Fact",
  goal: "Goal",
  relationship: "Relationship",
  event: "Event",
  instruction: "Instruction",
  decision: "Decision",
  context: "Context",
};

/** Categorical palette slot (1-8, fixed validated order) per memory type — see globals.css --type-1..8. */
export const MEMORY_TYPE_COLOR_VAR: Record<MemoryType, string> = {
  preference: "var(--type-1)",
  fact: "var(--type-2)",
  goal: "var(--type-3)",
  relationship: "var(--type-4)",
  event: "var(--type-5)",
  instruction: "var(--type-6)",
  decision: "var(--type-7)",
  context: "var(--type-8)",
};

export const MEMORY_STATUSES = ["active", "stale", "superseded", "archived", "flagged"] as const;
export type MemoryStatus = (typeof MEMORY_STATUSES)[number];

export const MEMORY_STATUS_LABELS: Record<MemoryStatus, string> = {
  active: "Active",
  stale: "Stale",
  superseded: "Superseded",
  archived: "Archived",
  flagged: "Flagged",
};
