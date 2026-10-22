const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function keyFrom(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(plain: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await keyFrom(secret);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  return `${b64urlEncode(iv)}.${b64urlEncode(new Uint8Array(cipher))}`;
}

export async function decryptSecret(packed: string, secret: string): Promise<string> {
  const [ivPart, dataPart] = packed.split(".");
  if (!ivPart || !dataPart) throw new Error("bad ciphertext");
  const key = await keyFrom(secret);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64urlDecode(ivPart) },
    key,
    b64urlDecode(dataPart),
  );
  return dec.decode(plain);
}

export async function hashPassword(password: string, salt?: string): Promise<string> {
  const useSalt = salt ?? b64urlEncode(crypto.getRandomValues(new Uint8Array(16)));
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(`${useSalt}:${password}`));
  return `${useSalt}.${b64urlEncode(new Uint8Array(digest))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt] = stored.split(".");
  if (!salt) return false;
  const candidate = await hashPassword(password, salt);
  return candidate === stored;
}

export function newToken(): string {
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export function newId(): string {
  return crypto.randomUUID();
}
