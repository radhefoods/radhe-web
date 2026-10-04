import { describe, expect, it } from "vitest";
import {
  EMPTY_ADDRESS,
  addressSchema,
  addressToFormValues,
  toAddressInput,
  type AddressFormValues,
} from "./address-schema";

const valid: AddressFormValues = {
  ...EMPTY_ADDRESS,
  firstName: "Max",
  lastName: "Müller",
  street: "Hauptstraße",
  houseNumber: "12a",
  postalCode: "60311",
  city: "Frankfurt am Main",
};

function problems(values: AddressFormValues): Record<string, string> {
  const result = addressSchema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}

describe("address form", () => {
  it("accepts a complete German address", () => {
    expect(problems(valid)).toEqual({});
  });

  it("asks for every required field", () => {
    expect(problems(EMPTY_ADDRESS)).toEqual({
      firstName: "required",
      lastName: "required",
      street: "required",
      houseNumber: "required",
      postalCode: "postalCode",
      city: "required",
    });
  });

  it("wants exactly five digits as postcode", () => {
    expect(problems({ ...valid, postalCode: "6031" })).toHaveProperty(
      "postalCode",
    );
    expect(problems({ ...valid, postalCode: "603111" })).toHaveProperty(
      "postalCode",
    );
    expect(problems({ ...valid, postalCode: "6O311" })).toHaveProperty(
      "postalCode",
    );
    expect(problems({ ...valid, postalCode: " 60311 " })).toEqual({});
  });

  it("respects the lengths of the API", () => {
    expect(problems({ ...valid, firstName: "x".repeat(81) })).toEqual({
      firstName: "tooLong",
    });
    expect(problems({ ...valid, houseNumber: "x".repeat(21) })).toEqual({
      houseNumber: "tooLong",
    });
    expect(problems({ ...valid, company: "x".repeat(121) })).toEqual({
      company: "tooLong",
    });
  });

  it("accepts a phone number as people type it, with country code", () => {
    expect(problems({ ...valid, phone: "+49 151 1234-5678" })).toEqual({});
    expect(problems({ ...valid, phone: "0151 12345678" })).toEqual({
      phone: "phone",
    });
    expect(problems({ ...valid, phone: "+49" })).toEqual({ phone: "phone" });
  });
});

describe("toAddressInput", () => {
  it("sends null for empty optional fields and a clean phone number", () => {
    expect(
      toAddressInput({ ...valid, phone: "+49 (151) 1234-5678", company: " " }),
    ).toEqual({
      firstName: "Max",
      lastName: "Müller",
      company: null,
      street: "Hauptstraße",
      houseNumber: "12a",
      additionalLine: null,
      postalCode: "60311",
      city: "Frankfurt am Main",
      countryCode: "DE",
      phone: "+4915112345678",
      isDefault: false,
    });
  });

  it("trims what was typed", () => {
    expect(toAddressInput({ ...valid, city: "  Berlin " }).city).toBe("Berlin");
  });
});

describe("addressToFormValues", () => {
  it("fills the form from a stored address", () => {
    expect(
      addressToFormValues({
        id: "66e1a2b3c4d5e6f7a8b9c0d1",
        firstName: "Max",
        lastName: "Müller",
        company: null,
        street: "Hauptstraße",
        houseNumber: "12a",
        additionalLine: "2. OG",
        postalCode: "60311",
        city: "Frankfurt am Main",
        countryCode: "DE",
        phone: null,
        isDefault: true,
      }),
    ).toEqual({
      ...valid,
      additionalLine: "2. OG",
      isDefault: true,
    });
  });
});
