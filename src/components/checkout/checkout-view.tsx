"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { BillTotals } from "@/components/cart/bill-summary";
import { Alert } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { controlStyles } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { cartQueryKey, useCart } from "@/features/cart/cart";
import {
  addressToFormValues,
  toAddressInput,
  type AddressFormValues,
} from "@/features/checkout/address-schema";
import { ADDRESSES_QUERY_KEY, orderQueryKey } from "@/features/orders/orders";
import { useSession } from "@/features/session/session";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { hasErrorCode } from "@/lib/api/errors";
import type { Address, Id, LegalSummary } from "@/lib/api/types";
import {
  checkoutKey,
  clearCheckoutKey,
  consentVersions,
} from "@/lib/checkout/order-attempt";
import { cn } from "@/lib/cn";
import { formatDate, formatDayRange } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import { AddressForm } from "./address-form";

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
  preorder_terms: "/legal/preorder-terms",
  privacy: "/legal/privacy",
} as const;

/**
 * The checkout: delivery address, an optional note, the consent to the
 * exact versions of the legal texts, the full bill, and the one button that
 * places the binding pre-order. Nothing is paid here, and the page says so.
 *
 * The order is made of the cart stored by the API; this page sends the
 * address, the consent and the total the customer saw (doc 9).
 */
