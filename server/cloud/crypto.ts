import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

let cachedKey: Buffer | null | undefined;

function key(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const secret = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  cachedKey = secret ? scryptSync(secret, "vantage-web-token", 32) : null;
  return cachedKey;
}

export function tokenEncryptionConfigured() {
  return Boolean(key());
}

/** Encrypts a GitHub access token for storage. Returns null if TOKEN_ENCRYPTION_KEY is not set. */
export function encryptToken(plain: string): string | null {
  const k = key();
  if (!k) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptToken(payload: string | null | undefined): string | null {
  const k = key();
  if (!k || !payload) return null;
  try {
    const buf = Buffer.from(payload, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", k, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
