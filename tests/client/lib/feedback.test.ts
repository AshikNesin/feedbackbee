/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vite-plus/test";
import { ApiError, NetworkError } from "@groot/shell/lib/api";
import { OFFLINE_MESSAGE, WEBAUTHN_MESSAGES, describeError } from "@groot/shell/lib/feedback";

const FALLBACK = "Unable to save";

const apiError = (status: number, message: string, fromServer: boolean) =>
  new ApiError({ status, code: `HTTP_${status}`, message, url: "/x", fromServer });

/** A WebAuthn failure as @simplewebauthn/browser rethrows it: the DOMException's name, an ERROR_* code. */
const webAuthnError = (name: string) =>
  Object.assign(new Error("The operation either timed out or was not allowed."), {
    name,
    code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY",
  });

describe("describeError", () => {
  it.each<[string, unknown, string]>([
    [
      "the server's own message",
      apiError(409, "Setting already exists", true),
      "Setting already exists",
    ],
    ["a bare status line (502)", apiError(502, "Bad Gateway", false), FALLBACK],
    ["an envelope with no data", apiError(200, "No data returned", false), FALLBACK],
    ["a request that never left", new NetworkError("/x"), OFFLINE_MESSAGE],
    ["fetch's own TypeError", new TypeError("Failed to fetch"), OFFLINE_MESSAGE],
    ["Safari's fetch TypeError", new TypeError("Load failed"), OFFLINE_MESSAGE],
    ["a programming TypeError", new TypeError("x is not a function"), FALLBACK],
    [
      "a cancelled passkey prompt",
      webAuthnError("NotAllowedError"),
      WEBAUTHN_MESSAGES.NotAllowedError!,
    ],
    [
      "a browser without passkeys",
      new DOMException("no WebAuthn", "NotSupportedError"),
      WEBAUTHN_MESSAGES.NotSupportedError!,
    ],
    ["the action's own Error", new Error("Invalid JSON format"), "Invalid JSON format"],
    ["a raw SyntaxError", new SyntaxError("Unexpected token } in JSON"), FALLBACK],
    ["an Error with no message", new Error(""), FALLBACK],
    ["a thrown string", "boom", FALLBACK],
    ["nothing at all", undefined, FALLBACK],
  ])("words %s", (_, error, expected) => {
    expect(describeError(error, FALLBACK)).toBe(expected);
  });

  it("leaves a non-WebAuthn error that shares a table name to the fallback", () => {
    const clipboard = Object.assign(new Error("denied"), { name: "NotAllowedError" });
    expect(describeError(clipboard, FALLBACK)).toBe(FALLBACK);
  });
});
