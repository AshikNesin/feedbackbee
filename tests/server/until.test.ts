import { describe, expect, it } from "vite-plus/test";
import { FIXED_NOW } from "../test-clock";
import { eventually, until } from "./fixtures/until";

describe("until", () => {
  it("returns the first truthy value", async () => {
    let calls = 0;
    expect(await until(() => ++calls >= 3 && "ready", "the third call")).toBe("ready");
  });

  it("times out on real time while Date stays frozen", async () => {
    await expect(until(() => false, "a reply that never comes", 50)).rejects.toThrow(
      "Timed out waiting for a reply that never comes",
    );
    expect(new Date().toISOString()).toBe(FIXED_NOW);
  });

  it("gives up before the test's own timeout, naming the wait", { timeout: 1_000 }, async () => {
    await expect(until(() => false, "the approval card")).rejects.toThrow(
      "Timed out waiting for the approval card",
    );
  });
});

describe("eventually", () => {
  it("rethrows the check's last error at the deadline", async () => {
    await expect(eventually(() => expect(1).toBe(2), 50)).rejects.toThrow("expected 1 to be 2");
  });
});
