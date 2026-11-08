import { importPKCS8 } from "jose";
import { Boom } from "@groot/core/errors";
import { runtime } from "../../runtime";

function decode(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function encode(value: Uint8Array): string {
  return btoa(Array.from(value, (b) => String.fromCharCode(b)).join(""));
}

function keyBytes(): Uint8Array<ArrayBuffer> {
  try {
    const bytes = decode(runtime().encryptionKey ?? "");
    if (bytes.length === 32) return bytes;
  } catch {
    /* Invalid configuration is reported without exposing its value. */
  }
  throw Boom.unavailable(
    "Set FEEDBACKBEE_ENCRYPTION_KEY to a base64-encoded 32-byte encryption key",
  );
}

export function encryptionConfigured(): boolean {
  try {
    keyBytes();
    return true;
  } catch {
    return false;
  }
}

async function encryptionKey() {
  return crypto.subtle.importKey("raw", keyBytes(), "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptPrivateKey(value: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode("feedbackbee:github:v1") },
    await encryptionKey(),
    new TextEncoder().encode(value),
  );
  return `v1.${encode(iv)}.${encode(new Uint8Array(encrypted))}`;
}

export async function decryptPrivateKey(value: string): Promise<string> {
  try {
    const [version, iv, encrypted] = value.split(".");
    if (version !== "v1" || !iv || !encrypted) throw new Error();
    return new TextDecoder().decode(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: decode(iv),
          additionalData: new TextEncoder().encode("feedbackbee:github:v1"),
        },
        await encryptionKey(),
        decode(encrypted),
      ),
    );
  } catch {
    throw Boom.unavailable(
      "Cannot unlock the GitHub App. Restore FEEDBACKBEE_ENCRYPTION_KEY or reconnect the app",
    );
  }
}

function der(tag: number, data: Uint8Array): Uint8Array {
  const size = data.length;
  const length = size < 128 ? [size] : size < 256 ? [0x81, size] : [0x82, size >> 8, size & 255];
  return new Uint8Array([tag, ...length, ...data]);
}

/** GitHub returns PKCS#1 PEM; Web Crypto imports the PKCS#8 envelope. */
export async function importAppKey(pem: string) {
  if (pem.includes("BEGIN RSA PRIVATE KEY")) {
    const rsa = decode(pem.replace(/-----[^-]+-----|\s/g, ""));
    const algorithm = [
      0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
    ];
    const pkcs8 = der(0x30, new Uint8Array([0x02, 0x01, 0x00, ...algorithm, ...der(0x04, rsa)]));
    pem = `-----BEGIN PRIVATE KEY-----\n${encode(pkcs8)}\n-----END PRIVATE KEY-----`; // gitleaks:allow (runtime PEM envelope, no embedded key)
  }
  return importPKCS8(pem, "RS256");
}

export async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomSecret(): string {
  return encode(crypto.getRandomValues(new Uint8Array(32)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** Check GitHub's `X-Hub-Signature-256` (HMAC-SHA256 of the raw body) in constant time. */
export async function verifyWebhookSignature(
  secret: string,
  body: string,
  header: string | undefined,
): Promise<boolean> {
  const hex = header?.match(/^sha256=([0-9a-f]{64})$/i)?.[1];
  if (!hex) return false;
  const signature = Uint8Array.from(hex.match(/../g)!, (byte) => parseInt(byte, 16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, signature, new TextEncoder().encode(body));
}
