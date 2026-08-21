"use server";

import { signOut } from "@/features/auth/lib/auth";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
