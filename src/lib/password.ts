import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";

// Dependency-free password hashing with scrypt. Format: scrypt$<saltHex>$<hashHex>.
// The async scrypt runs on Node's worker pool: a burst of sign-ins at the start
// of an event would otherwise block every other request while it hashes.
const KEYLEN = 64;

const derive = (pw: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => scrypt(pw, salt, KEYLEN, (err, dk) => (err ? reject(err) : resolve(dk))));

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const dk = await derive(pw, salt);
  return `scrypt$${salt.toString("hex")}$${dk.toString("hex")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = (stored || "").split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  try {
    const dk = await derive(pw, Buffer.from(saltHex, "hex"));
    const expected = Buffer.from(hashHex, "hex");
    return expected.length === dk.length && timingSafeEqual(expected, dk);
  } catch {
    return false;
  }
}
