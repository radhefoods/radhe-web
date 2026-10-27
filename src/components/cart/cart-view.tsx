"use client";

import { ShoppingBag, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import { formatDiscount, formatMoney } from "@/lib/format/money";
import { BillTotals, FreeDeliveryProgress } from "./bill-summary";
import {
  brandOf,
  formatPackSize,
  formatProductName,
  productTitle,
} from "@/lib/format/product-name";

/**
 * One pack size in the cart (owner, 2026-10-19 and 2026-10-21): the
 * picture on a white tile with a hairline; the brand, the name with the size in a quieter
 * tone, and the price per pack set like a price of the catalogue: in the
 * display cut, red when reduced with the regular price struck through
 * and the saving as a small red badge beside it, and no word around it
 * (owner, 2026-10-22: "each" confused); no price per kilogram, and no
 * line total: the summary adds up. Then, centred on the height of the
 * card, the stepper and the way to take the line out. A line the API
 * objects to carries its message and a one-tap fix.
 */
function CartLine({ line, updating }: { line: BillLine; updating: boolean }) {
  const t = useTranslations("cart");
  const tProduct = useTranslations("product");
  const locale = useLocale() as Locale;
  const cart = useCart();
  const { product, ordering, issue } = line;
  // The number the customer chose shows at once; prices follow from the API.
  const quantity = cart.quantityOf(line.variantId);
  const name = product
    ? productTitle(product.name, product.packSize)
    : tProduct("reason.product_unavailable");
  const brand = brandOf(product?.brand);
  // The line's price is what the customer pays per pack; next to it the
  // regular price when the size is reduced.
  const reduced =
    product !== null && line.unitPrice < product.pricing.regularPrice;
  const min = ordering?.minQuantity ?? 1;
  // The stock and the product's limit, whichever is lower (doc 7.1).
  const max = ordering?.maxQuantity ?? null;
  const href = product && {
    pathname: "/products/[slug]" as const,
    params: { slug: product.slug },
  };

  return (
    <li className="border-line shadow-card grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-xl border bg-white p-4 sm:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-x-5 sm:p-5 md:grid-cols-[6.5rem_minmax(0,1fr)_minmax(0,1.5fr)_auto]">
      <div className="border-line aspect-square self-center overflow-hidden rounded-md border bg-white p-1.5">
        <ProductImage
          image={product?.image ?? null}
          alt=""
          sizes="104px"
          fallbackLabel=""
        />
      </div>

      <div className="flex min-w-0 flex-col gap-0.5 self-center">
        {brand && (
          <p className="text-ink-subtle truncate text-[0.6875rem] leading-4 font-bold tracking-[0.1em] uppercase">
            {brand}
          </p>
        )}
        <p className="text-[1.0625rem] leading-snug font-bold">
          {href && product ? (
            <>
              <Link
                href={href}
                className="hover:text-leaf-700 rounded-xs underline-offset-2 hover:underline"
              >
                {formatProductName(product.name)}
              </Link>{" "}
              <span className="text-ink-muted font-medium whitespace-nowrap">
                ({formatPackSize(product.packSize)})
              </span>
            </>
          ) : (
            name
          )}
        </p>
        {product && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
            {reduced && (
              <span className="sr-only">{tProduct("currentPrice")}: </span>
            )}
            <span
              className={cn(
                "font-display text-[1.0625rem] leading-none",
                reduced && "text-red-600",
              )}
            >
              {formatMoney(line.unitPrice, locale)}
            </span>
            {reduced && (
              <>
                <span className="sr-only">{tProduct("regularPrice")}:</span>
                <s className="text-ink-subtle text-sm leading-none">
                  {formatMoney(product.pricing.regularPrice, locale)}
                </s>
                {product.pricing.discountPercent > 0 && (
                  <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[0.6875rem] leading-none font-bold text-red-800">
                    {formatDiscount(product.pricing.discountPercent, locale)}
                  </span>
                )}
              </>
            )}
          </p>
        )}
      </div>

      {/* The controls, centred on the height of the card whatever the
          texts take (owner, 2026-10-21 and 2026-10-22): the stepper, slim
          and white with a hairline, a little left of the middle of the
          card; the way to take the line out at its far end. On phones
          they share a row under the texts, the stepper first; from `sm`
          the wrapper dissolves and both become cells of the grid. */}
      <div className="col-span-2 flex items-center justify-between gap-3 sm:contents">
        {product && issue !== "product_not_found" && (
          <QuantityStepper
            value={quantity}
            min={1}
            max={max}
            removeAtMin={false}
            size="xs"
            look="outline"
            className={cn(
              "w-27 sm:col-start-3 sm:justify-self-center",
              updating && "opacity-70",
            )}
            onChange={(next) => cart.setQuantity(line.variantId, next)}
            labels={{
              quantity: tProduct("quantityNamed", { name }),
              increase: tProduct("increase"),
              decrease: tProduct("decrease"),
              remove: tProduct("remove"),
            }}
          />
        )}
        <button
          type="button"
          aria-label={t("removeNamed", { name })}
          onClick={() => cart.setQuantity(line.variantId, 0)}
          className="text-ink-muted hover:text-ink hover:bg-mist grid size-10 shrink-0 place-items-center rounded-full transition-colors duration-150 sm:col-start-4 sm:-mr-1.5 sm:justify-self-end"
        >
          <Trash2 aria-hidden="true" className="size-5" />
        </button>
      </div>

      {issue && (
        <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-800 sm:col-span-4">
          <p className="min-w-0 flex-1">
            {t(`issue.${issue}`, { min, max: max ?? 0 })}
          </p>
          {issue === "quantity_below_minimum" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => cart.setQuantity(line.variantId, min)}
            >
              {t("setTo", { count: min })}
            </Button>
          )}
          {issue === "quantity_above_maximum" && max !== null && max > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => cart.setQuantity(line.variantId, max)}
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
    <div className="grid gap-8 lg:grid-cols-[1fr_23rem]" aria-hidden="true">
      <div className="space-y-4">
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
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

/**
 * The cart page: the products with their quantities, the bill from the API
 * in a white summary card with the total as its one big number, and the
 * way to the checkout, which follows the bill's `canOrder`.
 */
export function CartView() {
  const t = useTranslations("cart");
  const tProduct = useTranslations("product");
  const locale = useLocale() as Locale;
  const cart = useCart();
  const { bill, loading, updating, error, refetch } = useBill();

  if (cart.ready && cart.items.length === 0) {
    return (
      <div className="bg-mist flex flex-col items-center gap-4 rounded-xl px-6 py-16 text-center">
        <ShoppingBag aria-hidden="true" className="text-ink-subtle size-10" />
        <h2 className="font-display text-ink text-xl">{t("emptyTitle")}</h2>
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
    (line) => cart.quantityOf(line.variantId) > 0,
  );
  const hasIssues = lines.some((line) => line.issue !== null);

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_23rem] lg:gap-12">
      <div className="space-y-4">
        {cart.problem &&
          (cart.problem === "cart_full" ? (
            <Alert tone="warn">{tProduct("cartFull")}</Alert>
          ) : (
            <ErrorAlert error={cart.problem} />
          ))}
        <ul className="flex flex-col gap-3">
          {lines.map((line) => (
            <CartLine key={line.variantId} line={line} updating={updating} />
          ))}
        </ul>
      </div>

      <aside
        aria-label={t("summary")}
        className="border-line shadow-card flex flex-col gap-5 rounded-xl border bg-white p-5 sm:p-6 lg:sticky lg:top-28"
      >
        <h2 className="font-display text-ink text-xl">{t("summary")}</h2>

        <FreeDeliveryProgress
          delivery={bill.delivery}
          subtotal={bill.totals.subtotal - bill.totals.discount}
        />

        <div
          className={cn("transition-opacity", updating && "opacity-50")}
          aria-busy={updating}
        >
          <BillTotals
            totals={bill.totals}
            discountCode={bill.discount?.applied ? bill.discount.code : null}
          />
        </div>
        <p className="sr-only" role="status">
          {updating ? t("updating") : ""}
        </p>

        {hasIssues && <Alert tone="warn">{t("fixIssues")}</Alert>}

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
        <div className="text-ink-muted flex flex-col gap-1.5 text-center text-sm">
          {cart.mode === "guest" && bill.canOrder && <p>{t("signInHint")}</p>}
          <p>{t("payNote")}</p>
        </div>

        <Link
          href="/products"
          className="text-leaf-700 rounded-xs text-center font-semibold underline underline-offset-4"
        >
          {t("continue")}
        </Link>
      </aside>

      {/* On phones the total and the way to the checkout stay in reach. */}
      <div className="shadow-header fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-4 bg-white px-4 py-2.5 md:hidden">
        <p className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-ink-muted text-sm">{t("total")}</span>
          <span
            className={cn(
              "font-display text-lg tabular-nums",
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
