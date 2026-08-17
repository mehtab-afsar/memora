import { randomBytes, createHash } from "node:crypto";

export function generateApiKey(environmentName: string) {
  const isProd = environmentName.toLowerCase() === "production";
  const secret = randomBytes(24).toString("base64url");
  const fullKey = `sk_${isProd ? "live" : "test"}_${secret}`;
  const prefix = fullKey.slice(0, fullKey.indexOf("_", fullKey.indexOf("_") + 1) + 5);
  const hash = hashApiKey(fullKey);
  return { fullKey, prefix, hash };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
