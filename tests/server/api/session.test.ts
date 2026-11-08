import { describe, expect, it } from "vite-plus/test";
import type { SessionUser, SignInResponse } from "@groot/core/auth/auth.schema";
import * as authService from "@groot/core/auth/auth.service";
import * as passkeyService from "@groot/core/passkey/passkey.service";
import { api, createTestApp, type JsonResponse } from "../helpers";
import { createSoftPasskey } from "../fixtures/passkey";

// Each test file gets a fresh database, so first-run setup is still open here.
const app = createTestApp();
const owner = { email: "owner@example.com", password: "long-enough-pw", name: "Owner" };

/** The cookie a sign-in sets, minus its token value. */
function cookieAttributes(response: JsonResponse): string {
  const cookie = response.headers.get("set-cookie");
  expect(cookie).toMatch(/^token=[^;]+;/);
  return cookie!.replace(/^token=[^;]+;/, "token=<jwt>;");
}

/**
 * Every sign-in path answers alike: `{ token, user }` with `user` exactly the
 * `SessionUser` fields, the same cookie, and a token that opens a session.
 */
async function expectSignedIn(
  response: JsonResponse<SignInResponse>,
  user: SessionUser,
): Promise<string> {
  expect(response.body.data).toStrictEqual({ token: expect.any(String), user });
  const me = await api<{ id: number }>(app, "/api/v1/auth/me", {
    token: response.body.data!.token,
  });
  expect(me.body.data?.id).toBe(user.id);
  return cookieAttributes(response);
}

describe("sign-in paths", () => {
  it("first-run setup, password login and passkey login start the same session", async () => {
    const setup = await api<SignInResponse>(app, "/api/v1/auth/setup", {
      method: "POST",
      json: owner,
    });
    expect(setup.status).toBe(201);
    const user: SessionUser = { id: setup.body.data!.user.id, email: owner.email, name: "Owner" };
    const setupCookie = await expectSignedIn(setup, user);

    const login = await api<SignInResponse>(app, "/api/v1/auth/login", {
      method: "POST",
      json: { email: owner.email, password: owner.password },
    });
    expect(login.status).toBe(200);
    expect(await expectSignedIn(login, user)).toBe(setupCookie);

    const passkey = await createSoftPasskey(user.id);
    const options = await api<{ challenge: string }>(app, "/api/v1/passkey/login/options", {
      method: "POST",
      json: {},
    });
    const verified = await api<SignInResponse>(app, "/api/v1/passkey/login/verify", {
      method: "POST",
      json: { response: passkey.assert(options.body.data!.challenge) },
    });
    expect(verified.status).toBe(200);
    expect(await expectSignedIn(verified, user)).toBe(setupCookie);
  });

  it("the deprecated service-level sign-ins return the same body", async () => {
    const created = await authService.createUser({ ...owner, email: "legacy@example.com" });
    const user: SessionUser = { id: created.id, email: "legacy@example.com", name: "Owner" };
    const viaPassword = await authService.login({ email: user.email, password: owner.password });
    expect(viaPassword).toStrictEqual({ token: expect.any(String), user });

    const passkey = await createSoftPasskey(user.id);
    const { challenge } = await passkeyService.generateAuthenticationOptions();
    const viaPasskey = await passkeyService.verifyAuthentication({
      response: passkey.assert(challenge),
    });
    expect(viaPasskey).toStrictEqual({ token: expect.any(String), user });
  });
});
