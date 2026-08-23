import type { Metadata } from "next";
import { ProductPage } from "@/features/landing/components/product-page";

export const metadata: Metadata = {
  title: "Product — MEMORA",
  description:
    "A decision engine that sits in front of your vector database — what gets stored, how conflicts get flagged, and why Memory and Experience are two different things.",
};

export default function Page() {
  return <ProductPage />;
}
