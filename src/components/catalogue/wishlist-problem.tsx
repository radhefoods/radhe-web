"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { ProblemToast } from "@/components/shell/problem-toast";
import { useWishlist } from "@/features/wishlist/wishlist";
import { useErrorText } from "@/lib/api/error-text";

/** Long enough to read two lines, short enough not to be in the way. */
const VISIBLE_MS = 8000;

/**
 * Says why a product did not get onto the wishlist (the list is full, the
 * product is gone, the shop cannot be reached), wherever the heart was
 * tapped; the heart itself has turned back by then (doc 16).
 */
export function WishlistProblem() {
  const t = useTranslations("product");
  const tCommon = useTranslations("common");
  const errorText = useErrorText();
  const { problem, clearProblem } = useWishlist();

  useEffect(() => {
    if (!problem) return;
    const timer = window.setTimeout(clearProblem, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [problem, clearProblem]);

  if (!problem) return null;
  return (
    <ProblemToast closeLabel={tCommon("close")} onClose={clearProblem}>
      {problem === "wishlist_full" ? t("wishlistFull") : errorText(problem)}
    </ProblemToast>
  );
}
