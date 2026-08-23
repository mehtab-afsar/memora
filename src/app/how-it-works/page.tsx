import type { Metadata } from "next";
import { HowItWorksPage } from "@/features/landing/components/how-it-works-page";

export const metadata: Metadata = {
  title: "How it works — MEMORA",
  description:
    "Remember, decide, store, recall — the four steps every write and every recall goes through, with a real code example.",
};

export default function Page() {
  return <HowItWorksPage />;
}
