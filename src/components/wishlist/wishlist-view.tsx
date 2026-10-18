"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useWishlist, useWishlistProducts } from "@/features/wishlist/wishlist";
import { Link } from "@/i18n/navigation";

function WishlistSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((card) => (
        <Skeleton key={card} className="aspect-[4/5] rounded-lg" />
      ))}
    </div>
  );
}

/**
 * The wishlist page (doc 16): the saved products as the cards of the
 * catalogue, each shown as the pack size it was saved from, with the
 * heart to take it off the list and "Add to cart" for that size; how many
 * there are, and "Remove all" with a second tap to confirm. A visitor sees
 * the list the API rendered from the browser's copy and a line that says
 * signing in keeps it on every device.
 */
export function WishlistView() {
  const t = useTranslations("wishlist");
  const { mode, has, clear } = useWishlist();
  const { wishlist, loading, error, refetch } = useWishlistProducts();
  const [confirming, setConfirming] = useState(false);

  if (error && !wishlist) {
    return (
      <ErrorAlert error={error} title={t("loadError")} onRetry={refetch} />
    );
  }
  if (loading || !wishlist) return <WishlistSkeleton />;

  // What was just taken off the list disappears at once.
  const items = wishlist.items.filter((item) => has(item.productId));

  if (items.length === 0) {
    return (
      <div className="bg-mist flex flex-col items-center gap-4 rounded-xl px-6 py-16 text-center">
        <Heart aria-hidden="true" className="text-ink-subtle size-10" />
        <h2 className="font-display text-ink text-xl">{t("emptyTitle")}</h2>
        <p className="text-ink-muted max-w-md">{t("emptyText")}</p>
        <Link href="/products" className={buttonStyles()}>
          {t("emptyCta")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-ink-muted font-semibold">
          {t("count", { count: items.length })}
        </p>
        {confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">
              {t("clearConfirm", { count: items.length })}
            </span>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                clear();
                setConfirming(false);
              }}
            >
              {t("clearYes")}
            </Button>
            <Button
              variant="quiet"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              {t("clearNo")}
            </Button>
          </div>
        ) : (
          <Button variant="quiet" size="sm" onClick={() => setConfirming(true)}>
            {t("clear")}
          </Button>
        )}
      </div>

      {mode === "guest" && (
        <p className="bg-mist rounded-md px-4 py-3 text-[0.9375rem]">
          {t("guestHint")}{" "}
          <Link
            href={{ pathname: "/sign-in", query: { returnTo: "/wishlist" } }}
            className="text-leaf-700 rounded-xs font-semibold underline underline-offset-4"
          >
            {t("guestSignIn")}
          </Link>
        </p>
      )}

      <ProductGrid
        products={items.map((item) => item.product)}
        headingLevel="h2"
        wide
      />
    </div>
  );
}
