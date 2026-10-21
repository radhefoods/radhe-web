"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { BillTotals } from "@/components/cart/bill-summary";
import { Alert } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cartQueryKey, useCart } from "@/features/cart/cart";
import {
  addressToFormValues,
  toAddressInput,
  type AddressFormValues,
} from "@/features/checkout/address-schema";
import { ADDRESSES_QUERY_KEY, orderQueryKey } from "@/features/orders/orders";
import { isSafePaymentUrl } from "@/features/orders/payment-url";
import { useSession } from "@/features/session/session";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { ApiError, hasErrorCode } from "@/lib/api/errors";
import type { Address, Id, LegalSummary } from "@/lib/api/types";
import {
  checkoutKey,
  clearCheckoutKey,
  consentVersions,
} from "@/lib/checkout/order-attempt";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format/money";
import { AddressForm } from "./address-form";
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

/** Why the shop cannot sell right now: not the customer's doing (doc 14). */
type Unavailable = "payments" | "shop";

/**
 * The checkout: delivery address, the consent to the exact versions of
 * the legal texts, the full bill, and the one button that
 * places the order and leads to the payment page. The order is made of the
 * cart stored by the API; this page sends the address, the consent and the
 * total the customer saw (doc 9), and the browser goes to `checkout.url`.
 */
