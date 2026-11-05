import { z } from "zod";
import type { Address, AddressInput, GuestAddressInput } from "@/lib/api/types";
import { normalizePhone } from "@/lib/format/phone";

// The delivery address form. The rules mirror the API (doc 3), so the form
// catches what the API would refuse; the messages are keys of
// `address.errors` in the translations.

const required = (max: number) =>
  z.string().trim().min(1, "required").max(max, "tooLong");
const optional = (max: number) => z.string().trim().max(max, "tooLong");

// From a module of its own: the profile page needs the helper, not zod.
export { normalizePhone };

const PHONE = /^\+[1-9]\d{6,14}$/;

export const addressSchema = z.object({
  /** The customer's own word for the address ("Home", "Work"), up to 30 characters. */
  label: optional(30),
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
  label: "",
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

/** The one address of a guest order, as the checkout lists it with the cards. */
export const GUEST_ADDRESS_ID = "guest";

/** The address of a guest order (doc 20): a saved address without `label` and `isDefault`. */
export function toGuestAddressInput(
  values: AddressFormValues,
): GuestAddressInput {
  const input = toAddressInput(values);
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    company: input.company,
    street: input.street,
    houseNumber: input.houseNumber,
    additionalLine: input.additionalLine,
    postalCode: input.postalCode,
    city: input.city,
    countryCode: "DE",
    phone: input.phone,
  };
}

/** The guest's address as the checkout shows it among the address cards. */
export function guestAddressOf(values: AddressFormValues): Address {
  const input = toGuestAddressInput(values);
  return {
    id: GUEST_ADDRESS_ID,
    label: null,
    firstName: input.firstName,
    lastName: input.lastName,
    company: input.company ?? null,
    street: input.street,
    houseNumber: input.houseNumber,
    additionalLine: input.additionalLine ?? null,
    postalCode: input.postalCode,
    city: input.city,
    countryCode: "DE",
    phone: input.phone ?? null,
    isDefault: false,
  };
}

export function addressToFormValues(address: Address): AddressFormValues {
  return {
    label: address.label ?? "",
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
    label: parsed.label || null,
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
