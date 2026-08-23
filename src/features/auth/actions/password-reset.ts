"use server";

import { headers } from "next/headers";
import { passwordResetEmail, sendEmail } from "@/lib/email";
import {
  completePasswordReset,
  PasswordResetError,
  requestPasswordReset,
  RESET_TTL_MINUTES,
} from "@/lib/password-reset";

export type ResetRequestState = {
  /** Always the same wording, whether or not the address has an account. */
  sent?: boolean;
  error?: string;
  /** Shown only when no email provider is configured — see src/lib/email.ts. */
  link?: string;
  notice?: string;
};

async function baseUrl(): Promise<string> {
  if (process.env.AUTH_URL) return process.env.AUTH_URL.replace(/\/$/, "");
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${protocol}://${host}`;
}

export async function requestPasswordResetAction(
  _prev: ResetRequestState | undefined,
  formData: FormData
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "");
  if (!email.includes("@")) return { error: "Enter an email address." };

  let issued: { token: string } | null = null;
  try {
    issued = await requestPasswordReset(email);
  } catch (error) {
    if (error instanceof PasswordResetError) return { error: error.message };
    console.error("[password-reset]", error);
    return { error: "Something went wrong. Please try again." };
  }

  // No account: stop here, and say exactly what the success case says. A form
  // that distinguishes the two is a free tool for finding out who has an
  // account, which is nobody's business but theirs.
  if (!issued) return { sent: true };

  const link = `${await baseUrl()}/reset-password/${issued.token}`;
  const result = await sendEmail({
    to: email,
    ...passwordResetEmail({ link, minutes: RESET_TTL_MINUTES }),
  });

  // The link is only ever surfaced when there is no way to send it. That is a
  // development convenience, and it leaks nothing an attacker could not get by
  // configuring email properly — but it does mean whoever runs the dashboard
  // can reset an account, which is worth knowing.
  return result.sent ? { sent: true } : { sent: true, link, notice: result.reason };
}

export type ResetCompleteState = { error?: string; done?: boolean };

export async function completePasswordResetAction(
  token: string,
  _prev: ResetCompleteState | undefined,
  formData: FormData
): Promise<ResetCompleteState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) return { error: "The two passwords don't match." };

  try {
    await completePasswordReset({ token, password });
    return { done: true };
  } catch (error) {
    if (error instanceof PasswordResetError) return { error: error.message };
    console.error("[password-reset]", error);
    return { error: "Something went wrong. Please try again." };
  }
}
