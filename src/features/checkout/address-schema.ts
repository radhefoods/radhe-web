import { z } from "zod";
import type { Address, AddressInput } from "@/lib/api/types";

// The delivery address form. The rules mirror the API (doc 3), so the form
// catches what the API would refuse; the messages are keys of
// `address.errors` in the translations.

const required = (max: number) =>
  z.string().trim().min(1, "required").max(max, "tooLong");
const optional = (max: number) => z.string().trim().max(max, "tooLong");

/** Spaces, hyphens and brackets are fine to type; the API wants none. */
export function normalizePhone(value: string): string {
  return value.replace(/[\s\-()/.]/g, "");
}

const PHONE = /^\+[1-9]\d{6,14}$/;

export const addressSchema = z.object({
  firstName: required(80),
  lastName: required(80),
  company: optional(120),
  street: required(120),
  houseNumber: required(20),
  additionalLine: optional(120),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "postalCode"),
  city: required(80),
  phone: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || PHONE.test(normalizePhone(value)),
      "phone",
    ),
  isDefault: z.boolean(),
});

export type AddressFormValues = z.infer<typeof addressSchema>;

export const EMPTY_ADDRESS: AddressFormValues = {
  firstName: "",
  lastName: "",
  company: "",
  street: "",
  houseNumber: "",
  additionalLine: "",
  postalCode: "",
  city: "",
  phone: "",
  isDefault: false,
};

export function addressToFormValues(address: Address): AddressFormValues {
  return {
    firstName: address.firstName,
    lastName: address.lastName,
    company: address.company ?? "",
    street: address.street,
    houseNumber: address.houseNumber,
    additionalLine: address.additionalLine ?? "",
    postalCode: address.postalCode,
    city: address.city,
    phone: address.phone ?? "",
    isDefault: address.isDefault,
  };
}

/** What the API gets: empty optional fields become `null` (which clears them). */
export function toAddressInput(values: AddressFormValues): AddressInput {
  const parsed = addressSchema.parse(values);
  return {
    firstName: parsed.firstName,
    lastName: parsed.lastName,
    company: parsed.company || null,
    street: parsed.street,
    houseNumber: parsed.houseNumber,
    additionalLine: parsed.additionalLine || null,
    postalCode: parsed.postalCode,
    city: parsed.city,
    countryCode: "DE",
    phone: parsed.phone ? normalizePhone(parsed.phone) : null,
    isDefault: parsed.isDefault,
  };
}
