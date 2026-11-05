// The loyalty coins (doc/REWARDS.md 1, 3 and 5): the rules as the admin
// set them, the ledger with one row per movement, the arithmetic of
// redeeming and earning as the API computes it, and the hooks of an
// order's life (reserved at checkout, spent at payment, released when the
// order is given up, earned at delivery).

import { createHash, randomBytes } from "node:crypto";
import type {
  BillLine,
  BillRewards,
  MyRewards,
  Page,
  RewardsAccount,
  RewardsProgram,
  RewardsReason,
  RewardTransaction,
  RewardTransactionType,
} from "../src/lib/api/types.ts";
import { HttpError } from "./errors.ts";
import {
  db,
  type CustomerRecord,
  type OrderRecord,
  type RewardAccountRecord,
  type RewardTransactionRecord,
  type ReviewRecord,
} from "./state.ts";

// --- Settings (doc/REWARDS.md 4) --------------------------------------------

export interface RewardsSettings {
  enabled: boolean;
  earning: {
    order: { enabled: boolean; coinsPerEuro: number };
    welcome: { enabled: boolean; coins: number };
    referral: {
      inviter: { enabled: boolean; coins: number };
      invitee: { enabled: boolean; coins: number };
    };
    review: { enabled: boolean; coins: number };
    campaign: {
      enabled: boolean;
      multiplier: number;
      startsAt: string | null;
      endsAt: string | null;
      name: string | null;
    };
  };
  redemption: {
    enabled: boolean;
    percentPerCoin: number;
    minCoins: number | null;
    minRedeemValue: number | null;
    minOrderValue: number | null;
    maxCoinsPerOrder: number | null;
    maxDiscount: number | null;
    combinableWithDiscountCodes: boolean;
  };
  expiry: { enabled: boolean; inactivityMonths: number };
}

/**
 * The program as the mock runs it: on, one coin per euro, 100 coins for
 * the sign-up, 100 for the inviter when a friend's first order is
 * delivered, 25 for a published review, 0.01 % of the goods per coin
 * (100 coins = 1 %), at most 5 € per order, coins go with codes.
 */
export const DEFAULT_REWARDS_SETTINGS: RewardsSettings = {
  enabled: true,
  earning: {
    order: { enabled: true, coinsPerEuro: 1 },
    welcome: { enabled: true, coins: 100 },
    referral: {
      inviter: { enabled: true, coins: 100 },
      invitee: { enabled: false, coins: 50 },
    },
    review: { enabled: true, coins: 25 },
    campaign: {
      enabled: false,
      multiplier: 2,
      startsAt: null,
      endsAt: null,
      name: null,
    },
  },
  redemption: {
    enabled: true,
    percentPerCoin: 0.01,
    minCoins: null,
    minRedeemValue: null,
    minOrderValue: null,
    maxCoinsPerOrder: null,
    maxDiscount: 500,
    combinableWithDiscountCodes: true,
  },
  expiry: { enabled: false, inactivityMonths: 12 },
};

export const rewards = { settings: structuredClone(DEFAULT_REWARDS_SETTINGS) };

/** A test control: parts of the settings, merged over the current ones. */
export function changeRewardsSettings(patch: unknown): void {
  const merge = (target: unknown, source: unknown): unknown => {
    if (
      target === null ||
      typeof target !== "object" ||
      source === null ||
      typeof source !== "object"
    ) {
      return source;
    }
    const out: Record<string, unknown> = { ...(target as object) };
    for (const [key, value] of Object.entries(source)) {
      out[key] = key in out ? merge(out[key], value) : value;
    }
    return out;
  };
  rewards.settings = merge(rewards.settings, patch) as RewardsSettings;
}

/** The rules as they were at start (`POST /__mock/reset`). */
export function resetRewards(): void {
  rewards.settings = structuredClone(DEFAULT_REWARDS_SETTINGS);
}

// --- The arithmetic (doc/REWARDS.md 3), as the API's reward-rules.ts -------

/** 0.01 % becomes 10,000: a millionth of a percent is the smallest step. */
const MICRO_PERCENT = 1_000_000n;
const DIVISOR = 100n * MICRO_PERCENT;

function microPercentOf(percentPerCoin: number): bigint {
  return BigInt(Math.round(percentPerCoin * Number(MICRO_PERCENT)));
}

