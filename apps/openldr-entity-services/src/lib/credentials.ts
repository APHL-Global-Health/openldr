// ─────────────────────────────────────────────────────────────────────────────
// AES-256-GCM credential encryption helpers
//
// Encrypts sensitive data (e.g. MSSQL credentials) before storing in the
// extension_credentials table. Uses a server-side key from CREDENTIAL_ENCRYPTION_KEY.
// ─────────────────────────────────────────────────────────────────────────────

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY env var must be set (min 32 chars)",
    );
  }
  // Use first 32 bytes for AES-256
  return Buffer.from(raw.slice(0, 32), "utf8");
}

/**
 * Encrypt a credential object to a single opaque string.
 * Format: base64(iv + authTag + ciphertext)
 */
export function encryptCredentials(data: Record<string, string>): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // iv (12) + tag (16) + ciphertext
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString("base64");
}

/**
 * Decrypt a credential string back to an object.
 */
export function decryptCredentials(
  encoded: string,
): Record<string, string> {
  const key = getKey();
  const combined = Buffer.from(encoded, "base64");

  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString("utf8"));
}
