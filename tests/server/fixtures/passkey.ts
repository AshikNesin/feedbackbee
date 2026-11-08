import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { isoCBOR } from "@simplewebauthn/server/helpers";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { db, passkeys } from "@groot/core/database";

const sha256 = (data: string | Uint8Array) => createHash("sha256").update(data).digest();

/**
 * A software authenticator: a real P-256 key whose public half is stored as a
 * passkey of `userId`, so `assert()` produces assertions that
 * @simplewebauthn/server verifies for real (no stub). `rpId` and `origin` are
 * the test env defaults (`RP_ID`, `ORIGIN`).
 */
export async function createSoftPasskey(
  userId: number,
  { rpId = "localhost", origin = "http://localhost:3000" } = {},
) {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = publicKey.export({ format: "jwk" });
  const coseKey = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [1, 2], // kty: EC2
      [3, -7], // alg: ES256
      [-1, 1], // crv: P-256
      [-2, new Uint8Array(Buffer.from(jwk.x!, "base64url"))],
      [-3, new Uint8Array(Buffer.from(jwk.y!, "base64url"))],
    ]),
  );
  const credentialId = randomBytes(16).toString("base64url");
  await db.insert(passkeys).values({
    userId,
    credentialId,
    publicKey: Buffer.from(coseKey),
    transports: ["internal"],
    deviceType: "singleDevice",
    credentialName: "Soft passkey",
  });

  let counter = 0;
  return {
    credentialId,
    /** Sign `challenge` the way a browser's `navigator.credentials.get()` would. */
    assert(challenge: string): AuthenticationResponseJSON {
      counter += 1;
      const clientDataJSON = Buffer.from(
        JSON.stringify({ type: "webauthn.get", challenge, origin, crossOrigin: false }),
      );
      const signCount = Buffer.alloc(4);
      signCount.writeUInt32BE(counter);
      // rpIdHash | flags (user present + user verified) | signCount
      const authenticatorData = Buffer.concat([sha256(rpId), Buffer.from([0x05]), signCount]);
      // Node signs EC keys in DER, the encoding WebAuthn uses.
      const signature = sign(
        "sha256",
        Buffer.concat([authenticatorData, sha256(clientDataJSON)]),
        privateKey,
      );
      return {
        id: credentialId,
        rawId: credentialId,
        type: "public-key",
        response: {
          clientDataJSON: clientDataJSON.toString("base64url"),
          authenticatorData: authenticatorData.toString("base64url"),
          signature: signature.toString("base64url"),
        },
        clientExtensionResults: {},
      };
    },
  };
}
