import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

function getEncryptionSecret() {
  const secret = process.env.EMAIL_TOKEN_ENCRYPTION_KEY?.trim();

  if (!secret) {
    throw new Error("Missing EMAIL_TOKEN_ENCRYPTION_KEY.");
  }

  return secret;
}

function deriveKey() {
  return createHash("sha256").update(getEncryptionSecret()).digest();
}

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64");
}

export function encodeBase64Url(value: Buffer | string) {
  return base64UrlEncode(value);
}

export function decodeBase64Url(value: string) {
  return base64UrlDecode(value);
}

export function encryptSecret(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${base64UrlEncode(iv)}.${base64UrlEncode(tag)}.${base64UrlEncode(encrypted)}`;
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [ivPart, tagPart, payloadPart] = value.split(".");
  if (!ivPart || !tagPart || !payloadPart) {
    throw new Error("Invalid encrypted payload.");
  }

  const decipher = createDecipheriv("aes-256-gcm", deriveKey(), base64UrlDecode(ivPart));
  decipher.setAuthTag(base64UrlDecode(tagPart));
  const decrypted = Buffer.concat([
    decipher.update(base64UrlDecode(payloadPart)),
    decipher.final()
  ]);

  return decrypted.toString("utf8");
}

export function signValue(value: string) {
  return createHash("sha256").update(`${getEncryptionSecret()}:${value}`).digest("hex");
}

export function verifySignedValue(value: string, signature: string) {
  const expectedHex = signValue(value);
  if (!/^[0-9a-f]+$/i.test(signature) || signature.length !== expectedHex.length) {
    return false;
  }

  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(signature, "hex");

  if (expected.length !== actual.length) {
    return false;
  }

  return timingSafeEqual(expected, actual);
}