/** What `coins` take off `goods`, rounded to the cent, in exact integers. */
export function discountFor(
  goods: number,
  coins: number,
  percentPerCoin: number,
): number {
  if (goods <= 0 || coins <= 0 || percentPerCoin <= 0) return 0;
  const exact = BigInt(goods) * BigInt(coins) * microPercentOf(percentPerCoin);
  return Number((exact + DIVISOR / 2n) / DIVISOR);
}

/**
 * The fewest coins whose discount on `goods` reaches `amount` cents, at
 * most `limit`; null when `limit` coins do not reach it.
 */
export function coinsNeededFor(
  goods: number,
  amount: number,
  percentPerCoin: number,
  limit: number,
): number | null {
  if (amount <= 0) return 0;
  if (limit <= 0 || goods <= 0 || percentPerCoin <= 0) return null;
  const perCoin = BigInt(goods) * microPercentOf(percentPerCoin);
  const target = BigInt(amount) * DIVISOR - DIVISOR / 2n;
  let coins = Math.max(
    1,
    Math.min(
      limit,
      Number(target <= 0n ? 1n : (target + perCoin - 1n) / perCoin),
    ),
  );
  while (coins > 1 && discountFor(goods, coins - 1, percentPerCoin) >= amount) {
    coins -= 1;
  }
  while (coins <= limit && discountFor(goods, coins, percentPerCoin) < amount) {
    coins += 1;
  }
  return coins > limit ? null : coins;
}

/** The most coins whose discount on `goods` stays within `cap` cents. */
function coinsWithin(
  goods: number,
  cap: number,
  percentPerCoin: number,
  limit: number,
): number {
  if (discountFor(goods, limit, percentPerCoin) <= cap) return limit;
  const reaching = coinsNeededFor(goods, cap, percentPerCoin, limit);
  if (reaching === null) return limit;
  return discountFor(goods, reaching, percentPerCoin) === cap
    ? reaching
    : reaching - 1;
}

interface Redemption {
  requested: number | null;
  coins: number;
  amount: number;
  applied: boolean;
  reason: RewardsReason | null;
  maxCoins: number;
  maxAmount: number;
}

/**
 * What the coins take off this bill, and why not: the program is on, the
 * customer has coins, the code and the goods allow it, the caps, the
 * minimum reward value; coins that add no cent stay with the customer.
 * `requested` 0 means nothing was chosen yet.
 */
export function redemptionOf(input: {
  goods: number;
  available: number;
  requested: number | null;
  codeApplied: boolean;
  settings: RewardsSettings;
}): Redemption {
  const { settings, goods, available, requested } = input;
  const rules = settings.redemption;
  const refused = (reason: RewardsReason): Redemption => ({
    requested,
    coins: 0,
    amount: 0,
    applied: false,
    reason,
    maxCoins: 0,
    maxAmount: 0,
  });
  if (!settings.enabled || !rules.enabled) return refused("disabled");
  if (available <= 0) return refused("no_coins");
  if (input.codeApplied && !rules.combinableWithDiscountCodes) {
    return refused("code_applied");
  }
  if (rules.minOrderValue && goods < rules.minOrderValue) {
    return refused("below_min_order");
  }
  if (rules.minCoins && available < rules.minCoins) {
    return refused("below_min_coins");
  }
  const percent = rules.percentPerCoin;
  let maxCoins = Math.min(available, rules.maxCoinsPerOrder ?? available);
  const cap = Math.min(goods, rules.maxDiscount ?? goods);
  maxCoins = coinsWithin(goods, cap, percent, maxCoins);
  const maxAmount = discountFor(goods, maxCoins, percent);
  if (maxAmount <= 0) return refused("too_small");
  maxCoins = coinsNeededFor(goods, maxAmount, percent, maxCoins) ?? maxCoins;
  if (rules.minRedeemValue && maxAmount < rules.minRedeemValue) {
    return { ...refused("below_min_value"), maxCoins, maxAmount };
  }
  if (requested === 0) {
    return { ...refused("disabled"), reason: null, maxCoins, maxAmount };
  }
  if (requested !== null && requested > available) {
    return { ...refused("insufficient"), maxCoins, maxAmount };
  }
  let coins = requested === null ? maxCoins : Math.min(requested, maxCoins);
  const amount = discountFor(goods, coins, percent);
  if (amount <= 0) return { ...refused("too_small"), maxCoins, maxAmount };
  if (rules.minRedeemValue && amount < rules.minRedeemValue) {
    return { ...refused("below_min_value"), maxCoins, maxAmount };
  }
  coins = coinsNeededFor(goods, amount, percent, coins) ?? coins;
  return {
    requested,
    coins,
    amount,
    applied: true,
    reason: null,
    maxCoins,
    maxAmount,
  };
}

