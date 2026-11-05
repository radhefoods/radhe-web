"use client";

import { useState, type ComponentProps } from "react";
import { Link } from "@/i18n/navigation";

/**
 * A link that is prefetched when the visitor shows they mean it (the
 * pointer over it, a finger on it, the keyboard's focus), not when it
 * scrolls into view. For the cards of the lists and rows: a list page has
 * twenty and more of them, and Next.js would fetch the full page behind
 * each one as it appears, every one a page rendered on the server with
 * its own calls to the API, for products nobody opens. The pattern is the
 * one of the Next.js guide on prefetching.
 */
export function IntentLink(props: ComponentProps<typeof Link>) {
  const [meant, setMeant] = useState(false);
  const mean = () => setMeant(true);
  return (
    <Link
      {...props}
      // `null` is the default behaviour again: in view, so fetched now.
      prefetch={meant ? null : false}
      onPointerEnter={mean}
      onTouchStart={mean}
      onFocus={mean}
    />
  );
}
