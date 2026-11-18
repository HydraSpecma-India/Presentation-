import { describe, expect, it } from "vitest";
import { hasRole, isAllowedEmail, isRole } from "./roles";

describe("roles", () => {
  it("orders viewer < editor < admin", () => {
    expect(hasRole("admin", "editor")).toBe(true);
    expect(hasRole("editor", "editor")).toBe(true);
    expect(hasRole("viewer", "editor")).toBe(false);
    expect(hasRole(null, "viewer")).toBe(false);
  });
  it("recognises role names", () => {
    expect(isRole("editor")).toBe(true);
    expect(isRole("owner")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});

describe("isAllowedEmail", () => {
  it("accepts HydraSpecma addresses in any case", () => {
    expect(isAllowedEmail("Manigandan.Parthasarathi@HydraSpecma.com")).toBe(true);
  });
  it("rejects other domains and look-alikes", () => {
    expect(isAllowedEmail("someone@gmail.com")).toBe(false);
    expect(isAllowedEmail("x@hydraspecma.com.evil.io")).toBe(false);
    expect(isAllowedEmail("x@nothydraspecma.com")).toBe(false);
    expect(isAllowedEmail("not an email")).toBe(false);
  });
});
