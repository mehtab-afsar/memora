import { CircleCheck, CircleX } from "lucide-react";

export function OutcomeBadge({ outcome }: { outcome: "success" | "failure" }) {
  const isSuccess = outcome === "success";
  const Icon = isSuccess ? CircleCheck : CircleX;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        color: isSuccess ? "var(--status-good)" : "var(--status-critical)",
        backgroundColor: isSuccess
          ? "color-mix(in oklab, var(--status-good) 12%, transparent)"
          : "color-mix(in oklab, var(--status-critical) 12%, transparent)",
      }}
    >
      <Icon className="size-3" />
      {isSuccess ? "Success" : "Failure"}
    </span>
  );
}
