"use client";

import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ProductCard } from "@/components/catalogue/product-card";
import { ProductGrid } from "@/components/catalogue/product-grid";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useWishlist, useWishlistProducts } from "@/features/wishlist/wishlist";
import {
  useNamedWishlist,
  useStoreWishlist,
  useWishlists,
  useWishlistsRefresh,
} from "@/features/wishlist/wishlists";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api/browser";
import type { Id, Wishlist, WishlistSummary } from "@/lib/api/types";
import { productTitle } from "@/lib/format/product-name";
import { WishlistItemActions } from "./wishlist-item-actions";
import { WishlistLists } from "./wishlist-lists";

function WishlistSkeleton() {
  return (
    <div
      className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
      aria-hidden="true"
    >
      {[0, 1, 2, 3].map((card) => (
        <Skeleton key={card} className="aspect-[4/5] rounded-xl" />
      ))}
    </div>
  );
}

function Empty() {
  const t = useTranslations("wishlist");
  return (
    <div className="glass flex flex-col items-center gap-4 rounded-3xl px-6 py-16 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-red-50 text-red-600">
        <Heart aria-hidden="true" className="size-7" />
      </span>
      <h2 className="font-display text-ink text-xl">{t("emptyTitle")}</h2>
      <p className="text-ink-muted max-w-md">{t("emptyText")}</p>
      <Link href="/products" className={buttonStyles()}>
        {t("emptyCta")}
      </Link>
    </div>
  );
}

/** "Remove all" with a second tap to confirm. */
function ClearAll({ count, onClear }: { count: number; onClear: () => void }) {
  const t = useTranslations("wishlist");
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">
          {t("clearConfirm", { count })}
        </span>
        <Button
          variant="danger"
          size="sm"
          onClick={() => {
            onClear();
            setConfirming(false);
          }}
        >
          {t("clearYes")}
        </Button>
        <Button variant="quiet" size="sm" onClick={() => setConfirming(false)}>
          {t("clearNo")}
        </Button>
      </div>
    );
  }
  return (
    <Button variant="quiet" size="sm" onClick={() => setConfirming(true)}>
      {t("clear")}
    </Button>
  );
}

/**
 * The wishlist page of a visitor (doc 16): the list the API rendered from
 * the browser's copy, and a line that says signing in keeps it on every
 * device.
 */
function GuestWishlist() {
  const t = useTranslations("wishlist");
  const { has, clear } = useWishlist();
  const { wishlist, loading, error, refetch } = useWishlistProducts();

  if (error && !wishlist) {
    return (
      <ErrorAlert error={error} title={t("loadError")} onRetry={refetch} />
    );
  }
  if (loading || !wishlist) return <WishlistSkeleton />;
  // What was just taken off the list disappears at once.
  const items = wishlist.items.filter((item) => has(item.productId));
  if (items.length === 0) return <Empty />;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-ink-muted font-semibold">
          {t("count", { count: items.length })}
        </p>
        <ClearAll count={items.length} onClear={clear} />
      </div>
      <p className="glass rounded-xl px-4 py-3 text-[0.9375rem]">
        {t("guestHint")}{" "}
        <Link
          href={{ pathname: "/sign-in", query: { returnTo: "/wishlist" } }}
          className="text-leaf-700 rounded-xs font-semibold underline underline-offset-4"
        >
          {t("guestSignIn")}
        </Link>
      </p>
      <ProductGrid
        products={items.map((item) => item.product)}
        headingLevel="h2"
        wide
      />
    </div>
  );
}

/**
 * The products of one list as the cards of the catalogue, each shown as
 * the pack size it was saved from, with "Move to …", "Copy to …" and, on
 * a named list, "Remove" under it (doc 16.2).
 */
function ListProducts({
  list,
  lists,
  wishlist,
}: {
  list: WishlistSummary;
  lists: WishlistSummary[];
  wishlist: Wishlist;
}) {
  const { has } = useWishlist();
  // On the default list, what the heart just took off disappears at once.
  const items = list.isDefault
    ? wishlist.items.filter((item) => has(item.productId))
    : wishlist.items;
  if (items.length === 0) return <Empty />;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item, index) => (
        <li key={item.productId} className="flex flex-col">
          <ProductCard
            product={item.product}
            headingLevel="h2"
            priority={index < 4}
          />
          <WishlistItemActions
            list={list}
            lists={lists}
            productId={item.productId}
            name={productTitle(item.product.name, item.product.packSize)}
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * The wishlist page of a customer (doc 16.2): the lists to choose from,
 * the chosen one named as the title with its products, "Remove all" with
 * a second tap. The default list is the one the heart and the header
 * count stand for; an API without named lists shows that one list alone.
 */
function CustomerWishlist() {
  const t = useTranslations("wishlist");
  const { clear } = useWishlist();
  const listsQuery = useWishlists();
  const [chosen, setChosen] = useState<Id | null>(null);
  const stored = useWishlistProducts();
  const named = useNamedWishlist(chosen);
  const store = useStoreWishlist();
  const refresh = useWishlistsRefresh();
  const [clearError, setClearError] = useState<unknown>(null);

  const lists = listsQuery.data ?? [];
  const current =
    (chosen ? lists.find((list) => list.id === chosen) : null) ??
    lists.find((list) => list.isDefault) ??
    null;
  const onDefault = current === null || current.isDefault;
  const wishlist = onDefault ? stored.wishlist : (named.data ?? null);
  const loading = onDefault ? stored.loading : named.isPending;
  const error = onDefault ? stored.error : named.error;
  const count = wishlist?.items.length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display text-ink text-3xl sm:text-4xl">
        {current?.name ?? t("title")}
      </h1>
      {lists.length > 0 && current && (
        <WishlistLists lists={lists} current={current} onChoose={setChosen} />
      )}
      {listsQuery.error && lists.length === 0 && (
        <ErrorAlert error={listsQuery.error} title={t("loadError")} />
      )}

      {clearError !== null && <ErrorAlert error={clearError} />}
      {error && !wishlist ? (
        <ErrorAlert
          error={error}
          title={t("loadError")}
          onRetry={() => (onDefault ? stored.refetch() : void named.refetch())}
        />
      ) : loading || !wishlist ? (
        <WishlistSkeleton />
      ) : (
        <>
          {count > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <p className="text-ink-muted font-semibold">
                {t("count", { count })}
              </p>
              <ClearAll
                count={count}
                onClear={() => {
                  if (onDefault) {
                    clear();
                    refresh();
                    return;
                  }
                  setClearError(null);
                  void api
                    .clearWishlistById(current.id)
                    .then((emptied) => {
                      store(emptied);
                      refresh();
                    })
                    .catch((caught: unknown) => {
                      setClearError(caught);
                      void named.refetch();
                    });
                }}
              />
            </div>
          )}
          {current ? (
            <ListProducts list={current} lists={lists} wishlist={wishlist} />
          ) : wishlist.items.length === 0 ? (
            <Empty />
          ) : (
            <ProductGrid
              products={wishlist.items.map((item) => item.product)}
              headingLevel="h2"
              wide
            />
          )}
        </>
      )}
    </div>
  );
}

/** The wishlist page: a visitor's list, or a customer's lists. */
export function WishlistView() {
  const t = useTranslations("wishlist");
  const { mode, ready } = useWishlist();
  if (!ready && mode === "guest") {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("title")}
        </h1>
        <WishlistSkeleton />
      </div>
    );
  }
  if (mode === "guest") {
    return (
      <div className="flex flex-col gap-5">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("title")}
        </h1>
        <GuestWishlist />
      </div>
    );
  }
  return <CustomerWishlist />;
}
