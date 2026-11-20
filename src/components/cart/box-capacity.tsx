import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import { isBoxFull } from "@/features/cart/shipping";
import type { Locale } from "@/i18n/routing";
import type { BillShipping } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format/money";
import { formatWeight } from "@/lib/format/weight";

/** Boxes that show at once; a longer list scrolls inside, like the checkout's items. */
const VISIBLE_BOXES = 5;

/** How full a box is. The text beside it says the same in numbers. */
function Bar({ percent, className }: { percent: number; className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "ring-ink/8 overflow-hidden rounded-full bg-white ring-1 ring-inset",
        className,
      )}
    >
      <div
        className="leaf-gradient ease-glass h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

/**
 * How full the boxes of a cart are
 * (doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md, 6): the smaller indicator
 * under the free-delivery progress. One box is one bar with its weight and
 * the room that is left; several boxes are a row each, with the weight and
 * "Free" or the fee; a pack that travels alone is a "Separate parcel"
 * without a bar. The API lists the first 50 boxes and counts them all.
 *
 * The room in a box is a guide, not a promise (the next pack may be
 * heavier than the room and start a new box), so it is rounded down.
 * Every weight, every fee and every percentage is the API's.
 */
export function BoxCapacity({
  shipping,
  className,
}: {
  shipping: BillShipping;
  className?: string;
}) {
  const t = useTranslations("shipping");
  const tCart = useTranslations("cart");
  const locale = useLocale() as Locale;
  const titleId = useId();
  const { boxes, currentBox, requiredBoxes } = shipping;
  if (requiredBoxes === 0 || boxes.length === 0) return null;

  const weight = (grams: number) => formatWeight(grams, locale);
  const room = (grams: number) =>
    formatWeight(grams, locale, { round: "down" });
  // One box that is filled: one bar. A single pack that travels alone is
  // listed like the boxes of a larger order.
  const single = requiredBoxes === 1 && !boxes[0].separate;
  const more = requiredBoxes - boxes.length;
  const scrolls = boxes.length > VISIBLE_BOXES;

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "ring-ink/6 rounded-xl bg-white/70 p-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.7)] ring-1",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={titleId} className="text-sm font-bold">
          {t("boxesTitle", { count: requiredBoxes })}
        </h3>
        <p className="text-ink-muted text-xs font-semibold tabular-nums">
          {single
            ? t("load", {
                weight: weight(shipping.weight.total),
                max: weight(shipping.box.maxWeight),
              })
            : weight(shipping.weight.total)}
        </p>
      </div>

      {single ? (
        <Bar
          percent={(currentBox ?? boxes[0]).utilization}
          className="mt-2.5 h-2.5"
        />
      ) : (
        <ul
          // A list that scrolls must be reachable without a mouse.
          tabIndex={scrolls ? 0 : undefined}
          aria-labelledby={scrolls ? titleId : undefined}
          className={cn(
            "mt-2.5 grid grid-cols-[auto_minmax(2rem,1fr)_auto_auto] items-center gap-x-2.5 gap-y-2 text-sm",
            scrolls &&
              "-mr-2 max-h-[9.25rem] scrollbar-thin overflow-y-auto pr-2",
          )}
        >
          {boxes.map((box) => (
            <li
              key={box.number}
              className="col-span-4 grid grid-cols-subgrid items-center"
            >
              {box.separate ? (
                <span className="col-span-2 font-semibold">
                  {t("separate")}
                </span>
              ) : (
                <>
                  <span className="font-semibold whitespace-nowrap">
                    {t("box", { number: box.number })}
                  </span>
                  <Bar percent={box.utilization} className="h-2" />
                </>
              )}
              <span className="text-ink-muted text-right whitespace-nowrap tabular-nums">
                {weight(box.weight)}
              </span>
              <span
                className={cn(
                  "min-w-12 text-right whitespace-nowrap tabular-nums",
                  box.free ? "text-leaf-700 font-bold" : "font-semibold",
                )}
              >
                {box.free
                  ? tCart("deliveryFree")
                  : formatMoney(box.fee, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {more > 0 && (
        <p className="text-ink-muted mt-2 text-sm">
          {t("more", { count: more })}
        </p>
      )}
      {currentBox && (
        <p className="text-ink-muted mt-2.5 text-sm leading-snug">
          {isBoxFull(currentBox)
            ? t("full", { count: requiredBoxes })
            : single
              ? t("roomOne", { room: room(currentBox.remaining) })
              : t("roomSeveral", {
                  number: currentBox.number,
                  room: room(currentBox.remaining),
                })}
        </p>
      )}
      {shipping.weight.estimated && (
        <p className="text-ink-subtle mt-1 text-xs">{t("approximate")}</p>
      )}
    </section>
  );
}
