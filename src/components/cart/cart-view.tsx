"use client";

import { ArrowRight, ShoppingBag, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { ProductImage } from "@/components/catalogue/product-image";
import { WishlistButton } from "@/components/catalogue/wishlist-button";
import { Alert } from "@/components/ui/alert";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/features/cart/cart";
import { saleSavingsOf } from "@/features/cart/savings";
import { freeDeliveryCodeOf } from "@/features/cart/shipping";
import { useBill } from "@/features/cart/use-bill";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import type { BillLine } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDiscount, formatMoney } from "@/lib/format/money";
import { BillTotals, FreeDeliveryProgress } from "./bill-summary";
import { BoxShipping } from "./box-shipping";
import {
  brandOf,
  formatPackSize,
  formatProductName,
  productTitle,
} from "@/lib/format/product-name";

/**
 * One pack size in the cart, a row of the one glass panel (owner,
 * 2026-11-24, after the cart design "Liquid Glass" of the lab): the
 * picture on white with a soft green fall; the brand, the name with the
 * size in a quieter tone, and the price per pack set like a price of the
 * catalogue (red when reduced, with the regular price struck through and
 * the saving as a small red badge, no word around it); then the stepper,
 * the total of the line, and at the end the heart that keeps the product
 * on the wishlist and the way to take the line out.
 *
 * From `sm` the list is the grid and every row a subgrid of it
 * (`grid-cols-subgrid`), so the steppers and the totals of all rows stand
 * under each other whatever the names take. On phones the texts have the
 * first row beside the picture, and the stepper, the total and the two
 * buttons share the second. A line the API objects to carries its message
 * and a one-tap fix.
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
    <li className="grid grid-cols-[4rem_auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 py-3.5 sm:col-span-full sm:grid-cols-subgrid sm:gap-x-4">
      <div
        className={cn(
          "row-span-2 aspect-square self-start overflow-hidden rounded-md bg-white p-1 shadow-[0_0_0_1px_rgb(23_33_27/0.06),0_10px_20px_-14px_rgb(15_92_56/0.5)] sm:row-span-1 sm:self-center",
          issue && "opacity-60",
        )}
      >
        <ProductImage
          image={product?.image ?? null}
          alt=""
          sizes="80px"
          fallbackLabel=""
        />
      </div>

      <div className="col-span-3 flex min-w-0 flex-col gap-0.5 self-center sm:col-span-1">
        {brand && (
          <p className="text-ink-subtle truncate text-[0.6875rem] leading-4 font-bold tracking-[0.1em] uppercase">
            {brand}
          </p>
        )}
        <p className="text-[0.96875rem] leading-snug font-bold">
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
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 tabular-nums">
            {reduced && (
              <span className="sr-only">{tProduct("currentPrice")}: </span>
            )}
            <span
              className={cn(
                "font-display text-[0.96875rem] leading-none",
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

      {/* The stepper: a pill of clear glass. A line whose product is gone
          has none; its place in the grid stays empty. */}
      {product && issue !== "product_not_found" ? (
        <QuantityStepper
          value={quantity}
          min={1}
          max={max}
          removeAtMin={false}
          size="sm"
          look="outline"
          className={cn(
            "w-28 transition-opacity duration-200",
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
      ) : (
        <span aria-hidden="true" />
      )}

      {/* What the line comes to: the API's sum, dropped into place when it
          changes. */}
      <p className="min-w-[4.5rem] justify-self-end text-right tabular-nums">
        <span className="sr-only">{t("lineTotal")}: </span>
        <span
          key={line.lineTotal}
          className={cn(
            "font-display animate-tick inline-block text-base whitespace-nowrap",
            updating && "opacity-60",
          )}
        >
          {formatMoney(line.lineTotal, locale)}
        </span>
      </p>

      <div className="-mr-1.5 flex items-center">
        {product && line.productId && (
          <WishlistButton
            productId={line.productId}
            variantId={line.variantId}
            name={name}
            look="plain"
          />
        )}
        <button
          type="button"
          aria-label={t("removeNamed", { name })}
          onClick={() => cart.setQuantity(line.variantId, 0)}
          className="text-ink-muted ease-glass grid size-9 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-200 hover:bg-red-50 hover:text-red-600 active:scale-90"
        >
          <Trash2 aria-hidden="true" className="size-[18px]" />
        </button>
      </div>

      {issue && (
        <div className="col-span-full flex flex-wrap items-center gap-x-4 gap-y-2 rounded-sm bg-red-50/90 px-3.5 py-2.5 text-sm font-semibold text-red-800 ring-1 ring-red-600/15">
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

/**
 * The two columns of the page, shared with the placeholder. From `lg` the
 * list and what the page hands in share the first column and the summary
 * stands beside both; below, the summary comes right after the list, so
 * the bill is not pushed under the suggestions. The second row takes
 * whatever the summary is taller by.
 */
const columns =
  "grid items-start gap-x-7 gap-y-[1.125rem] lg:grid-cols-[minmax(0,1fr)_23.75rem] lg:grid-rows-[auto_1fr]";

function CartSkeleton({ boxes }: { boxes: boolean }) {
  return (
    <div className={columns} aria-hidden="true">
      <div className="glass space-y-4 rounded-2xl p-5">
        {[0, 1].map((row) => (
          <div key={row} className="flex gap-4">
            <Skeleton className="size-[4.75rem] rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-7 w-28" />
            </div>
          </div>
        ))}
      </div>
      {/* With the boxes of the order a second card stands under the
          summary: the page should not jump when the bill arrives. */}
      <div className="flex flex-col gap-3.5">
        <Skeleton className="h-80 rounded-2xl" />
        {boxes && <Skeleton className="h-36 rounded-xl" />}
      </div>
    </div>
  );
}

/**
 * How much is in the cart, beside the title of the page: the products and
 * the packs. Nothing for an empty cart, and nothing until the cart of
 * this browser is known.
 */
export function CartCount({ className }: { className?: string }) {
  const t = useTranslations("cart");
  const cart = useCart();
  if (!cart.ready || cart.items.length === 0) return null;
  return (
    <p
      key={cart.units}
      className={cn(
        "text-ink-muted animate-tick text-[0.9375rem] tabular-nums",
        className,
      )}
    >
      {t("products", { count: cart.items.length })} ·{" "}
      {t("barItems", { count: cart.units })}
    </p>
  );
}

/**
 * A suggestion under the cart that is in the cart already says nothing
 * new: it leaves the row, also the moment it is added from there. Shown
 * until the cart of this browser is known, so the server's page has it.
 */
export function UnlessInCart({
  variantId,
  children,
}: {
  variantId: string;
  children: ReactNode;
}) {
  const cart = useCart();
  if (cart.ready && cart.quantityOf(variantId) > 0) return null;
  return children;
}

/**
 * The cart page (owner, 2026-11-24, after the cart design "Liquid Glass"
 * of the lab): the products with their quantities as the rows of one
 * frosted panel, under it whatever the page hands in (`children`: the row
 * of popular products), and beside both the bill from the API in a
 * frosted summary that stays in view, with the total as its one big
 * number and the way to the checkout, which follows the bill's
 * `canOrder`. On phones the total and that button float as a glass pill
 * above the tab bar.
 *
 * Under the flat fee the summary opens with the hint on free delivery.
 * Where the API prices the delivery by the box (`bill.shipping`,
 * doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md 7, 2026-11-20), the boxes of
 * the order are a quiet card of their own under the button
 * (`BoxShipping`).
 *
 * The discount code and the coins are entered at the checkout, as before:
 * a visitor's code lives with the checkout page, not with the cart.
 */
export function CartView({
  boxBased = false,
  children,
}: {
  /** `shipping.boxBased` of the settings: only sizes the placeholder. */
  boxBased?: boolean;
  /** Shown under the list, and under the notice of an empty cart. */
  children?: ReactNode;
}) {
  const t = useTranslations("cart");
  const tProduct = useTranslations("product");
  const locale = useLocale() as Locale;
  const cart = useCart();
  const { bill, loading, updating, error, refetch } = useBill();

  // Before "empty": a stored cart that could not be read has no lines to
  // show, which is not the same as a cart without products.
  if (error && !bill) {
    return (
      <ErrorAlert error={error} title={t("loadError")} onRetry={refetch} />
    );
  }

  if (cart.ready && cart.items.length === 0) {
    return (
      <div className="grid gap-5">
        <div className="glass animate-rise flex flex-col items-center gap-4 rounded-2xl px-6 py-16 text-center">
          <span className="bg-leaf-50 text-leaf-700 grid size-[4.75rem] place-items-center rounded-full">
            <ShoppingBag aria-hidden="true" className="size-8" />
          </span>
          <h2 className="font-display text-ink text-2xl">{t("emptyTitle")}</h2>
          <p className="text-ink-muted max-w-md">{t("emptyText")}</p>
          <Link href="/products" className={buttonStyles()}>
            {t("emptyCta")}
          </Link>
        </div>
        {children}
      </div>
    );
  }

  if (loading || !bill) return <CartSkeleton boxes={boxBased} />;

  // Lines the customer just removed disappear at once.
  const lines = bill.lines.filter(
    (line) => cart.quantityOf(line.variantId) > 0,
  );
  const hasIssues = lines.some((line) => line.issue !== null);
  // Delivery by the box; `null` (or absent, from an older API): the flat fee.
  const shipping = bill.shipping ?? null;
  const freeDeliveryCode = freeDeliveryCodeOf(bill);
  const canGo = bill.canOrder && !updating;

  return (
    <div className={columns}>
      <div className="grid min-w-0 gap-[1.125rem] lg:col-start-1">
        {cart.problem &&
          (cart.problem === "cart_full" ? (
            <Alert tone="warn">{tProduct("cartFull")}</Alert>
          ) : (
            <ErrorAlert error={cart.problem} />
          ))}
        {/* From `sm` the list is the grid of the rows: the picture, the
            texts in the room that is left, then the stepper, the total of
            the line and the two buttons, each as wide as the widest of
            its kind. The row sets the same gap as the list, or the
            browser would widen the tracks by the difference. */}
        <ul
          aria-label={t("title")}
          className="glass animate-rise divide-y divide-white/70 rounded-2xl px-3.5 py-1 sm:grid sm:grid-cols-[4.75rem_minmax(0,1fr)_auto_auto_auto] sm:gap-x-4 sm:px-[1.375rem] sm:py-2"
        >
          {lines.map((line) => (
            <CartLine key={line.variantId} line={line} updating={updating} />
          ))}
        </ul>
      </div>

      <aside
        aria-label={t("summary")}
        className="flex min-w-0 flex-col gap-3.5 lg:sticky lg:top-28 lg:col-start-2 lg:row-span-2 lg:row-start-1"
      >
        <div className="glass-strong animate-rise flex flex-col gap-4 rounded-2xl p-[1.125rem] [animation-delay:60ms] sm:p-6">
          <h2 className="font-display text-ink text-xl">{t("summary")}</h2>

          {!shipping && (
            <FreeDeliveryProgress
              delivery={bill.delivery}
              subtotal={bill.totals.subtotal - bill.totals.discount}
            />
          )}

          <div
            className={cn(
              "transition-opacity duration-200",
              updating && "opacity-50",
            )}
            aria-busy={updating}
          >
            <BillTotals
              totals={bill.totals}
              savings={saleSavingsOf(bill.lines)}
              discountCode={bill.discount?.applied ? bill.discount.code : null}
              coins={bill.rewards?.applied ? bill.rewards.coins : null}
              boxes={shipping}
              freeDeliveryCode={freeDeliveryCode}
              regularDeliveryFee={shipping?.regularFee}
            />
          </div>
          <p className="sr-only" role="status">
            {updating ? t("updating") : ""}
          </p>

          {hasIssues && <Alert tone="warn">{t("fixIssues")}</Alert>}

          {canGo ? (
            <Link
              href="/checkout"
              className={buttonStyles({
                size: "lg",
                block: true,
                className: "group min-h-14 text-[1.03125rem] font-bold",
              })}
            >
              {t("checkout")}
              <ArrowRight
                aria-hidden="true"
                className="ease-glass size-[1.125rem] transition-transform duration-200 group-hover:translate-x-1"
                strokeWidth={2.25}
              />
            </Link>
          ) : (
            <Button
              size="lg"
              block
              disabled
              className="min-h-14 text-[1.03125rem] font-bold"
            >
              {t("checkout")}
            </Button>
          )}
          <div className="text-ink-muted flex flex-col gap-1.5 text-center text-[0.8125rem] leading-snug">
            {cart.mode === "guest" && bill.canOrder && <p>{t("signInHint")}</p>}
            <p>{t("payNote")}</p>
          </div>

          <Link
            href="/products"
            className="text-leaf-700 hover:text-leaf-800 self-center rounded-xs font-semibold underline underline-offset-4"
          >
            {t("continue")}
          </Link>
        </div>

        {/* The boxes belong to the bill on the screen: while a change is
            on its way they dim with the totals and keep the last figures. */}
        {shipping && shipping.requiredBoxes > 0 && (
          <BoxShipping
            shipping={shipping}
            code={freeDeliveryCode}
            className={cn(
              "animate-rise transition-opacity duration-200 [animation-delay:120ms]",
              updating && "opacity-50",
            )}
          />
        )}
      </aside>

      {children && <div className="min-w-0 lg:col-start-1">{children}</div>}

      {/* On phones the total and the way to the checkout stay in reach:
          a pill of glass that floats above the tab bar. */}
      <div className="glass-strong shadow-float fixed inset-x-2.5 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3.5 rounded-full py-2 pr-2 pl-5 md:hidden">
        <p className="flex min-w-0 flex-1 flex-col leading-tight">
          <span className="text-ink-muted text-[0.8125rem]">{t("total")}</span>
          <span
            className={cn(
              "font-display text-lg tabular-nums transition-opacity duration-200",
              updating && "opacity-50",
            )}
          >
            {formatMoney(bill.totals.total, locale)}
          </span>
        </p>
        {canGo ? (
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
