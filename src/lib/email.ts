/**
 * Outbound email.
 *
 * There is no email provider configured, and rather than pretend otherwise this
 * degrades the way billing does without Stripe: the feature still works, it just
 * tells you what it could not do. An invitation whose email cannot be sent still
 * creates a valid invitation and hands the link back to the person who created
 * it, to pass on however they like.
 *
 * That is not a placeholder for a missing feature — a copyable link is genuinely
 * useful (Slack, a message, reading it out) and it means team invites are usable
 * today rather than after someone signs up for Resend.
 *
 * Wiring a provider means implementing `send` and setting the env vars. The
 * interface is deliberately small: subject, text, html. Anything richer belongs
 * in a template, not in this seam.
 */

export type Email = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM;

export const emailEnabled = Boolean(apiKey && from);

export type SendResult = { sent: boolean; reason?: string };

export async function sendEmail(email: Email): Promise<SendResult> {
  if (!apiKey || !from) {
    return { sent: false, reason: "No email provider configured (RESEND_API_KEY, EMAIL_FROM)." };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: email.to, subject: email.subject, text: email.text, html: email.html }),
    });

    if (!response.ok) {
      return { sent: false, reason: `Email provider returned ${response.status}.` };
    }
    return { sent: true };
  } catch (error) {
    // A failed send must never fail the action that triggered it. The
    // invitation exists and its link works; not being able to email it is a
    // delivery problem, and the caller shows the link instead.
    return { sent: false, reason: error instanceof Error ? error.message : "Email send failed." };
  }
}

export function invitationEmail(params: {
  orgName: string;
  inviterEmail: string | null;
  role: string;
  link: string;
}): Omit<Email, "to"> {
  const inviter = params.inviterEmail ? `${params.inviterEmail} has` : "You have been";
  const subject = `Join ${params.orgName} on Memora`;
  const body =
    `${inviter} invited you to join ${params.orgName} on Memora as ${params.role === "admin" ? "an" : "a"} ${params.role}.\n\n` +
    `${params.link}\n\n` +
    `The link expires in 7 days. If you were not expecting this, you can ignore it — ` +
    `nothing happens until you open the link and accept.`;

  return {
    subject,
    text: body,
    html:
      `<p>${inviter} invited you to join <strong>${escapeHtml(params.orgName)}</strong> on Memora ` +
      `as ${params.role === "admin" ? "an" : "a"} ${escapeHtml(params.role)}.</p>` +
      `<p><a href="${escapeHtml(params.link)}">Accept the invitation</a></p>` +
      `<p style="color:#666;font-size:13px">The link expires in 7 days. If you were not expecting this, ` +
      `you can ignore it — nothing happens until you open the link and accept.</p>`,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
