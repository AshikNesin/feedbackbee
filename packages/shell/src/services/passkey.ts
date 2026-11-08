import { apiClient } from "@groot/shell/lib/api";
import { describeWebAuthnError } from "@groot/shell/lib/feedback";
import { startRegistration } from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/browser";
import type { PasskeySummary } from "@groot/core/passkey/passkey.schema";

/** A passkey as the server presents it — `PasskeySummary` in
 *  `@groot/core/passkey/passkey.schema` is the source of truth (type-only
 *  import, erased at build). */
type Passkey = PasskeySummary;

class PasskeyService {
  /**
   * Register a new passkey for the authenticated user
   */
  async registerPasskey(credentialName?: string): Promise<Passkey> {
    try {
      // 1. Get registration options from server
      const options = await apiClient.post<PublicKeyCredentialCreationOptionsJSON>(
        "/passkey/register/options",
      );

      if (!options) {
        throw new Error("Failed to get registration options");
      }

      // 2. Start WebAuthn registration
      const registrationResponse: RegistrationResponseJSON = await startRegistration({
        optionsJSON: options,
      });

      // 3. Verify registration with server
      const passkey = await apiClient.post<Passkey>("/passkey/register/verify", {
        response: registrationResponse,
        credentialName,
      });

      if (!passkey) {
        throw new Error("Failed to verify registration");
      }

      return passkey;
    } catch (error: unknown) {
      // Reword a WebAuthn failure from the shell's one table, keeping the
      // browser's error as the cause.
      const message = describeWebAuthnError(error);
      if (message) throw new Error(message, { cause: error });
      throw error;
    }
  }

  /**
   * List all passkeys for the authenticated user
   */
  async listPasskeys(): Promise<Passkey[]> {
    const passkeys = await apiClient.get<Passkey[]>("/passkey/list");
    return passkeys || [];
  }

  /**
   * Delete a passkey
   */
  async deletePasskey(passkeyId: number): Promise<void> {
    await apiClient.delete(`/passkey/${passkeyId}`);
  }

  /**
   * Update passkey name
   */
  async updatePasskeyName(passkeyId: number, credentialName: string): Promise<Passkey> {
    const passkey = await apiClient.patch<Passkey>(`/passkey/${passkeyId}`, {
      credentialName,
    });

    if (!passkey) {
      throw new Error("Failed to update passkey name");
    }

    return passkey;
  }
}

// Export singleton instance
export const passkeyService = new PasskeyService();
export type { Passkey };
