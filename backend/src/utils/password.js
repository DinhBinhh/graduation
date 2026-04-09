import crypto from "crypto";

const PASSWORD_PREFIX = "scrypt";

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${PASSWORD_PREFIX}$${salt}$${derivedKey}`;
}

export function verifyPassword(input, stored) {
  if (!stored) return false;

  if (!stored.startsWith(`${PASSWORD_PREFIX}$`)) {
    return input === stored;
  }

  const [, salt, expectedHash] = stored.split("$");
  if (!salt || !expectedHash) return false;

  const actualHash = crypto.scryptSync(input, salt, 64);
  const expectedBuffer = Buffer.from(expectedHash, "hex");

  if (actualHash.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(actualHash, expectedBuffer);
}

export function needsPasswordRehash(stored) {
  return !stored?.startsWith(`${PASSWORD_PREFIX}$`);
}