function campaignActive(
  campaign: RewardsSettings["earning"]["campaign"],
  at: Date,
): boolean {
  if (!campaign.enabled || campaign.multiplier <= 0) return false;
  if (campaign.startsAt && new Date(campaign.startsAt) > at) return false;
  if (campaign.endsAt && new Date(campaign.endsAt) <= at) return false;
  return true;
}

/** Coins per euro of goods at this moment: the rate, times the campaign. */
export function earningRateAt(settings: RewardsSettings, at: Date): number {
  const order = settings.earning.order;
  if (!settings.enabled || !order.enabled || order.coinsPerEuro <= 0) return 0;
  return campaignActive(settings.earning.campaign, at)
    ? order.coinsPerEuro * settings.earning.campaign.multiplier
    : order.coinsPerEuro;
}

/** Coins for goods worth `goodsPaid` cents at `rate` coins per euro, rounded. */
export function coinsAtRate(goodsPaid: number, rate: number): number {
  if (goodsPaid <= 0 || rate <= 0) return 0;
  const scaled = Math.round(rate * 10_000);
  return Math.round((goodsPaid * scaled) / 1_000_000);
}

/** When a balance that has not moved since `lastActivityAt` expires, or null. */
function expiresAt(
  lastActivityAt: string | null,
  settings: RewardsSettings,
): string | null {
  const expiry = settings.expiry;
  if (
    !lastActivityAt ||
    !settings.enabled ||
    !expiry.enabled ||
    expiry.inactivityMonths <= 0
  ) {
    return null;
  }
  const date = new Date(lastActivityAt);
  date.setUTCMonth(date.getUTCMonth() + expiry.inactivityMonths);
  return date.toISOString();
}

// --- The ledger (doc/REWARDS.md 4) ------------------------------------------

/** The account of a customer, made on first use. */
export function accountOf(customerId: string): RewardAccountRecord {
  let account = db.rewardAccounts.get(customerId);
  if (!account) {
    account = {
      customerId,
      available: 0,
      reserved: 0,
      earned: 0,
      redeemed: 0,
      lastActivityAt: null,
    };
    db.rewardAccounts.set(customerId, account);
  }
  return account;
}

interface Movement {
  customerId: string;
  type: RewardTransactionType;
  coins: number;
  key: string;
  orderNumber?: string | null;
  reference?: string | null;
  rate?: number | null;
  reason?: string | null;
  note?: string | null;
  at?: string;
}

/**
 * Writes one movement and changes the balance with it. A key that exists
 * means the movement was made before: nothing happens and null is answered.
 */
export function move(movement: Movement): RewardTransactionRecord | null {
  if (db.rewardTransactions.some((row) => row.key === movement.key)) {
    return null;
  }
  const at = movement.at ?? new Date().toISOString();
  const row: RewardTransactionRecord = {
    id: `66fc${randomBytes(10).toString("hex")}`,
    customerId: movement.customerId,
    type: movement.type,
    coins: movement.coins,
    state: "done",
    key: movement.key,
    orderNumber: movement.orderNumber ?? null,
    reference: movement.reference ?? null,
    rate: movement.rate ?? null,
    reason: movement.reason ?? null,
    note: movement.note ?? null,
    at,
  };
  db.rewardTransactions.push(row);
  const account = accountOf(movement.customerId);
  account.available += movement.coins;
  if (movement.coins > 0 && movement.type !== "redeem_return") {
    account.earned += movement.coins;
  }
  account.lastActivityAt = at;
  return row;
}

/** Takes back what a row gave, once. */
function reverseKey(key: string, reversalKey: string): void {
  const given = db.rewardTransactions.find((row) => row.key === key);
  if (!given || given.coins <= 0) return;
  move({
    customerId: given.customerId,
    type: "reversal",
    coins: -given.coins,
    key: reversalKey,
    orderNumber: given.orderNumber,
    reference: given.reference,
  });
}

// --- Earning ------------------------------------------------------------------

