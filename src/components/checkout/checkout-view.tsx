"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ChevronDown, Plus, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { BillTotals } from "@/components/cart/bill-summary";
import { PaymentMarks } from "@/components/catalogue/payment-marks";
import { ProductImage } from "@/components/catalogue/product-image";
import { Alert } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { TextField } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { checkEmail, normalizeEmail } from "@/features/auth/validation";
import { cartQueryKey, useCart } from "@/features/cart/cart";
import { saleSavingsOf } from "@/features/cart/savings";
import {
  addressToFormValues,
  guestAddressOf,
  toAddressInput,
  toGuestAddressInput,
  type AddressFormValues,
} from "@/features/checkout/address-schema";
import { ADDRESSES_QUERY_KEY, orderQueryKey } from "@/features/orders/orders";
import { isSafePaymentUrl } from "@/features/orders/payment-url";
import { useSession } from "@/features/session/session";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { ApiError, hasErrorCode } from "@/lib/api/errors";
import type {
  Address,
  Bill,
  CartItemInput,
  DiscountReason,
  Id,
  LegalSummary,
} from "@/lib/api/types";
import {
  checkoutKey,
  clearCheckoutKey,
  consentVersions,
} from "@/lib/checkout/order-attempt";
import { cn } from "@/lib/cn";
import { formatDiscount, formatMoney } from "@/lib/format/money";
import { rememberGuestToken } from "@/lib/orders/guest-token";
import { AddressForm } from "./address-form";
import { DiscountCode } from "./discount-code";
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

const LEGAL_HREF = {
  terms: "/legal/terms",
  privacy: "/legal/privacy",
} as const;

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
    <div className="mt-4">
      <div className="relative">
        <ul
          ref={list}
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
                className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0"
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
      className="glass-strong shadow-float mx-auto flex max-w-xl flex-col gap-5 rounded-3xl p-6 sm:p-8"
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
 * The checkout: the delivery address and the consent to the exact versions
 * of the legal texts as two steps, the order as a summary beside them, and
 * the one button that places the order and leads to the payment page. For
 * a customer the order is made of the cart stored by the API; this page
 * sends the address, the consent and the total the customer saw (doc 9).
 * A visitor may order as a guest (doc 20): the email address first, then
 * the address, the cart of the browser priced by the preview (with a
 * discount code, if any), and the order made by the guest checkout with
 * the token that opens it afterwards. Either way the browser goes to
 * `checkout.url`.
 */
