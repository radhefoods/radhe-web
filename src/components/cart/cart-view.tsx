"use client";

import { ShoppingBag, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CountdownText } from "@/components/cargo/countdown-text";
import { PayLaterNote } from "@/components/cargo/pay-later-note";
import { ProductImage } from "@/components/catalogue/product-image";
import { Alert } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/features/cart/cart";
import { useBill } from "@/features/cart/use-bill";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { BillLine } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDayRange, formatDeadline } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import { BillTotals, FreeDeliveryProgress } from "./bill-summary";

function CartLine({ line, updating }: { line: BillLine; updating: boolean }) {
  const t = useTranslations("cart");
  const tProduct = useTranslations("product");
  const locale = useLocale() as Locale;
  const cart = useCart();
  const { product, ordering, issue } = line;
  // The number the customer chose shows at once; prices follow from the API.
  const quantity = cart.quantityOf(line.productId);
  const name = product
    ? `${product.name}, ${product.packSize.label}`
    : tProduct("reason.product_unavailable");
  const min = ordering?.minQuantity ?? 1;
  const max = ordering?.maxQuantity ?? null;
  const href = product && {
    pathname: "/products/[slug]" as const,
    params: { slug: product.slug },
  };

  return (
    <li className="border-line grid grid-cols-[5rem_1fr] gap-x-4 gap-y-3 border-b py-5 first:pt-0 sm:grid-cols-[6.5rem_1fr]">
      <div className="bg-mist row-span-2 aspect-square self-start overflow-hidden rounded-md">
        <ProductImage
          image={product?.image ?? null}
          alt=""
          sizes="104px"
          fallbackLabel=""
        />
      </div>

      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          {product?.brand && (
            <p className="text-ink-muted text-[0.6875rem] font-bold tracking-wider uppercase">
              {product.brand}
            </p>
          )}
          <p className="leading-snug font-bold">
            {href ? (
              <Link href={href} className="rounded-xs hover:underline">
                {product?.name}
              </Link>
            ) : (
              name
            )}
          </p>
          {product && (
            <p className="text-ink-muted text-sm tabular-nums">
              {product.packSize.label} ·{" "}
              {t("unitPrice", { price: formatMoney(line.unitPrice, locale) })}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label={t("removeNamed", { name })}
          onClick={() => cart.setQuantity(line.productId, 0)}
          className="text-ink-muted hover:bg-mist hover:text-ink -mt-2 -mr-2 grid size-11 shrink-0 place-items-center rounded-sm"
        >
          <Trash2 aria-hidden="true" className="size-5" />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {product && issue !== "product_not_found" ? (
          <QuantityStepper
            value={quantity}
            min={1}
            max={max}
            removeAtMin={false}
            size="sm"
            className="w-32"
            onChange={(next) => cart.setQuantity(line.productId, next)}
            labels={{
              quantity: tProduct("quantityNamed", { name }),
              increase: tProduct("increase"),
              decrease: tProduct("decrease"),
              remove: tProduct("remove"),
            }}
          />
        ) : (
          <span />
        )}
        {issue === null && (
          <p
            aria-label={t("lineTotal", { name })}
            className={cn(
              "text-lg font-bold tabular-nums transition-opacity",
              updating && "opacity-50",
            )}
          >
            {formatMoney(line.lineTotal, locale)}
          </p>
        )}
      </div>

      {issue && (
        <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-800">
          <p className="min-w-0 flex-1">
            {t(`issue.${issue}`, { min, max: max ?? 0 })}
          </p>
          {issue === "quantity_below_minimum" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => cart.setQuantity(line.productId, min)}
            >
              {t("setTo", { count: min })}
            </Button>
          )}
          {issue === "quantity_above_maximum" && max !== null && max > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => cart.setQuantity(line.productId, max)}
            >
              {t("setTo", { count: max })}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function CartSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]" aria-hidden="true">
      <div className="space-y-5">
        {[0, 1].map((row) => (
          <div key={row} className="flex gap-4">
            <Skeleton className="size-24 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-9 w-32" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

/**
 * The cart page: the products with their quantities, the bill from the API,
 * when it will be delivered, and that nothing is paid today.
 */
export function CartView() {
  const t = useTranslations("cart");
  const tCargo = useTranslations("cargo");
  const tProduct = useTranslations("product");
  const locale = useLocale() as Locale;
  const cart = useCart();
  const { bill, loading, updating, error, refetch } = useBill();

  if (cart.ready && cart.items.length === 0) {
    return (
      <div className="bg-mist flex flex-col items-center gap-4 rounded-xl px-6 py-16 text-center">
        <ShoppingBag aria-hidden="true" className="text-ink-subtle size-10" />
        <h2 className="font-display text-3xl text-blue-900">
          {t("emptyTitle")}
        </h2>
        <p className="text-ink-muted max-w-md">{t("emptyText")}</p>
        <Link href="/products" className={buttonStyles()}>
          {t("emptyCta")}
        </Link>
      </div>
    );
  }

  if (error && !bill) {
    return (
      <ErrorAlert error={error} title={t("loadError")} onRetry={refetch} />
    );
  }

  if (loading || !bill) return <CartSkeleton />;

  // Lines the customer just removed disappear at once.
  const lines = bill.lines.filter(
    (line) => cart.quantityOf(line.productId) > 0,
  );
  const hasIssues = lines.some((line) => line.issue !== null);
  const closed = bill.cargo === null;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_23rem] lg:gap-12">
      <div className="space-y-4">
        {cart.problem &&
          (cart.problem === "cart_full" ? (
            <Alert tone="warn">{tProduct("cartFull")}</Alert>
          ) : (
            <ErrorAlert error={cart.problem} />
          ))}
        <ul>
          {lines.map((line) => (
            <CartLine key={line.productId} line={line} updating={updating} />
          ))}
        </ul>
      </div>

      <aside
        aria-label={t("summary")}
        className="border-line shadow-card flex flex-col gap-4 rounded-xl border bg-white p-5 lg:sticky lg:top-44"
      >
        <h2 className="font-display text-3xl text-blue-900">{t("summary")}</h2>

        {bill.cargo && (
          <div className="bg-mist flex flex-col gap-1 rounded-md px-3.5 py-3 text-sm">
            <p>
              <span className="font-bold">{tCargo("orderBy")}</span>{" "}
              {formatDeadline(bill.cargo.orderCloseAt, locale)}
            </p>
            <p>
              <span className="font-bold">{tCargo("delivery")}</span>{" "}
              {formatDayRange(
                bill.cargo.delivery.start,
                bill.cargo.delivery.end,
                locale,
              )}
            </p>
            <CountdownText className="text-gold-700 font-bold tabular-nums" />
          </div>
        )}

        <FreeDeliveryProgress
          delivery={bill.delivery}
          subtotal={bill.totals.subtotal}
        />

        <div
          className={cn("transition-opacity", updating && "opacity-50")}
          aria-busy={updating}
        >
          <BillTotals totals={bill.totals} />
        </div>
        <p className="sr-only" role="status">
          {updating ? t("updating") : ""}
        </p>

        {closed ? (
          <Alert tone="warn">{t("closedHint")}</Alert>
        ) : (
          hasIssues && <Alert tone="warn">{t("fixIssues")}</Alert>
        )}

        {bill.canOrder && !updating ? (
          <Link
            href="/checkout"
            className={buttonStyles({ size: "lg", block: true })}
          >
            {t("checkout")}
          </Link>
        ) : (
          <Button size="lg" block disabled>
            {t("checkout")}
          </Button>
        )}
        {cart.mode === "guest" && bill.canOrder && (
          <p className="text-ink-muted text-center text-sm">
            {t("signInHint")}
          </p>
        )}

        <PayLaterNote />

        <Link
          href="/products"
          className="rounded-xs text-center font-semibold text-blue-700 underline underline-offset-4"
        >
          {t("continue")}
        </Link>
      </aside>

      {/* On phones the total and the way to the checkout stay in reach. */}
      <div className="border-line fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-4 border-t bg-white px-4 py-2.5 md:hidden">
        <p className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-ink-muted text-sm">{t("total")}</span>
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
              updating && "opacity-50",
            )}
          >
            {formatMoney(bill.totals.total, locale)}
          </span>
        </p>
        {bill.canOrder && !updating ? (
          <Link href="/checkout" className={buttonStyles({ size: "sm" })}>
            {t("checkout")}
          </Link>
        ) : (
          <Button size="sm" disabled>
            {t("checkout")}
          </Button>
        )}
      </div>
    </div>
  );
}
