import { describe, expect, it } from "vitest";
import { generateTempPassword, passwordProblem } from "./password";

describe("passwordProblem", () => {
  it("rejects short or letter-only passwords", () => {
    expect(passwordProblem("abc1")).toMatch(/at least 8/);
    expect(passwordProblem("abcdefghij")).toMatch(/number/);
  });
  it("accepts a reasonable password", () => {
    expect(passwordProblem("Chennai2026")).toBeNull();
  });
});

describe("generateTempPassword", () => {
  it("always produces a valid, unambiguous password", () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateTempPassword();
      expect(passwordProblem(pw)).toBeNull();
      expect(pw).not.toMatch(/[0O1lI]/);
      expect(pw).toHaveLength(13);
    }
  });
  it("differs between calls", () => {
    expect(generateTempPassword()).not.toBe(generateTempPassword());
  });
});
