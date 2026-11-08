import { describe, expect, it, vi } from "vite-plus/test";
import { FIXED_NOW, futureIso } from "../test-clock";

const loadedAt = Date.now();

describe("test clock", () => {
  it("is pinned while the test file loads", () => {
    expect(loadedAt).toBe(Date.parse(FIXED_NOW));
  });

  it("reports FIXED_NOW as now, and timers still fire", async () => {
    expect(new Date().toISOString()).toBe(FIXED_NOW);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(new Date().toISOString()).toBe(FIXED_NOW);
  });

  it.each([1, 2])("starts at FIXED_NOW even after another test moved it (%i)", () => {
    expect(Date.now()).toBe(Date.parse(FIXED_NOW));
    vi.setSystemTime("2030-01-01T00:00:00.000Z");
  });

  it("leaves fake timers on without Date, as a careless test might", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    expect(Date.now()).not.toBe(Date.parse(FIXED_NOW));
  });

  it("starts the next test at FIXED_NOW with real timers", async () => {
    expect(Date.now()).toBe(Date.parse(FIXED_NOW));
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  it("dates futureIso(days) from FIXED_NOW", () => {
    expect(futureIso(25)).toBe("2026-12-01T06:30:00.000Z");
  });
});
