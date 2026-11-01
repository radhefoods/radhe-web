"use client";

import {
  ChevronRight,
  FileText,
  Heart,
  MapPin,
  Package,
  Pencil,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Skeleton } from "@/components/ui/skeleton";
import { useOverview } from "@/features/account/overview";
import { useSession } from "@/features/session/session";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { hasErrorCode } from "@/lib/api/errors";
import type { AccountOverview, Customer } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMonthYear } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import { CopyLink } from "./copy-link";
import { AddressBlock, OrderCard } from "./order-bits";
import { NoOrders, useOrders } from "./order-list";
import { SignOutButton } from "./sign-out";

const sectionTitle = "font-display text-xl text-ink";
const panel = "glass-strong flex flex-col gap-3 rounded-2xl p-5";
const link =
  "text-leaf-700 self-start rounded-xs font-semibold underline underline-offset-4";

/** The first letters of the name, for the round badge; the address's first letter without one. */
function initialsOf(customer: Customer): string {
  const letters = [customer.firstName, customer.lastName]
    .map((name) => name?.trim().charAt(0) ?? "")
    .join("");
  return (letters || customer.email.charAt(0)).toUpperCase();
}

/** One of the four tiles: a count, what it counts, and a line under it, all a link. */
function Tile({
  href,
  icon,
  count,
  title,
  hint,
}: {
  href:
    | "/account/orders"
    | "/account/invoices"
    | "/wishlist"
    | "/account/addresses";
  icon: ReactNode;
  count: number;
  title: string;
  hint: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="glass-strong hover:shadow-lift ease-glass flex h-full flex-col gap-5 rounded-2xl p-5 transition-[box-shadow,transform,background-color] duration-300 hover:-translate-y-0.5 hover:bg-white/90"
      >
        <span className="flex items-start justify-between">
          <span
            aria-hidden="true"
            className="bg-leaf-50 text-leaf-700 grid size-10 place-items-center rounded-full"
          >
            {icon}
          </span>
          <ChevronRight aria-hidden="true" className="text-ink-subtle size-5" />
        </span>
        <span className="mt-auto flex flex-col">
          <span className="font-display text-ink text-[2.25rem] leading-none tabular-nums">
            {count}
          </span>
          <span className="mt-2 font-bold">{title}</span>
          <span className="text-ink-muted text-sm">{hint}</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * The first page of the account, after the owner's reference screenshot
 * (2026-11-01): the greeting card with the name, "Member since" and the
 * way to the profile; four tiles (orders, invoices, wishlist, addresses)
 * from `GET /v1/store/me/overview` (doc 2); then the orders that wait for
 * their payment and the latest orders, with the standard address and the
 * referral code beside them. Points, subscriptions and rewards of the
 * reference have no API and are left out. An API without the overview
 * still shows the greeting and the orders.
 */
export function AccountOverview() {
  const t = useTranslations("account");
  const locale = useLocale() as Locale;
  const { customer } = useSession({ force: true });
  const overviewQuery = useOverview();
  const overview: AccountOverview | null = overviewQuery.data ?? null;
  // The route may not exist on an older API: then only the tiles are missing.
  const overviewMissing = hasErrorCode(overviewQuery.error, "NOT_FOUND");
  const query = useOrders();
  const orders = query.data?.pages[0]?.items ?? [];
  const toPay = orders.filter((order) => order.status === "pending_payment");
  // The session's customer first: the profile page changes it at once,
  // while the overview is kept for a while.
  const person = customer ?? overview?.customer ?? null;
  const counts = overview?.counts;
  const icon = "size-5";

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="account-greeting"
        className="glass-strong flex flex-col gap-5 rounded-3xl p-5 sm:flex-row sm:items-center sm:p-7"
      >
        {person && (
          <span
            aria-hidden="true"
            className="leaf-gradient shadow-leaf grid size-20 shrink-0 place-items-center rounded-full text-2xl font-bold text-white sm:size-24 sm:text-3xl"
          >
            {initialsOf(person)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Eyebrow tone="leaf">{t("overview.eyebrow")}</Eyebrow>
          <h1
            id="account-greeting"
            className="font-display text-ink mt-1 text-3xl sm:text-4xl"
          >
            {person?.firstName
              ? t("greeting", { name: person.firstName })
              : t("greetingPlain")}
          </h1>
          {person && (
            <p className="text-ink-muted mt-1 break-words">
              {person.email}
              {person.phone && ` · ${person.phone}`}
            </p>
          )}
          {overview && (
            <p className="text-ink-subtle mt-1 text-sm">
              {t("overview.memberSince", {
                date: formatMonthYear(overview.memberSince, locale),
              })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-start gap-2 sm:flex-col sm:items-end">
          <Link
            href="/account/profile"
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            <Pencil aria-hidden="true" className="size-4" />
            {t("overview.editProfile")}
          </Link>
          <SignOutButton variant="quiet" />
        </div>
      </section>

      {overviewQuery.error && !overview && !overviewMissing && (
        <ErrorAlert
          error={overviewQuery.error}
          title={t("loadError")}
          onRetry={() => void overviewQuery.refetch()}
        />
      )}
      {counts ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            href="/account/orders"
            icon={<Package className={icon} />}
            count={counts.orders}
            title={t("overview.orders")}
            hint={t("overview.ordersOpen", { count: counts.openOrders })}
          />
          <Tile
            href="/account/invoices"
            icon={<FileText className={icon} />}
            count={counts.invoices}
            title={t("overview.invoices")}
            hint={t("overview.invoicesHint")}
          />
          <Tile
            href="/wishlist"
            icon={<Heart className={icon} />}
            count={counts.wishlistItems}
            title={t("overview.wishlist")}
            hint={t("overview.wishlistLists", { count: counts.wishlists })}
          />
          <Tile
            href="/account/addresses"
            icon={<MapPin className={icon} />}
            count={counts.addresses}
            title={t("overview.addresses")}
            hint={t("overview.addressesHint")}
          />
        </ul>
      ) : (
        overviewQuery.isPending &&
        !overviewMissing && (
          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            aria-hidden="true"
          >
            {[0, 1, 2, 3].map((tile) => (
              <Skeleton key={tile} className="h-40 rounded-2xl" />
            ))}
          </div>
        )
      )}

      <div
        className={cn(
          "grid items-start gap-6",
          overview && "lg:grid-cols-[minmax(0,1fr)_20rem]",
        )}
      >
        <div className="flex flex-col gap-6">
          {toPay.length > 0 && (
            <section
              aria-labelledby="account-to-pay"
              className="bg-wheat-100/90 ring-wheat-800/12 rounded-2xl p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.7)] ring-1 sm:p-6"
            >
              <h2
                id="account-to-pay"
                className="text-wheat-800 text-lg font-bold"
              >
                {t("toPayTitle")}
              </h2>
              <ul className="mt-2 flex flex-col gap-1">
                {toPay.map((order) => (
                  <li key={order.orderNumber}>
                    <Link
                      href={{
                        pathname: "/account/orders/[orderNumber]",
                        params: { orderNumber: order.orderNumber },
                      }}
                      className="text-wheat-800 flex min-h-11 items-center rounded-xs font-semibold underline underline-offset-4"
                    >
                      {t("toPayItem", {
                        orderNumber: order.orderNumber,
                        amount: formatMoney(order.finalTotal, locale),
                      })}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section
            aria-labelledby="account-recent"
            className="flex flex-col gap-4"
          >
            {query.error && orders.length === 0 ? (
              <ErrorAlert
                error={query.error}
                title={t("loadError")}
                onRetry={() => void query.refetch()}
              />
            ) : query.isPending ? (
              <div className="space-y-3" aria-hidden="true">
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
              </div>
            ) : orders.length === 0 ? (
              <NoOrders />
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 id="account-recent" className={sectionTitle}>
                    {t("recentOrders")}
                  </h2>
                  <Link
                    href="/account/orders"
                    className="text-leaf-700 rounded-xs font-bold underline underline-offset-4"
                  >
                    {t("allOrders")}
                  </Link>
                </div>
                <ul className="flex flex-col gap-3">
                  {orders.slice(0, 3).map((order) => (
                    <li key={order.orderNumber}>
                      <OrderCard order={order} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        {overview && (
          <div className="flex flex-col gap-6">
            <section aria-labelledby="account-address" className={panel}>
              <h2 id="account-address" className={sectionTitle}>
                {t("overview.defaultAddress")}
              </h2>
              {overview.defaultAddress ? (
                <div className="text-[0.9375rem]">
                  {overview.defaultAddress.label && (
                    <p className="text-ink-subtle mb-1 text-xs font-bold tracking-[0.1em] uppercase">
                      {overview.defaultAddress.label}
                    </p>
                  )}
                  <AddressBlock address={overview.defaultAddress} />
                </div>
              ) : (
                <p className="text-ink-muted">{t("overview.noAddress")}</p>
              )}
              <Link href="/account/addresses" className={link}>
                {t("overview.manageAddresses")}
              </Link>
            </section>

            <section aria-labelledby="account-referral" className={panel}>
              <h2 id="account-referral" className={sectionTitle}>
                {t("overview.referralTitle")}
              </h2>
              <p className="text-ink-muted text-sm">
                {t("overview.referralText")}
              </p>
              <p className="text-ink-subtle text-xs font-bold tracking-[0.1em] uppercase">
                {t("overview.referralCode")}
              </p>
              <p className="font-display text-ink -mt-2 text-2xl tracking-[0.14em]">
                {overview.referral.code}
              </p>
              <CopyLink
                id="account-referral-link"
                link={overview.referral.link}
                label={t("overview.referralLink")}
                copy={t("overview.copyLink")}
                copied={t("overview.copied")}
              />
              <p className="text-sm font-semibold">
                {t("overview.referralCounts", overview.referral.counts)}
              </p>
              <Link href="/account/referrals" className={link}>
                {t("overview.referralAll")}
              </Link>
              <p className="text-ink-subtle text-xs">
                {t("overview.referralNote")}
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