export function CheckoutView({
  deliveryEstimate,
}: {
  /** `delivery.estimate` of the settings in the page's language, or `null`. */
  deliveryEstimate: string | null;
}) {
  const t = useTranslations("checkout");
  const tAddress = useTranslations("address");
  const tCart = useTranslations("cart");
  const tProduct = useTranslations("product");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const client = useQueryClient();
  const session = useSession({ force: true });
  const cart = useCart();
  const isCustomer = session.status === "customer";

  // Checkout needs an account: sign in first, then come back here.
  useEffect(() => {
    if (session.status === "guest") {
      router.replace({
        pathname: "/sign-in",
        query: { returnTo: "/checkout" },
      });
    }
  }, [session.status, router]);

  // Everything is asked for again when the page opens: the bill and the
  // legal versions must be the current ones.
  const ready = isCustomer && cart.ready;
  const billQuery = useQuery({
    queryKey: cartQueryKey(locale),
    queryFn: () => api.getCart(),
    enabled: ready,
    staleTime: 0,
  });
  const addressQuery = useQuery({
    queryKey: ADDRESSES_QUERY_KEY,
    queryFn: () => api.listAddresses(),
    enabled: ready,
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

  const bill = billQuery.data;
  const addresses = addressQuery.data?.items;
  const legal = legalQuery.data?.items;
  const loadError = billQuery.error ?? addressQuery.error ?? legalQuery.error;

  if (session.status !== "customer") return <CheckoutSkeleton />;
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
      <div className="bg-mist flex flex-col items-center gap-4 rounded-xl px-6 py-16 text-center">
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
    if (!selected || !consent || showForm || !bill || !legal) return;
    setPlacing(true);
    setPlaceError(null);
    setTotalChanged(null);
    setLegalChanged(false);
    setRefusedLines([]);
    try {
      const result = await api.checkout(
        {
          addressId: selected.id,
          // The total the customer sees right now. If the bill changed
          // since, the API refuses and answers with the new one.
          expectedTotal: bill.totals.total,
          consent: { accepted: true, versions: consentVersions(legal) },
          language: locale,
        },
        checkoutKey(),
      );
      // An order answered: this attempt is over, the next gets a new key.
      clearCheckoutKey();
      const { orderNumber } = result.order;
      client.setQueryData(orderQueryKey(orderNumber, locale), result.order);
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
      if (hasErrorCode(error, "ORDER_TOTAL_CHANGED")) {
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

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_25rem] lg:gap-12">
      {/* The steps as open sections between hairlines, no boxes (owner,
          2026-10-21). */}
      <div className="divide-line flex flex-col divide-y">
        <section aria-labelledby="checkout-address" className="space-y-4 pb-8">
          <div>
            <h2 id="checkout-address" className={sectionTitle}>
              {t("addressTitle")}
            </h2>
            <p className="text-ink-muted">{t("addressIntro")}</p>
          </div>

          {addresses.length > 0 && !showForm && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {addresses.map((address) => {
                const checked = address.id === selected?.id;
                const name = `${address.firstName} ${address.lastName}`;
                return (
                  <li key={address.id} className="relative">
                    <label
                      className={cn(
                        "flex h-full cursor-pointer gap-3 rounded-md border-[1.5px] p-4 pr-20",
                        checked
                          ? "border-leaf-600 bg-leaf-50"
                          : "border-line-strong hover:border-ink-subtle bg-white",
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
            addresses.length < 10 && (
              <Button variant="secondary" onClick={() => setEditing("new")}>
                <Plus aria-hidden="true" className="size-5" />
                {tAddress("add")}
              </Button>
            )
          )}
        </section>

        <section aria-labelledby="checkout-consent" className="space-y-3 pt-8">
          <h2 id="checkout-consent" className={sectionTitle}>
            {t("consentTitle")}
          </h2>
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
        </section>
      </div>

      <aside
        aria-labelledby="checkout-summary"
        className="bg-mist flex flex-col gap-4 rounded-xl p-5 sm:p-6 lg:sticky lg:top-28"
      >
        <h2 id="checkout-summary" className={sectionTitle}>
          {t("summaryTitle")}
        </h2>

        {/* About five lines show at once; more scroll inside the list, and
            the totals and the button stay in view (owner, 2026-10-21). */}
        <ul className="divide-line -mr-2 max-h-[19.5rem] scrollbar-thin divide-y overflow-y-auto pr-2 text-[0.9375rem]">
          {bill.lines.map((line) => {
            // A reduced size shows what is paid per pack and the regular price.
            const reduced =
              line.product !== null &&
              line.unitPrice < line.product.pricing.regularPrice;
            return (
              <li
                key={line.variantId}
                className="flex items-baseline justify-between gap-4 py-2 first:pt-0"
              >
                <span className="min-w-0">
                  <span className="text-ink-muted tabular-nums">
                    {t("quantityTimes", { quantity: line.quantity })}
                  </span>{" "}
                  {line.product
                    ? productTitle(line.product.name, line.product.packSize)
                    : line.variantId}
                  {reduced && (
                    <span className="text-ink-muted block text-sm tabular-nums">
                      <span className="sr-only">
                        {tProduct("currentPrice")}:{" "}
                      </span>
                      {tCart("unitPrice", {
                        price: formatMoney(line.unitPrice, locale),
                      })}{" "}
                      <span className="sr-only">
                        {tProduct("regularPrice")}:
                      </span>
                      <s className="text-ink-subtle">
                        {formatMoney(
                          line.product!.pricing.regularPrice,
                          locale,
                        )}
                      </s>
                    </span>
                  )}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatMoney(line.lineTotal, locale)}
                </span>
              </li>
            );
          })}
        </ul>

        {deliveryEstimate && (
          <p className="rounded-md bg-white px-3.5 py-3 text-sm">
            <span className="font-bold">{t("deliveryEstimate")}:</span>{" "}
            {deliveryEstimate}
          </p>
        )}

        <div
          className={cn(billQuery.isFetching && "opacity-50")}
          aria-busy={billQuery.isFetching}
        >
          <BillTotals totals={bill.totals} />
        </div>

        <p className="border-leaf-100 bg-leaf-50 text-leaf-700 rounded-md border px-3.5 py-3 text-sm">
          <span className="font-bold">{t("payNowTitle")}</span>{" "}
          {t("payNowText")}
        </p>

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
            <p>{t("keyUsedText")}</p>
            <Link
              href="/account/orders"
              className="font-bold underline underline-offset-4"
            >
              {t("toOrders")}
            </Link>
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

        {/* The legal wording: the customer orders and pays now. */}
        <Button
          size="lg"
          block
          loading={placing}
          disabled={!canPlace}
          onClick={() => void place()}
        >
          {placing ? t("placing") : t("place")}
        </Button>
        <p className="text-ink-muted text-center text-sm">{t("finePrint")}</p>
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
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
