import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

// Dependency-free password hashing with scrypt. Format: scrypt$<saltHex>$<hashHex>.
const KEYLEN = 64;

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(pw, salt, KEYLEN);
  return `scrypt$${salt.toString("hex")}$${dk.toString("hex")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = (stored || "").split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  try {
    const dk = scryptSync(pw, Buffer.from(saltHex, "hex"), KEYLEN);
    const expected = Buffer.from(hashHex, "hex");
    return expected.length === dk.length && timingSafeEqual(expected, dk);
  } catch {
    return false;
  }
}