export function CheckoutView() {
  const t = useTranslations("checkout");
  const tAddress = useTranslations("address");
  const tCargo = useTranslations("cargo");
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

  // Everything is asked for again when the page opens: the bill, the legal
  // versions and the permission must be the current ones.
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
  const permissionQuery = useQuery({
    queryKey: ["ordering-permission"],
    queryFn: () => api.getOrderingPermission(),
    enabled: ready,
    staleTime: 0,
  });

  const [chosenAddress, setChosenAddress] = useState<Id | null>(null);
  const [editing, setEditing] = useState<Id | "new" | null>(null);
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [placeError, setPlaceError] = useState<unknown>(null);
  const [totalChanged, setTotalChanged] = useState<{
    before: number;
    after: number;
  } | null>(null);
  const [legalChanged, setLegalChanged] = useState(false);

  const bill = billQuery.data;
  const addresses = addressQuery.data?.items;
  const legal = legalQuery.data?.items;
  const permission = permissionQuery.data;
  const loadError =
    billQuery.error ??
    addressQuery.error ??
    legalQuery.error ??
    permissionQuery.error;

  if (placed || session.status !== "customer") return <CheckoutSkeleton />;
  if (loadError && (!bill || !addresses || !legal || !permission)) {
    return (
      <ErrorAlert
        error={loadError}
        title={t("loadError")}
        onRetry={() => {
          void billQuery.refetch();
          void addressQuery.refetch();
          void legalQuery.refetch();
          void permissionQuery.refetch();
        }}
      />
    );
  }
  if (!bill || !addresses || !legal || !permission) return <CheckoutSkeleton />;

  if (bill.lines.length === 0) {
    return (
      <div className="bg-mist flex flex-col items-center gap-4 rounded-xl px-6 py-16 text-center">
        <h2 className="font-display text-3xl text-blue-900">
          {t("emptyTitle")}
        </h2>
        <p className="text-ink-muted">{t("emptyText")}</p>
        <Link href="/products" className={buttonStyles()}>
          {t("confirmation.continue")}
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
  const hasPreorderTerms = legal.some((d) => d.type === "preorder_terms");
  const canPlace =
    bill.canOrder && permission.canOrder && !billQuery.isFetching;

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
    try {
      const result = await api.placeOrder(
        {
          addressId: selected.id,
          // The total the customer sees right now. If the bill changed
          // since, the API refuses and answers with the new one.
          expectedTotal: bill.totals.total,
          consent: { accepted: true, versions: consentVersions(legal) },
          note: note.trim() || undefined,
          language: locale,
        },
        checkoutKey(),
      );
      // An order answered: this attempt is over, the next gets a new key.
      clearCheckoutKey();
      setPlaced(true);
      const { orderNumber } = result.order;
      client.setQueryData(orderQueryKey(orderNumber, locale), result.order);
      void client.invalidateQueries({ queryKey: cartQueryKey(locale) });
      router.replace({
        pathname: "/checkout/confirmation/[orderNumber]",
        params: { orderNumber },
      });
    } catch (error) {
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
      } else if (
        hasErrorCode(error, "PAYMENT_OVERDUE") ||
        hasErrorCode(error, "ORDERING_BLOCKED") ||
        hasErrorCode(error, "CUSTOMER_BLOCKED")
      ) {
        // The block above the button explains it, with what to pay.
        void permissionQuery.refetch();
      } else {
        setPlaceError(error);
        // The cart or the addresses are not what this page shows any more.
        void billQuery.refetch();
        if (hasErrorCode(error, "ADDRESS_NOT_FOUND")) {
          void addressQuery.refetch();
        }
      }
    } finally {
      setPlacing(false);
    }
  }

  const sectionTitle = "font-display text-3xl text-blue-900";
  const link = "font-semibold text-blue-700 underline underline-offset-4";

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_25rem] lg:gap-12">
      <div className="flex flex-col gap-10">
        <section aria-labelledby="checkout-address" className="space-y-4">
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
                          ? "border-blue-600 bg-blue-50"
                          : "border-line-strong hover:border-ink-subtle",
                      )}
                    >
                      <input
                        type="radio"
                        name="delivery-address"
                        className="mt-1 size-5 shrink-0 accent-blue-600"
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

        <section aria-labelledby="checkout-note" className="space-y-2">
          <label
            id="checkout-note"
            htmlFor="checkout-note-field"
            className="text-lg font-bold"
          >
            {t("noteTitle")}
          </label>
          <textarea
            id="checkout-note-field"
            value={note}
            maxLength={500}
            rows={3}
            aria-describedby="checkout-note-hint"
            onChange={(event) => setNote(event.target.value)}
            className={cn(controlStyles, "py-3")}
          />
          <p id="checkout-note-hint" className="text-ink-muted text-sm">
            {t("noteHint")}
          </p>
        </section>

        <section aria-labelledby="checkout-consent" className="space-y-3">
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
              className="mt-0.5 size-6 shrink-0 accent-blue-600"
            />
            <span>
              {t.rich("consentText", {
                termsVersion: versionOf("terms"),
                preorderVersion: versionOf("preorder_terms"),
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
                preorder: (chunks) => (hasPreorderTerms ? chunks : null),
                preorderLink: (chunks) => (
                  <Link
                    href={LEGAL_HREF.preorder_terms}
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
        className="border-line shadow-card flex flex-col gap-4 rounded-xl border bg-white p-5 lg:sticky lg:top-28"
      >
        <h2 id="checkout-summary" className={sectionTitle}>
          {t("summaryTitle")}
        </h2>

        <ul className="divide-line divide-y text-[0.9375rem]">
          {bill.lines.map((line) => (
            <li
              key={line.productId}
              className="flex items-baseline justify-between gap-4 py-2 first:pt-0"
            >
              <span className="min-w-0">
                <span className="text-ink-muted tabular-nums">
                  {t("quantityTimes", { quantity: line.quantity })}
                </span>{" "}
                {line.product
                  ? `${line.product.name}, ${line.product.packSize.label}`
                  : line.productId}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatMoney(line.lineTotal, locale)}
              </span>
            </li>
          ))}
        </ul>

        {bill.cargo && (
          <p className="bg-mist rounded-md px-3.5 py-3 text-sm">
            <span className="font-bold">{t("deliveryWindow")}:</span>{" "}
            {formatDayRange(
              bill.cargo.delivery.start,
              bill.cargo.delivery.end,
              locale,
            )}
          </p>
        )}

        <div
          className={cn(billQuery.isFetching && "opacity-50")}
          aria-busy={billQuery.isFetching}
        >
          <BillTotals totals={bill.totals} />
        </div>

        <p className="rounded-md border border-teal-100 bg-teal-50 px-3.5 py-3 text-sm text-teal-700">
          <span className="font-bold">{tCargo("payLaterTitle")}</span>{" "}
          {t("payLater")}
        </p>

        {!permission.canOrder && permission.reason && (
          <Alert tone="bad" title={t(`blocked.${permission.reason}`)}>
            {permission.overdue.length > 0 && (
              <ul className="mt-1 space-y-1">
                {permission.overdue.map((order) => (
                  <li key={order.orderNumber}>
                    {t("overdueItem", {
                      orderNumber: order.orderNumber,
                      amount: formatMoney(order.amountDue, locale),
                      date: formatDate(order.deadlineAt, locale),
                    })}{" "}
                    <Link
                      href={{
                        pathname: "/account/orders/[orderNumber]",
                        params: { orderNumber: order.orderNumber },
                      }}
                      className="font-bold underline underline-offset-4"
                    >
                      {t("overdueLink")}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Alert>
        )}
        {!bill.canOrder && (
          <Alert tone="warn" title={t("issuesTitle")}>
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
        {placeError !== null && <ErrorAlert error={placeError} />}

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

        {/* The wording is the legal one: it says that the order is binding. */}
        <Button
          size="lg"
          block
          className="font-narrow"
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
