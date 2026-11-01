"use client";

import { ArrowRightLeft, Copy, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { controlStyles } from "@/components/ui/field";
import {
  useStoreWishlist,
  useWishlistsRefresh,
} from "@/features/wishlist/wishlists";
import { api } from "@/lib/api/browser";
import type { Id, WishlistSummary } from "@/lib/api/types";
import { cn } from "@/lib/cn";

/**
 * Under a card of the wishlist page (doc 16.2): "Move to …" and "Copy to …"
 * with the other lists to choose from, and on a named list "Remove", since
 * the heart on the card stands for the default list alone.
 */
export function WishlistItemActions({
  list,
  lists,
  productId,
  name,
}: {
  /** The list the card is on. */
  list: WishlistSummary;
  /** Every list of the customer. */
  lists: WishlistSummary[];
  productId: Id;
  /** The name with the size, for the spoken labels. */
  name: string;
}) {
  const t = useTranslations("wishlist");
  const refresh = useWishlistsRefresh();
  const store = useStoreWishlist();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const others = lists.filter((other) => other.id !== list.id);

  async function transfer(to: Id, copy: boolean) {
    setBusy(true);
    setError(null);
    try {
      const answer = await api.transferWishlistItem(list.id, productId, {
        to,
        ...(copy && { copy: true }),
      });
      store(answer);
      const target = lists.find((other) => other.id === to);
      refresh({ defaultList: Boolean(target?.isDefault), lists: [to] });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      store(await api.removeWishlistItemFrom(list.id, productId));
      refresh();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  const select = cn(controlStyles, "min-h-10 rounded-full py-0 text-sm");

  return (
    <div className="mt-2 flex flex-col gap-2">
      {others.length > 0 && (
        <div className="flex flex-col gap-2">
          <label className="relative">
            <span className="sr-only">{t("moveNamed", { name })}</span>
            <ArrowRightLeft
              aria-hidden="true"
              className="text-leaf-700 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <select
              value=""
              disabled={busy}
              onChange={(event) => {
                if (event.target.value)
                  void transfer(event.target.value, false);
              }}
              className={cn(select, "pl-9")}
            >
              <option value="">{t("moveTo")}</option>
              {others.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.name}
                </option>
              ))}
            </select>
          </label>
          <label className="relative">
            <span className="sr-only">{t("copyNamed", { name })}</span>
            <Copy
              aria-hidden="true"
              className="text-leaf-700 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <select
              value=""
              disabled={busy}
              onChange={(event) => {
                if (event.target.value) void transfer(event.target.value, true);
              }}
              className={cn(select, "pl-9")}
            >
              <option value="">{t("copyTo")}</option>
              {others.map((other) => (
                <option key={other.id} value={other.id}>
                  {other.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {!list.isDefault && (
        <Button
          variant="quiet"
          size="sm"
          loading={busy}
          aria-label={t("removeNamed", { name })}
          onClick={() => void remove()}
          className="self-start"
        >
          {!busy && <X aria-hidden="true" className="size-4" />}
          {t("removeFromList")}
        </Button>
      )}
      {error !== null && <ErrorAlert error={error} />}
    </div>
  );
}