export function CheckoutView({
  deliveryEstimate,
}: {
  /** `delivery.estimate` of the settings in the page's language, or `null`. */
  deliveryEstimate: string | null;
}) {
  const t = useTranslations("checkout");
  const tAddress = useTranslations("address");
  const tProduct = useTranslations("product");
  const tCart = useTranslations("cart");
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
  const [guestAddress, setGuestAddress] = useState<AddressFormValues | null>(
    null,
  );
  const [guestCode, setGuestCode] = useState<string | null>(null);
  const asGuest = isGuest && guestMode;
  const guestItems: CartItemInput[] = [...cart.items];

  // Everything is asked for again when the page opens: the bill and the
  // legal versions must be the current ones.
  const ready = (isCustomer || asGuest) && cart.ready;
  const billQuery = useQuery({
    queryKey: isCustomer
      ? cartQueryKey(locale)
      : ["cart", "preview", locale, guestItems, guestCode],
    queryFn: () =>
      isCustomer
        ? api.getCart()
        : api.previewCart(guestItems, { discountCode: guestCode ?? undefined }),
    enabled: ready,
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
  /** Names of the lines the API refused (`ORDER_ITEMS_NOT_ORDERABLE`). */
  const [refusedLines, setRefusedLines] = useState<string[]>([]);
  /** The key was used for an order that is paid or cancelled meanwhile. */
  const [keyUsed, setKeyUsed] = useState(false);
  /** The discount code stopped applying at checkout and was removed (9.6). */
  const [discountRemoved, setDiscountRemoved] = useState<{
    code: string;
    reason: DiscountReason;
  } | null>(null);

  const bill = billQuery.data;
  const addresses = isCustomer
    ? addressQuery.data?.items
    : guestAddress
      ? [guestAddressOf(guestAddress)]
      : [];
  const legal = legalQuery.data?.items;
  const loadError =
    billQuery.error ??
    (isCustomer ? addressQuery.error : null) ??
    legalQuery.error;

  if (session.status === "loading") return <CheckoutSkeleton />;
  if (isGuest && !guestMode) {
    return <GuestChooser onGuest={() => setGuestMode(true)} />;
  }
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
  if (!bill || !addresses || !legal) return <CheckoutSkeleton />;

  if (bill.lines.length === 0) {
    return (
      <div className="glass flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
        <h2 className="font-display text-ink text-xl">{t("emptyTitle")}</h2>
        <p className="text-ink-muted">{t("emptyText")}</p>
        <Link href="/products" className={buttonStyles()}>
          {t("continueShopping")}
        </Link>
      </div>
    );
  }

  // The chosen address, or the standard one until the customer chooses.
  const selected =
    addresses.find((address) => address.id === chosenAddress) ??
    addresses.find((address) => address.isDefault) ??
    addresses[0] ??
    null;
  const showForm = editing !== null || addresses.length === 0;
  const versionOf = (type: LegalSummary["type"]) =>
    legal.find((document) => document.type === type)?.version ?? 0;
  const canPlace =
    bill.canOrder && !billQuery.isFetching && unavailable === null && !keyUsed;
  const nameOf = (variantId: Id) => {
    const line = bill.lines.find((entry) => entry.variantId === variantId);
    return line?.product
      ? productTitle(line.product.name, line.product.packSize)
      : variantId;
  };

  async function saveAddress(values: AddressFormValues) {
    if (asGuest) {
      // A guest's address goes with the order, nowhere else.
      setGuestAddress(values);
      setChosenAddress(null);
      setEditing(null);
      return;
    }
    const input = toAddressInput(values);
    const known = new Set(addresses!.map((address) => address.id));
    const result =
      editing && editing !== "new"
        ? await api.updateAddress(editing, input)
        : await api.createAddress(input);
    client.setQueryData(ADDRESSES_QUERY_KEY, result);
    const created = result.items.find((address) => !known.has(address.id));
    setChosenAddress(created?.id ?? (editing !== "new" ? editing : null));
    setEditing(null);
  }

  async function place() {
    setAttempted(true);
    if (asGuest) {
      const problem = checkEmail(guestEmail);
      setGuestEmailProblem(problem ? t("guest.emailInvalid") : null);
      if (problem) return;
    }
    if (!selected || !consent || showForm || !bill || !legal) return;
    setPlacing(true);
    setPlaceError(null);
    setTotalChanged(null);
    setLegalChanged(false);
    setRefusedLines([]);
    setDiscountRemoved(null);
    try {
      const consentInput = {
        accepted: true as const,
        versions: consentVersions(legal),
      };
      // The total the customer sees right now, with the discount code
      // taken off. If the bill changed since, the API refuses and answers
      // with the new one.
      const result = asGuest
        ? await api.guestCheckout(
            {
              email: normalizeEmail(guestEmail),
              items: guestItems,
              address: toGuestAddressInput(guestAddress!),
              ...(guestCode && { discountCode: guestCode }),
              expectedTotal: bill.totals.total,
              consent: consentInput,
              language: locale,
            },
            checkoutKey(),
          )
        : await api.checkout(
            {
              addressId: selected.id,
              expectedTotal: bill.totals.total,
              consent: consentInput,
              language: locale,
            },
            checkoutKey(),
          );
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
          error.details.lines.map((line) => nameOf(line.variantId)),
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

  const sectionTitle = "font-display text-xl text-ink";
  const link = "font-semibold text-leaf-700 underline underline-offset-4";
  const itemCount = bill.lines.reduce((sum, line) => sum + line.quantity, 0);

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

  return (
    <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_28rem]">
      {/* The steps as open sections between hairlines, no boxes and no
          numbers (owner, 2026-10-21 and 2026-10-22). */}
      <div className="divide-ink/8 flex flex-col divide-y">
        {asGuest && (
          <section aria-labelledby="checkout-email" className="pb-10">
            <h2 id="checkout-email" className={sectionTitle}>
              {t("guest.emailTitle")}
            </h2>
            <p className="text-ink-muted mt-0.5">{t("guest.emailIntro")}</p>
            <TextField
              id="checkout-guest-email"
              label={t("guest.email")}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={guestEmail}
              onChange={(event) => {
                setGuestEmail(event.target.value);
                setGuestEmailProblem(null);
              }}
              error={guestEmailProblem}
              className="mt-5 max-w-md"
            />
          </section>
        )}

        <section
          aria-labelledby="checkout-address"
          className={cn("pb-10", asGuest && "pt-10")}
        >
          <h2 id="checkout-address" className={sectionTitle}>
            {t("addressTitle")}
          </h2>
          <p className="text-ink-muted mt-0.5">{t("addressIntro")}</p>

          <div className="mt-5 space-y-4">
            {addresses.length > 0 && !showForm && (
              <ul className="grid gap-3 sm:grid-cols-2">
                {addresses.map((address) => {
                  const checked = address.id === selected?.id;
                  const name = `${address.firstName} ${address.lastName}`;
                  return (
                    <li key={address.id} className="relative">
                      <label
                        className={cn(
                          "ease-glass flex h-full cursor-pointer gap-3 rounded-xl border-[1.5px] p-4 pr-20 transition-[background-color,border-color,box-shadow] duration-200",
                          checked
                            ? "border-leaf-600 bg-leaf-50/90 shadow-[0_0_0_3px_rgb(21_122_75/0.12)]"
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
                        className={cn(link, "absolute top-3 right-4 min-h-11")}
                      >
                        {tAddress("edit")}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {showForm ? (
              <AddressForm
                key={editing ?? "first"}
                idPrefix="checkout-address"
                initial={
                  editing && editing !== "new"
                    ? addressToFormValues(
                        addresses.find((address) => address.id === editing)!,
                      )
                    : undefined
                }
                showDefault={addresses.length > 0}
                onSave={saveAddress}
                onCancel={
                  addresses.length > 0 ? () => setEditing(null) : undefined
                }
              />
            ) : (
              // A guest has the one address of the order.
              !asGuest &&
              addresses.length < 10 && (
                <Button variant="secondary" onClick={() => setEditing("new")}>
                  <Plus aria-hidden="true" className="size-5" />
                  {tAddress("add")}
                </Button>
              )
            )}
          </div>
        </section>

        <section aria-labelledby="checkout-consent" className="pt-10">
          <h2 id="checkout-consent" className={sectionTitle}>
            {t("consentTitle")}
          </h2>
          <div className="mt-4 space-y-4">
            {legalChanged && (
              <Alert tone="warn" title={t("legalChangedTitle")}>
                {t("legalChangedText")}
              </Alert>
            )}
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                aria-describedby={
                  attempted && !consent ? "checkout-consent-error" : undefined
                }
                className="accent-leaf-600 mt-0.5 size-6 shrink-0"
              />
              <span>
                {t.rich("consentText", {
                  termsVersion: versionOf("terms"),
                  privacyVersion: versionOf("privacy"),
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
        </section>
      </div>

      {/* The order: the lines, the delivery estimate, the discount code,
          the totals, the button and the accepted marks; nothing else
          (owner, 2026-10-28: the note on paying now and the fine print
          under the button are gone; the button's label carries the
          legal word). */}
      <aside
        aria-labelledby="checkout-summary"
        className="glass-strong flex flex-col rounded-3xl p-5 sm:p-6 lg:sticky lg:top-24"
      >
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="checkout-summary" className={sectionTitle}>
            {t("summaryTitle")}
          </h2>
          <p className="text-ink-muted text-sm font-semibold tabular-nums">
            {tCart("barItems", { count: itemCount })}
          </p>
        </div>

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

        {/* The discount code (doc 9.6): the bill it answers replaces the
            one on the page, so the row and the total change at once. */}
        <DiscountCode
          discount={bill.discount}
          onBill={(next) => {
            setDiscountRemoved(null);
            // A guest's bill follows its code through the query's key.
            if (isCustomer) client.setQueryData(cartQueryKey(locale), next);
          }}
          apply={asGuest ? applyGuestCode : undefined}
          remove={asGuest ? removeGuestCode : undefined}
          className="border-ink/8 mt-4 border-t pt-4"
        />

        <div
          className={cn(
            "border-ink/8 mt-4 border-t pt-4",
            billQuery.isFetching && "opacity-50",
          )}
          aria-busy={billQuery.isFetching}
        >
          <BillTotals
            totals={bill.totals}
            savings={saleSavingsOf(bill.lines)}
            discountCode={bill.discount?.applied ? bill.discount.code : null}
          />
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
                  {refusedLines.map((name) => (
                    <li key={name}>{name}</li>
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

          {attempted && (!selected || showForm) && (
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

        {/* The legal wording is the button's label: the customer orders
            and pays now. */}
        <Button
          size="lg"
          block
          loading={placing}
          disabled={!canPlace}
          onClick={() => void place()}
          className="mt-5"
        >
          {placing ? t("placing") : t("place")}
        </Button>
        <PaymentMarks
          label={tProduct("info.paymentMethods")}
          className="mt-4 justify-center"
        />
      </aside>
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div
      className="grid gap-8 lg:grid-cols-[1fr_25rem] lg:gap-12"
      aria-hidden="true"
    >
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-32 rounded-md" />
        <Skeleton className="h-24 rounded-md" />
      </div>
      <Skeleton className="h-96 rounded-3xl" />
    </div>
  );
}
