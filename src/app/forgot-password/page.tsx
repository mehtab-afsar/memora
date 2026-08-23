import type { Metadata } from "next";
import { ForgotPasswordPage } from "@/features/auth/components/forgot-password-page";

export const metadata: Metadata = { title: "Forgot your password — MEMORA" };

export default function Page() {
  return <ForgotPasswordPage />;
}
