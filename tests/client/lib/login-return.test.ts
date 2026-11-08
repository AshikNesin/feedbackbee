import { describe, expect, it } from "vite-plus/test";
import { returnPath } from "@groot/shell/pages/auth/Login";

describe("returnPath", () => {
  it("sends the visitor back to the protected page they asked for", () => {
    expect(returnPath({ from: { pathname: "/todos", search: "?filter=open", hash: "#x" } })).toBe(
      "/todos?filter=open#x",
    );
  });

  it("goes home without a usable location", () => {
    expect(returnPath(null)).toBe("/");
    expect(returnPath({})).toBe("/");
    expect(returnPath({ from: { pathname: "/login" } })).toBe("/");
    expect(returnPath({ from: { pathname: "//evil.example.com" } })).toBe("/");
    expect(returnPath({ from: { pathname: "https://evil.example.com" } })).toBe("/");
  });
});
