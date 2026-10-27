// The discount codes of the mock (doc/DISCOUNT_CODES.md): one in every
// state the checkout page can meet, so that each message of the shop can be
// seen. The admin would create them in the panel.

import type { DiscountType } from "../../src/lib/api/types.ts";

export interface DiscountRecord {
  id: string;
  /** Upper case, 4 to 20 characters of `A–Z 0–9 -`. */
  code: string;
  type: DiscountType;
  /** A whole percent, or cents. */
  value: number;
  /** `false`: lines at a reduced price are left out. */
  appliesToSaleItems: boolean;
  /** Cents the orderable goods must be worth before the discount, or `null`. */
  minOrderValue: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  /** How often the code may be used in all; `null` means without limit. */
  maxUses: number | null;
  /** The customer may pay one order with it. */
  oncePerCustomer: boolean;
  isActive: boolean;
  /** Paid orders. */
  usedCount: number;
  /** Orders that wait for their payment. */
  reservedCount: number;
}

function code(
  id: string,
  text: string,
  type: DiscountType,
  value: number,
  rules: Partial<Omit<DiscountRecord, "id" | "code" | "type" | "value">> = {},
): DiscountRecord {
  return {
    id,
    code: text,
    type,
    value,
    appliesToSaleItems: true,
    minOrderValue: null,
    startsAt: null,
    expiresAt: null,
    maxUses: null,
    oncePerCustomer: false,
    isActive: true,
    usedCount: 0,
    reservedCount: 0,
    ...rules,
  };
}

export const discounts: DiscountRecord[] = [
  // 10 % on everything, up to 100 uses: the example of the documentation.
  code("66fd000000000000000000a1", "DIWALI10", "percent", 10, {
    maxUses: 100,
    usedCount: 12,
  }),
  // 5 € off from 20 € of goods, once per customer.
  code("66fd000000000000000000a2", "WELCOME5", "fixed", 500, {
    minOrderValue: 2000,
    oncePerCustomer: true,
  }),
  // 15 % on products that are not on sale.
  code("66fd000000000000000000a3", "NOSALE15", "percent", 15, {
    appliesToSaleItems: false,
  }),
  // Switched off by the admin.
  code("66fd000000000000000000a4", "PAUSED", "percent", 20, {
    isActive: false,
  }),
  // Not valid yet.
  code("66fd000000000000000000a5", "SOON", "percent", 10, {
    startsAt: "2027-01-01T00:00:00.000Z",
  }),
  // Ran out on New Year's Eve.
  code("66fd000000000000000000a6", "OLDTIMES", "percent", 10, {
    expiresAt: "2026-01-01T00:00:00.000Z",
  }),
  // Every use is taken.
  code("66fd000000000000000000a7", "GONE", "fixed", 300, {
    maxUses: 5,
    usedCount: 5,
  }),
];