/**
 * The welcome coins of a verified sign-up, once per email address even
 * after the account was closed and made again. Answers the coins given,
 * 0 when the rule is off or the address had them before.
 */
export function grantWelcome(customer: CustomerRecord): number {
  const { settings } = rewards;
  const rule = settings.earning.welcome;
  if (!settings.enabled || !rule.enabled || rule.coins <= 0) return 0;
  const hash = createHash("sha256")
    .update(`welcome:${customer.email.toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
  const row = move({
    customerId: customer.id,
    type: "welcome",
    coins: rule.coins,
    key: `welcome:${hash}`,
  });
  return row ? row.coins : 0;
}

/** The order was delivered: it earns coins on the goods paid for, once. */
export function earnOnDelivery(order: OrderRecord, at = new Date()): void {
  const rate = earningRateAt(rewards.settings, at);
  const totals = order.totals;
  const goodsPaid = Math.max(
    0,
    totals.subtotal - totals.discount - (totals.rewards ?? 0),
  );
  const coins = coinsAtRate(goodsPaid, rate);
  if (coins <= 0) return;
  move({
    customerId: order.customerId,
    type: "order",
    coins,
    key: `order:${order.orderNumber}`,
    orderNumber: order.orderNumber,
    rate,
    at: at.toISOString(),
  });
}

/** The admin published a review: coins for the reviewer, once per review. */
export function grantReview(review: ReviewRecord): void {
  const { settings } = rewards;
  const rule = settings.earning.review;
  if (!settings.enabled || !rule.enabled || rule.coins <= 0) return;
  move({
    customerId: review.customerId,
    type: "review",
    coins: rule.coins,
    key: `review:${review.id}`,
    orderNumber: review.orderNumber,
    reference: review.id,
  });
}

/** The review was rejected or deleted afterwards: its coins come back. */
export function revokeReview(review: ReviewRecord): void {
  reverseKey(`review:${review.id}`, `reversal:review:${review.id}`);
}

/** By hand, by the admin (a test control here). */
export function adjust(
  customer: CustomerRecord,
  coins: number,
  reason: "goodwill" | "correction" | "misuse" | "other",
  note: string | null,
): RewardTransactionRecord | null {
  return move({
    customerId: customer.id,
    type: "adjustment",
    coins,
    key: `adjustment:${randomBytes(6).toString("hex")}`,
    reason,
    note,
  });
}

// --- Redeeming on the bill (doc/REWARDS.md 3 and 5) ---------------------------

/**
 * The coins on a customer's bill: what the chosen coins take off, or why
 * not, the most this cart allows, and what the order will earn at
 * delivery. The discount is spread over the orderable lines in proportion
 * to their value (after the code), the cents that rounding leaves going
 * to the lines with the largest remainders. `lineTotal` and the VAT of the
 * lines are changed in place, like the discount code does it.
 */
export function redeemOnBill(
  customer: Pick<CustomerRecord, "id" | "rewardCoins">,
  lines: BillLine[],
  codeApplied: boolean,
  now = new Date(),
): BillRewards {
  const { settings } = rewards;
  const orderable = lines.filter((line) => line.issue === null);
  const goods = orderable.reduce((sum, line) => sum + line.lineTotal, 0);
  const requested =
    customer.rewardCoins === null ? 0 : customer.rewardCoins.requested;
  const redemption = redemptionOf({
    goods,
    available: Math.max(0, accountOf(customer.id).available),
    requested,
    codeApplied,
    settings,
  });
  if (redemption.applied && redemption.amount > 0 && goods > 0) {
    const remainders: { line: BillLine; remainder: number }[] = [];
    let given = 0;
    for (const line of orderable) {
      const exact = (redemption.amount * line.lineTotal) / goods;
      const share = Math.floor(exact);
      line.rewardAmount = share;
      remainders.push({ line, remainder: exact - share });
      given += share;
    }
    remainders.sort((a, b) => b.remainder - a.remainder);
    for (
      let left = redemption.amount - given, i = 0;
      left > 0;
      left -= 1, i += 1
    ) {
      remainders[i % remainders.length].line.rewardAmount! += 1;
    }
    for (const line of orderable) line.lineTotal -= line.rewardAmount ?? 0;
  }
  return {
    ...redemption,
    earn: coinsAtRate(goods - redemption.amount, earningRateAt(settings, now)),
  };
}

/** `400 REWARDS_NOT_APPLICABLE` with the reason, as the API answers it. */
export function notApplicable(
  reason: RewardsReason,
  status: 400 | 409 = 400,
): HttpError {
  return new HttpError(
    status,
    "REWARDS_NOT_APPLICABLE",
    REDEMPTION_MESSAGES[reason],
    { reason },
  );
}

const REDEMPTION_MESSAGES: Record<RewardsReason, string> = {
  disabled: "Coins cannot be redeemed at the moment.",
  no_coins: "You have no coins to redeem.",
  below_min_coins: "You do not have enough coins to redeem yet.",
  below_min_order: "The goods in the cart are worth less than coins require.",
  below_min_value: "Your coins are not worth enough yet to be redeemed.",
  code_applied: "Coins cannot be combined with a discount code.",
  too_small: "These coins would take nothing off this order.",
  insufficient: "You do not have that many coins.",
};

// --- The order's life -----------------------------------------------------------

/** The order is made: the coins are held for it (balance − coins). */
export function reserveCoins(order: OrderRecord): void {
  if (!order.rewards || order.rewards.coins <= 0) return;
  const account = accountOf(order.customerId);
  const coins = order.rewards.coins;
  const row = move({
    customerId: order.customerId,
    type: "redeem",
    coins: -coins,
    key: `redeem:${order.orderNumber}`,
    orderNumber: order.orderNumber,
  });
  if (row) row.state = "reserved";
  account.reserved += coins;
}

/** The order was paid: the coins are spent. */
export function spendCoins(order: OrderRecord): void {
  if (order.rewards?.state !== "reserved") return;
  const account = accountOf(order.customerId);
  const coins = order.rewards.coins;
  account.reserved = Math.max(0, account.reserved - coins);
  account.redeemed += coins;
  account.lastActivityAt = new Date().toISOString();
  const row = db.rewardTransactions.find(
    (entry) => entry.key === `redeem:${order.orderNumber}`,
  );
  if (row) row.state = "spent";
  order.rewards.state = "used";
}

/** The order was never paid and is given up: the coins come back. */
export function releaseCoins(order: OrderRecord): void {
  if (order.rewards?.state !== "reserved") return;
  const account = accountOf(order.customerId);
  const coins = order.rewards.coins;
  account.reserved = Math.max(0, account.reserved - coins);
  account.available += coins;
  const row = db.rewardTransactions.find(
    (entry) => entry.key === `redeem:${order.orderNumber}`,
  );
  if (row) row.state = "released";
  order.rewards.state = "released";
}

/**
 * Goods were credited after the payment (a return completed): the share of
 * the coin discount on those goods comes back (`redeem_return`), and the
 * coins the order earned shrink to what is paid for now (`reversal`), each
 * once per credit (REWARDS 3).
 */
export function creditCoins(
  order: OrderRecord,
  unusedCents: number,
  reference: string,
  finalTotals?: { subtotal: number; discount: number; rewards?: number },
): void {
  if (order.rewards && order.rewards.state === "used" && unusedCents > 0) {
    const out = db.rewardTransactions
      .filter(
        (row) =>
          row.orderNumber === order.orderNumber &&
          (row.type === "redeem" || row.type === "redeem_return"),
      )
      .reduce((sum, row) => sum - row.coins, 0);
    const back = Math.min(
      Math.max(0, out),
      Math.round((order.rewards.coins * unusedCents) / order.rewards.amount),
    );
    if (back > 0) {
      move({
        customerId: order.customerId,
        type: "redeem_return",
        coins: back,
        key: `redeem_return:${order.orderNumber}:${reference}`,
        orderNumber: order.orderNumber,
        reference,
      });
    }
  }
  const earned = db.rewardTransactions.find(
    (row) => row.key === `order:${order.orderNumber}`,
  );
  if (earned && finalTotals) {
    const paidNow = Math.max(
      0,
      finalTotals.subtotal - finalTotals.discount - (finalTotals.rewards ?? 0),
    );
    const reversed = db.rewardTransactions
      .filter(
        (row) =>
          row.type === "reversal" &&
          row.key.startsWith(`reversal:order:${order.orderNumber}:`),
      )
      .reduce((sum, row) => sum - row.coins, 0);
    const target = coinsAtRate(paidNow, earned.rate ?? 0);
    const take = earned.coins - reversed - target;
    if (take > 0) {
      move({
        customerId: order.customerId,
        type: "reversal",
        coins: -take,
        key: `reversal:order:${order.orderNumber}:${reference}`,
        orderNumber: order.orderNumber,
        reference,
        rate: earned.rate,
      });
    }
  }
}

// --- Views (doc/REWARDS.md 5) ---------------------------------------------------

export function programView(
  settings = rewards.settings,
  now = new Date(),
): RewardsProgram {
  const { earning, redemption, expiry } = settings;
  const campaign = earning.campaign;
  const rate = earningRateAt(settings, now);
  return {
    enabled: settings.enabled,
    earning: {
      order: earning.order.enabled
        ? { coinsPerEuro: earning.order.coinsPerEuro }
        : null,
      welcome: earning.welcome.enabled ? earning.welcome.coins : null,
      referral: {
        inviter: earning.referral.inviter.enabled
          ? earning.referral.inviter.coins
          : null,
        invitee: earning.referral.invitee.enabled
          ? earning.referral.invitee.coins
          : null,
      },
      review: earning.review.enabled ? earning.review.coins : null,
      campaign:
        campaign.enabled && rate > 0
          ? {
              name: campaign.name,
              multiplier: campaign.multiplier,
              startsAt: campaign.startsAt,
              endsAt: campaign.endsAt,
              active: rate !== earning.order.coinsPerEuro,
            }
          : null,
    },
    redemption: redemption.enabled
      ? {
          percentPerCoin: redemption.percentPerCoin,
          minCoins: redemption.minCoins,
          minRedeemValue: redemption.minRedeemValue,
          minOrderValue: redemption.minOrderValue,
          maxCoinsPerOrder: redemption.maxCoinsPerOrder,
          maxDiscount: redemption.maxDiscount,
          combinableWithDiscountCodes: redemption.combinableWithDiscountCodes,
        }
      : null,
    expiry: expiry.enabled
      ? { inactivityMonths: expiry.inactivityMonths }
      : null,
  };
}

function accountView(account: RewardAccountRecord): RewardsAccount {
  return {
    available: Math.max(0, account.available),
    balance: account.available,
    reserved: account.reserved,
    earnedTotal: account.earned,
    redeemedTotal: account.redeemed,
    lastActivityAt: account.lastActivityAt,
    expiresAt: expiresAt(account.lastActivityAt, rewards.settings),
  };
}

/** `GET /v1/store/me/rewards`. */
export function myRewards(customer: CustomerRecord): MyRewards {
  const { settings } = rewards;
  const account = accountOf(customer.id);
  const rules = settings.redemption;
  const reason =
    !settings.enabled || !rules.enabled
      ? "disabled"
      : account.available <= 0
        ? "no_coins"
        : rules.minCoins && account.available < rules.minCoins
          ? "below_min_coins"
          : null;
  return {
    account: accountView(account),
    canRedeem: reason === null,
    reason,
    program: programView(settings),
  };
}

/** `GET /v1/store/me/overview`: the tile. */
export function overviewRewards(customer: CustomerRecord) {
  return {
    enabled: rewards.settings.enabled,
    available: Math.max(0, accountOf(customer.id).available),
  };
}

function transactionView(row: RewardTransactionRecord): RewardTransaction {
  return {
    id: row.id,
    type: row.type,
    coins: row.coins,
    state: row.state,
    orderNumber: row.orderNumber,
    reference: row.reference,
    reason: row.reason,
    at: row.at,
  };
}

/**
 * `GET /v1/store/me/rewards/transactions`: newest first; the coins of
 * orders that were given up are left out.
 */
export function historyOf(
  customer: CustomerRecord,
  page: number,
  limit: number,
): Page<RewardTransaction> {
  // Newest first; two movements of the same millisecond (a return and its
  // reversal) keep the order they were written in, the later one first.
  const rows = db.rewardTransactions
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row }) => row.customerId === customer.id && row.state !== "released",
    )
    .sort(
      (a, b) =>
        Date.parse(b.row.at) - Date.parse(a.row.at) || b.index - a.index,
    )
    .map(({ row }) => row);
  const start = (page - 1) * limit;
  return {
    items: rows.slice(start, start + limit).map(transactionView),
    page,
    limit,
    total: rows.length,
    totalPages: Math.max(1, Math.ceil(rows.length / limit)),
  };
}
