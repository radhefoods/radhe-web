import { ChevronDown, Package, PackageCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, type ReactNode } from "react";
import {
  isBoxFull,
  shippingMessageOf,
  shippingProgressOf,
} from "@/features/cart/shipping";
import type { Locale } from "@/i18n/routing";
import type { BillShipping } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format/money";
import { formatWeight } from "@/lib/format/weight";

/** Boxes that show at once in the list; a longer list scrolls inside. */
const VISIBLE_BOXES = 5;

/** The small capitals over a meter. */
const label =
  "text-ink-subtle text-[0.6875rem] leading-4 font-bold tracking-[0.08em] uppercase";

/** A thin meter. The text under it says the same in numbers. */
function Meter({ part, className }: { part: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-ink/9 block h-1.5 overflow-hidden rounded-full",
        className,
      )}
    >
      <span
        className="bg-leaf-600 ease-glass block h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${Math.round(Math.max(0, Math.min(1, part)) * 100)}%`,
        }}
      />
    </span>
  );
}

/**
 * The boxes of an order, as a quiet card of its own under the button of
 * the cart and of the checkout (owner, 2026-11-24, after the design "Two
 * Meters" of the lab): one line that says what the boxes cost, one meter
 * for the room in the box the next goods go into, one for the way to the
 * next free box, and a closing line with the count of the boxes. An order
 * of several boxes can unfold them one by one, with weight and fee.
 *
 * The wording is the owner's: "Your 1st box ships free", "… available",
 * "… to go", "2 boxes: 1 free, 1 chargeable"; never "1 box free".
 *
 * Every weight, fee and amount is the API's (`bill.shipping`,
 * doc/BOX_BASED_SHIPPING_WEB_INTEGRATION.md 5 and 6); only the length of
 * the second meter is worked out here, by the document's formula. The
 * room in a box is a guide, not a promise (the next pack may be heavier
 * than the room and start a new box), so it is rounded down. Nothing
 * while there is nothing to deliver, and nothing under the flat fee: the
 * caller shows this card only for a bill with `shipping`.
 */
