"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ChevronDown,
  CircleCheck,
  CircleUser,
  Coins,
  Lock,
  Mail,
  MapPin,
  Plus,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { BillTotals } from "@/components/cart/bill-summary";
import { BoxShipping } from "@/components/cart/box-shipping";
import { PaymentMarks } from "@/components/catalogue/payment-marks";
import { ProductImage } from "@/components/catalogue/product-image";
import { Alert } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { TextField } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { OVERVIEW_QUERY_KEY } from "@/features/account/overview";
import { checkEmail, normalizeEmail } from "@/features/auth/validation";
import { cartQueryKey, useCart } from "@/features/cart/cart";
import { saleSavingsOf } from "@/features/cart/savings";
import { freeDeliveryCodeOf, lostFreeBoxes } from "@/features/cart/shipping";
import {
  addressToFormValues,
  toAddressInput,
  toGuestAddressInput,
  type AddressFormValues,
} from "@/features/checkout/address-schema";
import { ADDRESSES_QUERY_KEY, orderQueryKey } from "@/features/orders/orders";
import { isSafePaymentUrl } from "@/features/orders/payment-url";
import { SESSION_QUERY_KEY, useSession } from "@/features/session/session";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { ApiError, hasErrorCode } from "@/lib/api/errors";
import type {
  Address,
  Bill,
  CartItemInput,
  CartLineIssue,
  DiscountReason,
  Id,
  RewardsReason,
} from "@/lib/api/types";
import {
  checkoutKey,
  clearCheckoutKey,
  consentVersions,
} from "@/lib/checkout/order-attempt";
import { cn } from "@/lib/cn";
import { formatDiscount, formatMoney } from "@/lib/format/money";
import { LEGAL_HREF } from "@/lib/legal/pages";
import { rememberGuestToken } from "@/lib/orders/guest-token";
import { AddressForm, type AddressFormHandle } from "./address-form";
import { DiscountCode } from "./discount-code";
import { RedeemCoins } from "./redeem-coins";
import { productTitle } from "@/lib/format/product-name";

function AddressLines({ address }: { address: Address }) {
  return (
    <>
      <span className="font-bold">
        {address.firstName} {address.lastName}
      </span>
      {address.company && <span>{address.company}</span>}
      <span>
        {address.street} {address.houseNumber}
      </span>
      {address.additionalLine && <span>{address.additionalLine}</span>}
      <span>
        {address.postalCode} {address.city}
      </span>
    </>
  );
}

/**
 * The lines of the order, the way the Shopify checkouts set them (owner,
 * 2026-10-22): each as a small picture with the quantity on its corner,
 * the name, the price per pack (the regular price struck through and the
 * saving when reduced) and the line total; about five lines show at once
 * and the rest scroll inside the list. While the list holds more than it
 * shows, its lower edge fades out and a quiet line under it says to
 * scroll; both go as soon as the customer scrolls (owner, 2026-10-28).
 */
