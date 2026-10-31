import { describe, expect, it } from "vite-plus/test";
import { api, createTestApp, signIn } from "../helpers";

const app = createTestApp();

describe("settings API", () => {
  it("upserts, lists, reads and deletes settings", async () => {
    const { token } = await signIn(app);

    const put = await api(app, "/api/v1/settings/theme", {
      method: "PUT",
      json: { value: { mode: "dark" }, metadata: { description: "UI theme" } },
      token,
    });
    expect(put.status).toBe(200);
    expect(put.body.data).toMatchObject({
      key: "theme",
      value: { mode: "dark" },
      metadata: { description: "UI theme" },
    });

    await api(app, "/api/v1/settings/limit", { method: "PUT", json: { value: 10 }, token });

    const all = await api<Array<{ key: string }>>(app, "/api/v1/settings", { token });
    expect(all.body.data?.map((s) => s.key).sort()).toEqual(["limit", "theme"]);

    const one = await api(app, "/api/v1/settings/theme", { token });
    expect(one.body.data).toMatchObject({ key: "theme", value: { mode: "dark" } });

    expect((await api(app, "/api/v1/settings/theme", { method: "DELETE", token })).status).toBe(
      204,
    );
    expect((await api(app, "/api/v1/settings/theme", { token })).status).toBe(404);
    expect((await api(app, "/api/v1/settings/theme", { method: "DELETE", token })).status).toBe(
      404,
    );
  });
});
