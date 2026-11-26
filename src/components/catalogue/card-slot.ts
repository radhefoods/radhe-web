/**
 * The slot at the end of a product card's price row: the room the price
 * leaves, with whatever stands in it at its right end (the basket, the
 * stepper that unfolds in its place, or the bell of "Notify me"). Never
 * narrower than the stepper; on a card narrower than 14 rem it is a row of
 * its own under the price. Why it is built this way is told in
 * `product-card.tsx`.
 */
export const cardSlot =
  "flex h-10 w-full min-w-20 items-center justify-end sm:min-w-21 @min-[14rem]:w-auto @min-[14rem]:flex-1";