function OrderLines({ bill }: { bill: Bill }) {
  const t = useTranslations("checkout");
  const tProduct = useTranslations("product");
  const locale = useLocale() as Locale;
  const list = useRef<HTMLUListElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Whether the list holds more than it shows; asked again when the lines
  // or the width change.
  useEffect(() => {
    const element = list.current;
    if (!element) return;
    const measure = () =>
      setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [bill.lines.length]);

  const hint = overflows && !scrolled;
  return (
    // The first line keeps room above it for the count on its picture.
    <div className="mt-2.5">
      <div className="relative">
        <ul
          ref={list}
          // A box that scrolls must be reachable without a mouse.
          tabIndex={0}
          aria-labelledby="checkout-summary"
          onScroll={(event) => {
            if (event.currentTarget.scrollTop > 4) setScrolled(true);
          }}
          className="divide-ink/8 -mr-3 max-h-[21rem] scrollbar-thin divide-y overflow-y-auto scroll-smooth pr-3"
        >
          {bill.lines.map((line) => {
            // A reduced size shows what is paid per pack and the regular price.
            const reduced =
              line.product !== null &&
              line.unitPrice < line.product.pricing.regularPrice;
            const percent = line.product?.pricing.discountPercent ?? 0;
            return (
              <li
                key={line.variantId}
                className="flex items-center gap-3.5 py-3 first:pt-2 last:pb-0"
              >
                <span className="relative shrink-0">
                  <span className="ring-ink/6 block size-14 overflow-hidden rounded-lg bg-white p-1 ring-1">
                    <ProductImage
                      image={line.product?.image ?? null}
                      alt=""
                      sizes="56px"
                      fallbackLabel=""
                    />
                  </span>
                  <span
                    aria-hidden="true"
                    className="bg-wheat-400 text-ink absolute -top-1.5 -right-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.6875rem] leading-none font-bold tabular-nums ring-2 ring-white"
                  >
                    {line.quantity}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[0.9375rem] leading-snug font-semibold">
                    <span className="sr-only">
                      {t("quantityTimes", { quantity: line.quantity })}{" "}
                    </span>
                    {line.product
                      ? productTitle(line.product.name, line.product.packSize)
                      : line.variantId}
                  </span>
                  <span className="text-ink-muted flex flex-wrap items-center gap-x-1.5 text-sm tabular-nums">
                    {reduced && (
                      <span className="sr-only">
                        {tProduct("currentPrice")}:{" "}
                      </span>
                    )}
                    <span>{formatMoney(line.unitPrice, locale)}</span>
                    {reduced && (
                      <>
                        <span className="sr-only">
                          {tProduct("regularPrice")}:
                        </span>
                        <s className="text-ink-subtle">
                          {formatMoney(
                            line.product!.pricing.regularPrice,
                            locale,
                          )}
                        </s>
                        {percent > 0 && (
                          <span className="text-xs font-bold text-red-600">
                            {formatDiscount(percent, locale)}
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </span>
                <span className="shrink-0 self-start pt-0.5 font-semibold tabular-nums">
                  {formatMoney(line.lineTotal, locale)}
                </span>
              </li>
            );
          })}
        </ul>
        {/* The lower edge fades into the panel while there is more below. */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-white/90 to-transparent transition-opacity duration-200",
            hint ? "opacity-100" : "opacity-0",
          )}
        />
      </div>
      {hint && (
        <p className="text-ink-muted mt-2 flex items-center justify-center gap-1 text-xs font-semibold">
          <ChevronDown aria-hidden="true" className="size-3.5" />
          {t("scrollHint")}
        </p>
      )}
    </div>
  );
}

/** Why the shop cannot sell right now: not the customer's doing (doc 14). */
type Unavailable = "payments" | "shop";

/**
 * A visitor at the checkout chooses (doc 20): sign in, create an account,
 * or order as a guest with an email address alone.
 */
function GuestChooser({ onGuest }: { onGuest: () => void }) {
  const t = useTranslations("checkout");
  return (
    <section
      aria-labelledby="checkout-choose"
      className="glass-strong shadow-float animate-rise mx-auto flex max-w-xl flex-col gap-5 rounded-2xl p-6 sm:p-8"
    >
      <h2 id="checkout-choose" className="font-display text-ink text-2xl">
        {t("guest.chooseTitle")}
      </h2>
      <p className="text-ink-muted">{t("guest.chooseText")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href={{ pathname: "/sign-in", query: { returnTo: "/checkout" } }}
          className={buttonStyles({ size: "lg", className: "flex-1" })}
        >
          {t("guest.signIn")}
        </Link>
        <Button
          variant="secondary"
          size="lg"
          className="flex-1"
          onClick={onGuest}
        >
          {t("guest.continue")}
        </Button>
      </div>
      <p className="text-ink-muted text-center text-sm">
        {t("guest.noAccount")}{" "}
        <Link
          href={{ pathname: "/sign-up", query: { returnTo: "/checkout" } }}
          className="text-leaf-700 rounded-xs font-semibold underline underline-offset-4"
        >
          {t("guest.createAccount")}
        </Link>
      </p>
    </section>
  );
}

/** A `DISCOUNT_NOT_APPLICABLE` as the API would answer it, from a preview that says so. */
function refusedDiscount(bill: Bill): ApiError | null {
  if (!bill.discount || bill.discount.applied) return null;
  return new ApiError({
    status: 400,
    code: "DISCOUNT_NOT_APPLICABLE",
    message: "This discount code cannot be applied.",
    details: { code: bill.discount.code, reason: bill.discount.reason },
  });
}

/**
 * The checkout (owner, 2026-11-24, after the checkout design "Liquid
 * Glass" of the lab): who orders and where it goes as two frosted panels,
 * the order as a frosted summary beside them with the consent to the exact
 * versions of the legal texts and the one button that places the order and
 * leads to the payment page; under the summary the boxes of the order, and
 * below `lg` the total with that button as a pill at the foot of the
 * screen. For
 * a customer the order is made of the cart stored by the API; this page
 * sends the address, the consent and the total the customer saw (doc 9).
 * A visitor may order as a guest (doc 20): the email address first, then
 * the address, typed into the page and sent with the order alone (no
 * label, nothing saved; owner, 2026-11-17), the cart of the browser priced
 * by the preview (with a discount code, if any), and the order made by the
 * guest checkout with the token that opens it afterwards. Either way the
 * browser goes to `checkout.url`.
 */
export function CheckoutView({
  deliveryEstimate,
  boxBased = false,
}: {
  /** `delivery.estimate` of the settings in the page's language, or `null`. */
  deliveryEstimate: string | null;
  /** `shipping.boxBased` of the settings: only sizes the placeholder. */
  boxBased?: boolean;
}) {
  const t = useTranslations("checkout");
  const tAddress = useTranslations("address");
  const tProduct = useTranslations("product");
  const tCart = useTranslations("cart");
  const tShipping = useTranslations("shipping");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const client = useQueryClient();
  const session = useSession({ force: true });
  const cart = useCart();
  const isCustomer = session.status === "customer";
  const isGuest = session.status === "guest";

  // The guest checkout (doc 20): chosen on this page, with its own email,
  // address and discount code; the cart is the browser's.
  const [guestMode, setGuestMode] = useState(false);
  const [guestEmail, setGuestEmail] = useState("");
  const [guestEmailProblem, setGuestEmailProblem] = useState<string | null>(
    null,
  );
  /** The guest's address form: read, and checked, when the order is placed. */
  const guestForm = useRef<AddressFormHandle>(null);
  const guestEmailField = useRef<HTMLInputElement>(null);
  /** A guest pressed the button with a field of the page refused. */
  const [fieldsMissing, setFieldsMissing] = useState(false);
  const [guestCode, setGuestCode] = useState<string | null>(null);
  const consentBox = useRef<HTMLInputElement>(null);
  const addressSection = useRef<HTMLElement>(null);
  const asGuest = isGuest && guestMode;
  const guestItems: CartItemInput[] = [...cart.items];

  // Everything is asked for again when the page opens: the bill and the
  // legal versions must be the current ones.
  const ready = (isCustomer || asGuest) && cart.ready;
  // A visitor without products has no bill to ask for: the preview takes
  // 1 to 100 items (doc 8).
  const guestCartEmpty = asGuest && cart.ready && guestItems.length === 0;
  const billQuery = useQuery({
    queryKey: isCustomer
      ? cartQueryKey(locale)
      : ["cart", "preview", locale, guestItems, guestCode],
    queryFn: () =>
      isCustomer
        ? api.getCart()
        : api.previewCart(guestItems, { discountCode: guestCode ?? undefined }),
    enabled: ready && !guestCartEmpty,
    staleTime: 0,
    // A guest's code changes the key: the old bill stays until the new one is there.
    placeholderData: keepPreviousData,
  });
  const addressQuery = useQuery({
    queryKey: ADDRESSES_QUERY_KEY,
    queryFn: () => api.listAddresses(),
    enabled: ready && isCustomer,
  });
  const legalQuery = useQuery({
    queryKey: ["legal", locale],
    queryFn: () => api.listLegal(),
    enabled: ready,
    staleTime: 0,
  });

  const [chosenAddress, setChosenAddress] = useState<Id | null>(null);
  const [editing, setEditing] = useState<Id | "new" | null>(null);
  const [consent, setConsent] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<unknown>(null);
  const [totalChanged, setTotalChanged] = useState<{
    before: number;
    after: number;
  } | null>(null);
  const [legalChanged, setLegalChanged] = useState(false);
  const [unavailable, setUnavailable] = useState<Unavailable | null>(null);
  /** The lines the API refused (`ORDER_ITEMS_NOT_ORDERABLE`), by name, with why. */
  const [refusedLines, setRefusedLines] = useState<
    { name: string; issue: CartLineIssue }[]
  >([]);
  /**
   * Boxes that stopped being free when the code, or the coins, were
   * applied: both are taken off the goods before the boxes are counted
   * (doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md, 9). `0`: none, or taken
   * off the bill again.
   */
  const [boxesLostByCode, setBoxesLostByCode] = useState(0);
  const [boxesLostByCoins, setBoxesLostByCoins] = useState(0);
  /** The key was used for an order that is paid or cancelled meanwhile. */
  const [keyUsed, setKeyUsed] = useState(false);
  /** The discount code stopped applying at checkout and was removed (9.6). */
  const [discountRemoved, setDiscountRemoved] = useState<{
    code: string;
    reason: DiscountReason;
  } | null>(null);
  /** The coins stopped applying at checkout and were dropped (REWARDS 5). */
  const [rewardsRemoved, setRewardsRemoved] = useState<RewardsReason | null>(
    null,
  );

  const bill = billQuery.data;
  // A guest has the one address of the order, typed into the page.
  const addresses = isCustomer ? addressQuery.data?.items : [];
  const legal = legalQuery.data?.items;
  const loadError =
    billQuery.error ??
    (isCustomer ? addressQuery.error : null) ??
    legalQuery.error;

  if (session.status === "loading") {
    return <CheckoutSkeleton boxes={boxBased} />;
  }
  // The API could not say who is here: not the moment to offer the guest
  // checkout to someone who may well be signed in.
  if (session.error && !session.customer) {
    return (
      <ErrorAlert
        error={session.error}
        title={t("loadError")}
        onRetry={() =>
          void client.resetQueries({ queryKey: SESSION_QUERY_KEY })
        }
      />
    );
  }
  if (isGuest && !guestMode) {
    return <GuestChooser onGuest={() => setGuestMode(true)} />;
  }
  if (guestCartEmpty) return <EmptyCheckout />;
  if (loadError && (!bill || !addresses || !legal)) {
    return (
      <ErrorAlert
        error={loadError}
        title={t("loadError")}
        onRetry={() => {
          void billQuery.refetch();
          void addressQuery.refetch();
          void legalQuery.refetch();
        }}
      />
    );
  }
  if (!bill || !addresses || !legal) {
    return <CheckoutSkeleton boxes={boxBased} />;
  }

  if (bill.lines.length === 0) return <EmptyCheckout />;

  // The chosen address, or the standard one until the customer chooses.
  const selected =
    addresses.find((address) => address.id === chosenAddress) ??
    addresses.find((address) => address.isDefault) ??
    addresses[0] ??
    null;
  const showForm = editing !== null || addresses.length === 0;
  const canPlace =
    bill.canOrder && !billQuery.isFetching && unavailable === null && !keyUsed;
  const nameOf = (variantId: Id) => {
    const line = bill.lines.find((entry) => entry.variantId === variantId);
    return line?.product
      ? productTitle(line.product.name, line.product.packSize)
      : variantId;
  };

  async function saveAddress(values: AddressFormValues) {
    const input = toAddressInput(values);
    const known = new Set(addresses!.map((address) => address.id));
    const result =
      editing && editing !== "new"
        ? await api.updateAddress(editing, input)
        : await api.createAddress(input);
    client.setQueryData(ADDRESSES_QUERY_KEY, result);
    // The account's count of addresses and its standard address.
    void client.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
    const created = result.items.find((address) => !known.has(address.id));
    setChosenAddress(created?.id ?? (editing !== "new" ? editing : null));
    setEditing(null);
  }

  async function place() {
    setAttempted(true);
    // What stops the order takes the focus, or comes into view: on a
    // phone the button floats at the foot of the screen, far from the
    // field it complains about.
    let guestAddress: AddressFormValues | null = null;
    if (asGuest) {
      // A guest's address goes with the order, nowhere else: it is read
      // from its form now. A refused field shows its message.
      guestAddress = (await guestForm.current?.validate()) ?? null;
      const problem = checkEmail(guestEmail);
      setGuestEmailProblem(problem ? t("guest.emailInvalid") : null);
      setFieldsMissing(Boolean(problem) || guestAddress === null);
      if (problem) {
        // The first refused field of the page, not of the address.
        guestEmailField.current?.focus();
        return;
      }
      if (!guestAddress) return;
    } else if (!selected || showForm) {
      addressSection.current?.scrollIntoView({ block: "nearest" });
      return;
    }
    if (!consent) {
      consentBox.current?.focus();
      return;
    }
    if (!bill || !legal) return;
    setPlacing(true);
    setPlaceError(null);
    setTotalChanged(null);
    setLegalChanged(false);
    setRefusedLines([]);
    setDiscountRemoved(null);
    setRewardsRemoved(null);
    try {
      const consentInput = {
        accepted: true as const,
        versions: consentVersions(legal),
      };
      // What this order is made from: a retry of the same order uses the
      // same key, a changed one a key of its own.
      const lines = bill.lines.map((line) => [line.variantId, line.quantity]);
      // The total the customer sees right now, with the discount code
      // taken off. If the bill changed since, the API refuses and answers
      // with the new one.
      let result;
      if (asGuest) {
        const request = {
          email: normalizeEmail(guestEmail),
          items: guestItems,
          address: toGuestAddressInput(guestAddress!),
          ...(guestCode && { discountCode: guestCode }),
          expectedTotal: bill.totals.total,
          consent: consentInput,
          language: locale,
        };
        result = await api.guestCheckout(
          request,
          checkoutKey({ request, lines }),
        );
      } else {
        const request = {
          addressId: selected!.id,
          expectedTotal: bill.totals.total,
          consent: consentInput,
          language: locale,
        };
        result = await api.checkout(request, checkoutKey({ request, lines }));
      }
      // An order answered: this attempt is over, the next gets a new key.
      clearCheckoutKey();
      const { orderNumber } = result.order;
      if ("token" in result && typeof result.token === "string") {
        // The key to the guest order, for this tab; the emails carry it too.
        rememberGuestToken(orderNumber, result.token);
        client.setQueryData(
          orderQueryKey(orderNumber, locale, "guest"),
          result.order,
        );
      } else {
        client.setQueryData(orderQueryKey(orderNumber, locale), result.order);
      }
      if (!isSafePaymentUrl(result.checkout.url)) {
        throw new ApiError({
          status: 502,
          code: "PAYMENT_PROVIDER_ERROR",
          message: "The payment page has an address that is not accepted.",
        });
      }
      // Leaves the shop for the payment page; Stripe brings the customer
      // back to the order with `?payment=success` or `?payment=cancelled`.
      window.location.assign(result.checkout.url);
    } catch (error) {
      setPlacing(false);
      if (hasErrorCode(error, "CUSTOMER_EMAIL_TAKEN")) {
        // The address has an account: the sign-in, with the address filled
        // in; the cart stays in the browser and comes along (doc 20).
        router.push({
          pathname: "/sign-in",
          query: { returnTo: "/checkout", email: normalizeEmail(guestEmail) },
        });
      } else if (hasErrorCode(error, "ORDER_TOTAL_CHANGED")) {
        setTotalChanged({
          before: error.details.expectedTotal,
          after: error.details.total,
        });
        void billQuery.refetch();
      } else if (hasErrorCode(error, "LEGAL_VERSION_CHANGED")) {
        setLegalChanged(true);
        setConsent(false);
        setAttempted(false);
        void legalQuery.refetch();
      } else if (hasErrorCode(error, "ORDER_ITEMS_NOT_ORDERABLE")) {
        setRefusedLines(
          error.details.lines.map((line) => ({
            name: nameOf(line.variantId),
            issue: line.issue,
          })),
        );
        void billQuery.refetch();
      } else if (hasErrorCode(error, "DISCOUNT_NOT_APPLICABLE")) {
        // The code stopped applying; the API took it off the cart. The bill
        // is loaded again and the customer may order without it.
        setDiscountRemoved({
          code: error.details.code,
          reason: error.details.reason,
        });
        setGuestCode(null);
        void billQuery.refetch();
      } else if (hasErrorCode(error, "REWARDS_NOT_APPLICABLE")) {
        // The coins stopped applying (the balance shrank, the rules
        // changed); the API dropped them from the cart. The bill is loaded
        // again and the customer may order without them.
        setRewardsRemoved(error.details.reason);
        void billQuery.refetch();
      } else if (hasErrorCode(error, "PAYMENTS_NOT_CONFIGURED")) {
        setUnavailable("payments");
      } else if (
        hasErrorCode(error, "COMPANY_DETAILS_MISSING") ||
        hasErrorCode(error, "LEGAL_DOCUMENTS_MISSING")
      ) {
        setUnavailable("shop");
      } else if (hasErrorCode(error, "ORDER_NOT_PAYABLE")) {
        // The first order of this key was paid or given up meanwhile.
        clearCheckoutKey();
        setKeyUsed(true);
      } else {
        setPlaceError(error);
        // The cart or the addresses are not what this page shows any more.
        void billQuery.refetch();
        if (hasErrorCode(error, "ADDRESS_NOT_FOUND")) {
          void addressQuery.refetch();
        }
      }
    }
  }

  const link = "font-semibold text-leaf-700 underline underline-offset-4";
  const itemCount = bill.lines.reduce((sum, line) => sum + line.quantity, 0);
  // Delivery by the box; `null` (or absent, from an older API): the flat
  // fee, and the summary of before.
  const shipping = bill.shipping ?? null;
  const freeDeliveryCode = freeDeliveryCodeOf(bill);
  // What a discount cost in free boxes is said while it is on the bill and
  // a box is paid; the amount is the bill's own, never a remembered one.
  const missingForBox =
    shipping && shipping.paidBoxes > 0 ? shipping.missingForNextFreeBox : null;
  const lostByCode =
    bill.discount?.applied && missingForBox !== null ? boxesLostByCode : 0;
  const lostByCoins =
    bill.rewards?.applied && missingForBox !== null ? boxesLostByCoins : 0;

  // A guest prices a code with the preview (doc 20): a bill whose code
  // does not apply is refused the way the account's cart would refuse it.
  async function applyGuestCode(code: string): Promise<Bill> {
    const next = await api.previewCart(guestItems, { discountCode: code });
    const refused = refusedDiscount(next);
    if (refused) throw refused;
    setGuestCode(next.discount?.code ?? code);
    return next;
  }
  async function removeGuestCode(): Promise<Bill> {
    setGuestCode(null);
    return api.previewCart(guestItems);
  }

  /** The one button of the page; the legal wording is its label. */
  const placeButton = (size: "sm" | "lg", className?: string) => (
    <Button
      size={size}
      block={size === "lg"}
      loading={placing}
      disabled={!canPlace}
      onClick={() => void place()}
      className={className}
    >
      {!placing && (
        <Lock
          aria-hidden="true"
          className="size-[1.125rem] shrink-0"
          strokeWidth={2.25}
        />
      )}
      {placing ? t("placing") : t("place")}
    </Button>
  );
  const customer = session.customer;
  const customerName = customer
    ? [customer.firstName, customer.lastName].filter(Boolean).join(" ")
    : "";

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_26.875rem] lg:gap-6">
      {/* Who orders, and where it goes: a frosted panel each (owner,
          2026-11-24, after the checkout design "Liquid Glass" of the lab). */}
      <div className="grid min-w-0 gap-5">
        {asGuest ? (
          <Panel
            icon={Mail}
            titleId="checkout-email"
            title={t("guest.emailTitle")}
          >
            <TextField
              id="checkout-guest-email"
              look="float"
              label={t("guest.email")}
              hint={t("guest.emailIntro")}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              inputRef={guestEmailField}
              value={guestEmail}
              onChange={(event) => {
                setGuestEmail(event.target.value);
                setGuestEmailProblem(null);
              }}
              error={guestEmailProblem}
            />
            <p className="text-ink-muted text-sm">
              {t("guest.haveAccount")}{" "}
              <Link
                href={{
                  pathname: "/sign-in",
                  query: { returnTo: "/checkout" },
                }}
                className={cn(link, "rounded-xs")}
              >
                {t("guest.signIn")}
              </Link>
            </p>
          </Panel>
        ) : (
          customer && (
            <Panel
              icon={CircleUser}
              titleId="checkout-account"
              title={t("accountTitle")}
            >
              <div className="flex items-center gap-3 rounded-md bg-white/70 px-3.5 py-3 shadow-[0_0_0_1px_rgb(23_33_27/0.08)]">
                <span
                  aria-hidden="true"
                  className="bg-leaf-50 text-leaf-700 grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold uppercase"
                >
                  {(customerName || customer.email)
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part.charAt(0))
                    .join("")}
                </span>
                <p className="flex min-w-0 flex-1 flex-col leading-snug">
                  {customerName && (
                    <span className="truncate font-bold">{customerName}</span>
                  )}
                  <span className="text-ink-muted truncate text-[0.84375rem]">
                    {customer.email}
                  </span>
                </p>
                <span className="text-leaf-700 flex shrink-0 items-center gap-1.5 text-[0.8125rem] font-semibold">
                  <CircleCheck
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={2.25}
                  />
                  {t("signedIn")}
                </span>
              </div>
            </Panel>
          )
        )}

        <Panel
          icon={MapPin}
          titleId="checkout-address"
          title={t("addressTitle")}
          note={tAddress("germany")}
          delay={60}
          sectionRef={addressSection}
        >
          <p className="sr-only">{t("addressIntro")}</p>
          {asGuest ? (
            // A guest's address goes with the order, nowhere else: no
            // label, nothing to save (owner, 2026-11-17). The form is read
            // when the order is placed.
            <AddressForm
              idPrefix="checkout-address"
              mode="order"
              look="float"
              handle={guestForm}
            />
          ) : (
            <div className="grid gap-3.5">
              {addresses.length > 0 && !showForm && (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {addresses.map((address) => {
                    const checked = address.id === selected?.id;
                    const name = `${address.firstName} ${address.lastName}`;
                    return (
                      <li key={address.id} className="relative">
                        <label
                          className={cn(
                            "ease-glass flex h-full cursor-pointer gap-3 rounded-md border-[1.5px] p-4 pr-20 transition-[background-color,border-color,box-shadow] duration-200",
                            checked
                              ? "border-leaf-600 bg-leaf-50/90 shadow-[0_0_0_4px_rgb(21_122_75/0.12)]"
                              : "border-transparent bg-white/70 shadow-[0_0_0_1px_rgb(23_33_27/0.08)] hover:bg-white hover:shadow-[0_0_0_1px_rgb(23_33_27/0.16)]",
                          )}
                        >
                          <input
                            type="radio"
                            name="delivery-address"
                            className="accent-leaf-600 mt-1 size-5 shrink-0"
                            checked={checked}
                            onChange={() => setChosenAddress(address.id)}
                          />
                          <span className="flex min-w-0 flex-col text-[0.9375rem]">
                            {address.label && (
                              <span className="text-ink-subtle mb-0.5 text-xs font-bold tracking-[0.1em] uppercase">
                                {address.label}
                              </span>
                            )}
                            <AddressLines address={address} />
                            {address.isDefault && (
                              <span className="text-ink-muted mt-1 text-sm">
                                {tAddress("default")}
                              </span>
                            )}
                          </span>
                        </label>
                        <button
                          type="button"
                          aria-label={tAddress("editNamed", { name })}
                          onClick={() => setEditing(address.id)}
                          className={cn(
                            link,
                            "absolute top-3 right-4 min-h-11",
                          )}
                        >
                          {tAddress("edit")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {showForm ? (
                <div className="animate-rise grid gap-3.5">
                  <p className="font-bold">
                    {editing && editing !== "new"
                      ? tAddress("editTitle")
                      : tAddress("new")}
                  </p>
                  <AddressForm
                    key={editing ?? "first"}
                    idPrefix="checkout-address"
                    look="float"
                    initial={
                      editing && editing !== "new"
                        ? addressToFormValues(
                            addresses.find(
                              (address) => address.id === editing,
                            )!,
                          )
                        : undefined
                    }
                    showDefault={addresses.length > 0}
                    onSave={saveAddress}
                    onCancel={
                      addresses.length > 0 ? () => setEditing(null) : undefined
                    }
                  />
                </div>
              ) : (
                addresses.length < 10 && (
                  <Button
                    variant="secondary"
                    onClick={() => setEditing("new")}
                    className="justify-self-start"
                  >
                    <Plus aria-hidden="true" className="size-5" />
                    {tAddress("add")}
                  </Button>
                )
              )}
            </div>
          )}
        </Panel>
      </div>

      {/* The order: the lines, the delivery estimate, the discount code
          and the coins, the totals, the consent, the button and the
          accepted marks; under the card, the boxes of the order. Below
          `lg` the button leaves the card for the pill that floats at the
          foot of the screen. */}
      <aside
        aria-labelledby="checkout-summary"
        className="flex min-w-0 flex-col gap-3.5 lg:sticky lg:top-[5.5rem]"
      >
        <div className="glass-strong animate-rise flex flex-col rounded-2xl p-5 [animation-delay:120ms] sm:p-6">
          <PanelHead
            icon={ShoppingBag}
            titleId="checkout-summary"
            title={t("summaryTitle")}
            note={tCart("barItems", { count: itemCount })}
          />

          <OrderLines bill={bill} />

          {deliveryEstimate && (
            <p className="border-ink/8 mt-4 flex items-center gap-2.5 border-t pt-4 text-sm">
              <Truck
                aria-hidden="true"
                className="text-leaf-700 size-5 shrink-0"
              />
              <span>
                <span className="font-bold">{t("deliveryEstimate")}:</span>{" "}
                {deliveryEstimate}
              </span>
            </p>
          )}

          <div className="border-ink/8 mt-4 flex flex-col gap-3 border-t pt-4">
            {/* The discount code (doc 9.6): the bill it answers replaces
                the one on the page, so the row and the total change at
                once. */}
            <DiscountCode
              collapsed
              discount={bill.discount}
              // What a free-delivery code saves; the API says it under the box rules.
              deliverySaving={shipping?.freeByCode ? shipping.regularFee : 0}
              onBill={(next) => {
                setDiscountRemoved(null);
                // A code is taken off the goods before the boxes are
                // counted: it can cost a free box, and its removal gives
                // it back.
                setBoxesLostByCode(lostFreeBoxes(bill, next));
                // A guest's bill follows its code through the query's key.
                if (isCustomer) client.setQueryData(cartQueryKey(locale), next);
              }}
              apply={asGuest ? applyGuestCode : undefined}
              remove={asGuest ? removeGuestCode : undefined}
            />

            {/* The coins (REWARDS 8), for customers: the bill it answers
                replaces the one on the page the same way. */}
            {isCustomer && (
              <RedeemCoins
                rewards={bill.rewards}
                onBill={(next) => {
                  setRewardsRemoved(null);
                  // Coins come off the goods too, and can cost a free box.
                  setBoxesLostByCoins(lostFreeBoxes(bill, next));
                  client.setQueryData(cartQueryKey(locale), next);
                }}
              />
            )}
          </div>

          <div
            className={cn(
              "border-ink/8 mt-4 border-t pt-4 transition-opacity duration-200",
              billQuery.isFetching && "opacity-50",
            )}
            aria-busy={billQuery.isFetching}
          >
            {/* A code or coins that cost a free box (doc/
                BOX_BASED_SHIPPING_WEB_INTEGRATION.md 9) say so above the
                delivery they changed. */}
            {(lostByCode > 0 || lostByCoins > 0) && missingForBox !== null && (
              <div className="mb-4 flex flex-col gap-3">
                {lostByCode > 0 && (
                  <Alert tone="info">
                    {tShipping("lostByCode", {
                      count: lostByCode,
                      amount: formatMoney(missingForBox, locale),
                    })}
                  </Alert>
                )}
                {lostByCoins > 0 && (
                  <Alert tone="info">
                    {tShipping("lostByCoins", {
                      count: lostByCoins,
                      amount: formatMoney(missingForBox, locale),
                    })}
                  </Alert>
                )}
              </div>
            )}
            <BillTotals
              totals={bill.totals}
              savings={saleSavingsOf(bill.lines)}
              discountCode={bill.discount?.applied ? bill.discount.code : null}
              coins={bill.rewards?.applied ? bill.rewards.coins : null}
              boxes={shipping}
              freeDeliveryCode={freeDeliveryCode}
              regularDeliveryFee={shipping?.regularFee}
            />
            {(bill.rewards?.earn ?? 0) > 0 && (
              <p className="text-leaf-700 mt-3 flex items-center gap-2 text-sm font-semibold">
                <Coins aria-hidden="true" className="size-4 shrink-0" />
                {t("rewards.earn", { coins: bill.rewards!.earn })}
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-col gap-4 empty:hidden">
            {unavailable === "payments" && (
              <Alert tone="warn" title={t("notAvailableTitle")}>
                {t("notAvailableText")}
              </Alert>
            )}
            {unavailable === "shop" && (
              <Alert tone="warn" title={t("notPossibleTitle")}>
                {t("notPossibleText")}
              </Alert>
            )}
            {keyUsed && (
              <Alert tone="info" title={t("keyUsedTitle")}>
                {asGuest ? (
                  <p>{t("guest.keyUsedText")}</p>
                ) : (
                  <>
                    <p>{t("keyUsedText")}</p>
                    <Link
                      href="/account/orders"
                      className="font-bold underline underline-offset-4"
                    >
                      {t("toOrders")}
                    </Link>
                  </>
                )}
              </Alert>
            )}
            {(!bill.canOrder || refusedLines.length > 0) && (
              <Alert tone="warn" title={t("issuesTitle")}>
                {refusedLines.length > 0 && (
                  <ul className="list-disc pl-5">
                    {refusedLines.map(({ name, issue }) => (
                      <li key={name}>
                        {name}
                        {/* The one issue the cart cannot settle with a tap. */}
                        {issue === "too_heavy" && (
                          <> — {tCart("issue.too_heavy")}</>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <p>{t("issuesText")}</p>
                <Link
                  href="/cart"
                  className="font-bold underline underline-offset-4"
                >
                  {t("toCart")}
                </Link>
              </Alert>
            )}
            {discountRemoved && (
              <Alert
                tone="warn"
                title={t("discount.removedTitle", {
                  code: discountRemoved.code,
                })}
              >
                {t(`discount.reason.${discountRemoved.reason}`)}{" "}
                {t("discount.removedText")}
              </Alert>
            )}
            {rewardsRemoved && (
              <Alert tone="warn" title={t("rewards.removedTitle")}>
                {t(`rewards.reason.${rewardsRemoved}`)}{" "}
                {t("rewards.removedText")}
              </Alert>
            )}
            {totalChanged && (
              <Alert tone="warn" title={t("totalChangedTitle")}>
                {t("totalChangedText", {
                  before: formatMoney(totalChanged.before, locale),
                  after: formatMoney(totalChanged.after, locale),
                })}
              </Alert>
            )}
            {placeError !== null && (
              <ErrorAlert
                error={placeError}
                onRetry={
                  hasErrorCode(placeError, "PAYMENT_PROVIDER_ERROR")
                    ? () => void place()
                    : undefined
                }
              />
            )}

            {attempted && asGuest && fieldsMissing && (
              <p role="alert" className="text-sm font-semibold text-red-600">
                {t("fieldsMissing")}
              </p>
            )}
            {attempted && !asGuest && (!selected || showForm) && (
              <p role="alert" className="text-sm font-semibold text-red-600">
                {t("addressMissing")}
              </p>
            )}
            {attempted && !consent && (
              <p
                id="checkout-consent-error"
                role="alert"
                className="text-sm font-semibold text-red-600"
              >
                {t("consentMissing")}
              </p>
            )}
          </div>

          {/* The consent right above the button it belongs to (owner,
              2026-11-02), without the versions in the sentence: the
              versions the customer accepts travel with the order in
              `consent.versions` (doc 9.4), read from `GET /v1/store/legal`. */}
          <div className="border-ink/8 mt-5 flex flex-col gap-4 border-t pt-5">
            {legalChanged && (
              <Alert tone="warn" title={t("legalChangedTitle")}>
                {t("legalChangedText")}
              </Alert>
            )}
            <label
              htmlFor="checkout-consent"
              className="flex cursor-pointer items-start gap-3"
            >
              <input
                id="checkout-consent"
                ref={consentBox}
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                aria-describedby={
                  attempted && !consent ? "checkout-consent-error" : undefined
                }
                className="accent-leaf-600 mt-0.5 size-5 shrink-0"
              />
              <span className="text-sm leading-relaxed">
                {t.rich("consentText", {
                  terms: (chunks) => (
                    <Link
                      href={LEGAL_HREF.terms}
                      target="_blank"
                      className={link}
                    >
                      {chunks}
                    </Link>
                  ),
                  privacy: (chunks) => (
                    <Link
                      href={LEGAL_HREF.privacy}
                      target="_blank"
                      className={link}
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </span>
            </label>
          </div>

          {/* The legal wording is the button's label: the customer orders
              and pays now. From `lg` it closes the card; below, it is in
              the pill at the foot of the screen. */}
          {placeButton(
            "lg",
            "mt-4 hidden min-h-14 text-[1.0625rem] font-bold lg:inline-flex",
          )}
          <PaymentMarks
            label={tProduct("info.paymentMethods")}
            className="mt-4 justify-center"
          />
        </div>

        {/* The boxes of the order, under the button (owner, 2026-11-24):
            quiet, and dimmed with the totals while a change is on its way.
            Nothing under the flat fee. */}
        {shipping && shipping.requiredBoxes > 0 && (
          <BoxShipping
            shipping={shipping}
            code={freeDeliveryCode}
            className={cn(
              "animate-rise transition-opacity duration-200 [animation-delay:180ms]",
              billQuery.isFetching && "opacity-50",
            )}
          />
        )}
      </aside>

      {/* Below `lg`: the total and the one button, in reach of the thumb
          wherever the page is scrolled to. */}
      <div className="glass-strong shadow-float fixed inset-x-2.5 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 rounded-full py-2 pr-2 pl-5 lg:hidden">
        <p className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-ink-muted text-xs">{t("totalBar")}</span>
          <span
            className={cn(
              "font-display text-lg tabular-nums transition-opacity duration-200",
              billQuery.isFetching && "opacity-50",
            )}
          >
            {formatMoney(bill.totals.total, locale)}
          </span>
        </p>
        {placeButton("sm", "max-w-[62%] shrink-0 px-4 font-bold")}
      </div>
    </div>
  );
}

/** The head of a panel: a small tile with an icon, the title, and a quiet note at the end. */
function PanelHead({
  icon: Icon,
  titleId,
  title,
  note,
}: {
  icon: LucideIcon;
  titleId: string;
  title: string;
  note?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="to-leaf-50 text-leaf-700 grid size-10 shrink-0 place-items-center rounded-[0.875rem] bg-linear-[160deg] from-white shadow-[0_0_0_1px_rgb(23_33_27/0.05),0_6px_12px_-6px_rgb(21_122_75/0.4)]"
      >
        <Icon className="size-5" />
      </span>
      <h2 id={titleId} className="font-display text-ink text-xl">
        {title}
      </h2>
      {note && (
        <p className="text-ink-muted ml-auto text-[0.84375rem] font-semibold tabular-nums">
          {note}
        </p>
      )}
    </div>
  );
}

/** A frosted panel of the checkout with its head. */
function Panel({
  icon,
  titleId,
  title,
  note,
  delay = 0,
  sectionRef,
  children,
}: {
  icon: LucideIcon;
  titleId: string;
  title: string;
  note?: string;
  /** The panels rise one after the other, by this many milliseconds. */
  delay?: number;
  sectionRef?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  return (
    <section
      ref={sectionRef}
      aria-labelledby={titleId}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
      className="glass animate-rise grid scroll-mt-24 gap-[1.125rem] rounded-2xl p-5 sm:p-6"
    >
      <PanelHead icon={icon} titleId={titleId} title={title} note={note} />
      {children}
    </section>
  );
}

/** Nothing to order: the way back to the products. */
function EmptyCheckout() {
  const t = useTranslations("checkout");
  return (
    <div className="glass animate-rise flex flex-col items-center gap-4 rounded-2xl px-6 py-16 text-center">
      <h2 className="font-display text-ink text-xl">{t("emptyTitle")}</h2>
      <p className="text-ink-muted">{t("emptyText")}</p>
      <Link href="/products" className={buttonStyles()}>
        {t("continueShopping")}
      </Link>
    </div>
  );
}

function CheckoutSkeleton({ boxes }: { boxes: boolean }) {
  return (
    <div
      className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_26.875rem] lg:gap-6"
      aria-hidden="true"
    >
      <div className="space-y-5">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      {/* With the boxes of the order a second card stands under the summary. */}
      <div className="flex flex-col gap-3.5">
        <Skeleton className="h-96 rounded-2xl" />
        {boxes && <Skeleton className="h-36 rounded-xl" />}
      </div>
    </div>
  );
}