export function BoxShipping({
  shipping,
  code,
  className,
}: {
  shipping: BillShipping;
  /** The free-delivery code of the bill, to name it; `null` without one. */
  code: string | null;
  className?: string;
}) {
  const t = useTranslations("shipping");
  const tCart = useTranslations("cart");
  const locale = useLocale() as Locale;
  const titleId = useId();
  const message = shippingMessageOf(shipping, code);
  if (message.kind === "none") return null;

  const money = (cents: number) => formatMoney(cents, locale);
  const weight = (grams: number) => formatWeight(grams, locale);
  const b = (chunks: ReactNode) => (
    <b className="text-ink font-semibold">{chunks}</b>
  );
  const { boxes, currentBox, requiredBoxes: count } = shipping;
  // Nothing left to pay for the delivery.
  const reached = message.kind === "free" || message.kind === "freeByCode";
  // One box that is filled; a single pack that travels alone is a parcel.
  const parcel = count === 1 && boxes[0]?.separate === true;
  const single = count === 1 && !parcel;
  const fitsOne = parcel
    ? t("usesParcel")
    : t("usesOne", {
        weight: weight(shipping.weight.total),
        max: weight(shipping.box.maxWeight),
      });

  /** What the boxes cost, in a line. */
  let status: string;
  /** How many boxes the order uses, and what the paid ones cost. */
  let uses: string;
  let extra: string | null = null;
  switch (message.kind) {
    case "freeByCode":
      status = t("statusByCode", { code: message.code });
      uses = count === 1 ? fitsOne : t("usesByCode", { count });
      break;
    case "free":
      status = count === 1 ? t("statusOneFree") : t("statusAllFree", { count });
      uses = count === 1 ? fitsOne : t("usesAllFree", { count });
      break;
    case "oneBox":
      status = t("statusOnePaid", { fee: money(message.feePerPaidBox) });
      uses = fitsOne;
      break;
    case "noThreshold":
    case "noneFree": {
      const perBox = money(message.feePerPaidBox);
      status =
        count === 1
          ? t("statusOnePaid", { fee: perBox })
          : t("statusNoneFree", { count, perBox });
      uses = count === 1 ? fitsOne : t("usesNoneFree", { count, perBox });
      break;
    }
    case "someFree": {
      status = t("statusSomeFree", { free: message.freeBoxes });
      uses = t("usesSomeFree", {
        count,
        free: message.freeBoxes,
        paid: message.paidBoxes,
      });
      // The one box that costs something is named by its place; the API
      // lists the first 50 boxes, so it may not be among them.
      const paidBox =
        message.paidBoxes === 1 ? boxes.find((box) => !box.free) : undefined;
      extra = paidBox
        ? t("extraOne", { number: paidBox.number, fee: money(paidBox.fee) })
        : t("extraSeveral", {
            paid: message.paidBoxes,
            perBox: money(message.feePerPaidBox),
          });
      break;
    }
  }

  // The way to the next free box; no meter where no box is ever free by
  // the value of the goods.
  const progress = shippingProgressOf(shipping);
  const missing = shipping.missingForNextFreeBox;
  const next =
    progress === null ? null : (
      <div className="grid min-w-0 content-start gap-1.5">
        <span className={label}>
          {t("nextLabel", { count: reached ? 1 : count })}
        </span>
        <Meter part={progress} />
        <span>
          {message.kind === "freeByCode"
            ? t("nextByCode", { code: message.code })
            : reached || missing === null
              ? t("nextReached")
              : t.rich("nextValue", { amount: money(missing), b })}
        </span>
      </div>
    );
  const space = currentBox && (
    <div className="grid min-w-0 content-start gap-1.5">
      <span className={label}>
        {t("spaceLabel", { count, number: currentBox.number })}
      </span>
      <Meter part={currentBox.utilization / 100} />
      <span>
        {isBoxFull(currentBox)
          ? t.rich("spaceFull", { b })
          : t.rich("spaceValue", {
              room: formatWeight(currentBox.remaining, locale, {
                round: "down",
              }),
              b,
            })}
      </span>
    </div>
  );

  const more = count - boxes.length;
  const scrolls = boxes.length > VISIBLE_BOXES;
  const Icon = reached ? PackageCheck : Package;
  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "glass text-ink-muted rounded-xl p-4 text-[0.8125rem] leading-snug tabular-nums sm:px-5",
        className,
      )}
    >
      <h3 id={titleId} className="sr-only">
        {t("boxesTitle", { count })}
      </h3>
      <p className="text-ink flex items-start gap-2 text-sm font-semibold">
        <Icon
          aria-hidden="true"
          className="text-leaf-600 mt-px size-[1.125rem] shrink-0"
          strokeWidth={1.9}
        />
        {status}
      </p>

      {(space || next) && (
        <div
          className={cn(
            "mt-3 grid gap-x-5 gap-y-3",
            space && next && "grid-cols-2",
          )}
        >
          {space}
          {next}
        </div>
      )}

      <p className="border-ink/8 text-ink-subtle mt-3 border-t pt-2.5 text-xs leading-relaxed">
        {uses}
        {extra && <> {extra}</>}
        {shipping.weight.estimated && <> {t("approximate")}</>}
      </p>

      {!single && boxes.length > 0 && (
        <details className="group disclosure-fold mt-1">
          <summary className="text-ink hover:text-leaf-700 -mx-1 flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 rounded-sm px-1 text-xs font-semibold transition-colors duration-200 [&::-webkit-details-marker]:hidden">
            <span>{t("details")}</span>
            <span className="text-ink-subtle flex items-center gap-1.5 font-medium">
              {t("totalWeight", { weight: weight(shipping.weight.total) })}
              <ChevronDown
                aria-hidden="true"
                className="ease-glass size-4 transition-transform duration-300 group-open:rotate-180"
              />
            </span>
          </summary>
          <ul
            // A list that scrolls must be reachable without a mouse.
            tabIndex={scrolls ? 0 : undefined}
            aria-labelledby={scrolls ? titleId : undefined}
            className={cn(
              "grid grid-cols-[auto_minmax(2rem,1fr)_auto_auto] items-center gap-x-2.5 gap-y-2 pt-1 pb-0.5",
              scrolls &&
                "-mr-2 max-h-[8.5rem] scrollbar-thin overflow-y-auto pr-2",
            )}
          >
            {boxes.map((box) => (
              <li
                key={box.number}
                className="col-span-4 grid grid-cols-subgrid items-center"
              >
                {box.separate ? (
                  <span className="text-ink col-span-2 font-semibold">
                    {t("separate")}
                  </span>
                ) : (
                  <>
                    <span className="text-ink font-semibold whitespace-nowrap">
                      {t("box", { number: box.number })}
                    </span>
                    <Meter part={box.utilization / 100} className="h-1" />
                  </>
                )}
                <span className="text-right whitespace-nowrap">
                  {weight(box.weight)}
                </span>
                <span
                  className={cn(
                    "min-w-11 text-right font-semibold whitespace-nowrap",
                    box.free ? "text-leaf-700" : "text-ink",
                  )}
                >
                  {box.free
                    ? tCart("deliveryFree")
                    : formatMoney(box.fee, locale)}
                </span>
              </li>
            ))}
          </ul>
          {more > 0 && <p className="pt-1.5">{t("more", { count: more })}</p>}
        </details>
      )}
    </section>
  );
}
