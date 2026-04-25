// API Key Encryption/Decryption
//
// Uses AES-256-GCM for authenticated encryption.
// Encryption key comes from ENCRYPTION_KEY env var (32-byte hex = 64 hex chars).
// Format stored in DB: "aes256gcm:<iv_hex>:<ciphertext_hex>:<tag_hex>"

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommended IV length
const PREFIX = "aes256gcm";

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set. Generate one with: openssl rand -hex 32");
  }
  if (key.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate with: openssl rand -hex 32");
  }
  return Buffer.from(key, "hex");
}

/**
 * Encrypt a plaintext string (e.g. API key).
 * Returns a formatted string: "aes256gcm:<iv>:<ciphertext>:<tag>"
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");

  return `${PREFIX}:${iv.toString("hex")}:${encrypted}:${tag}`;
}

/**
 * Decrypt a string encrypted by encrypt().
 * Input format: "aes256gcm:<iv>:<ciphertext>:<tag>"
 * Returns the original plaintext.
 */
export function decrypt(encrypted: string): string {
  const key = getEncryptionKey();
  const parts = encrypted.split(":");

  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("Invalid encrypted format. Expected: aes256gcm:<iv>:<ciphertext>:<tag>");
  }

  const iv = Buffer.from(parts[1], "hex");
  const ciphertext = parts[2];
  const tag = Buffer.from(parts[3], "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Check if a string is already encrypted (has the prefix).
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(`${PREFIX}:`);
}
