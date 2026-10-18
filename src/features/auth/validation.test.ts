import { describe, expect, it } from "vitest";
import {
  checkEmail,
  checkName,
  checkPassword,
  checkPasswordPresent,
  normalizeEmail,
  problemsOf,
} from "./validation";

describe("the rules of the auth forms", () => {
  it("accepts an address with spaces and capitals, as the API stores it lower-case", () => {
    expect(normalizeEmail("  Anna@Example.com ")).toBe("anna@example.com");
    expect(checkEmail("  Anna@Example.com ")).toBeNull();
    expect(checkEmail("not-an-email")).toBe("emailInvalid");
    expect(checkEmail("")).toBe("emailInvalid");
    expect(checkEmail(`${"a".repeat(250)}@example.com`)).toBe("emailInvalid");
  });

  it("asks for 8 to 128 characters of any kind, nothing more", () => {
    expect(checkPassword("")).toBe("passwordRequired");
    expect(checkPassword("short7!")).toBe("passwordTooShort");
    expect(checkPassword("eight ch")).toBeNull();
    expect(checkPassword("mangoes in may 2026")).toBeNull();
    expect(checkPassword("x".repeat(128))).toBeNull();
    expect(checkPassword("x".repeat(129))).toBe("passwordTooLong");
  });

  it("only wants a password to be there when signing in", () => {
    expect(checkPasswordPresent("")).toBe("passwordRequired");
    expect(checkPasswordPresent("old")).toBeNull();
    expect(checkPasswordPresent("x".repeat(129))).toBe("passwordTooLong");
  });

  it("trims names and allows 1 to 80 characters", () => {
    expect(checkName("   ")).toBe("nameRequired");
    expect(checkName(" Anna ")).toBeNull();
    expect(checkName("a".repeat(80))).toBeNull();
    expect(checkName("a".repeat(81))).toBe("nameTooLong");
  });

  it("keeps only the fields with a problem", () => {
    expect(
      problemsOf({ email: null, password: "passwordTooShort", name: null }),
    ).toEqual({ password: "passwordTooShort" });
    expect(problemsOf({ email: null })).toEqual({});
  });
});
