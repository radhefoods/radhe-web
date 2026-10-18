"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { ProblemToast } from "@/components/shell/problem-toast";
import { useCart } from "@/features/cart/cart";
import { usePathname } from "@/i18n/navigation";
import { useErrorText } from "@/lib/api/error-text";

/** Long enough to read two lines, short enough not to be in the way. */
const VISIBLE_MS = 8000;

/**
 * Says why a product did not get into the cart (the cart is full, the
 * product is gone, the shop cannot be reached), wherever
 * the customer tapped "add": on a product list, a product page, the home
 * page. The cart page shows the same message in its own place.
 */
export function CartProblem() {
  const t = useTranslations("product");
  const tCommon = useTranslations("common");
  const errorText = useErrorText();
  const pathname = usePathname();
  const { problem, clearProblem } = useCart();

  useEffect(() => {
    if (!problem) return;
    const timer = window.setTimeout(clearProblem, VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [problem, clearProblem]);

  if (!problem || pathname === "/cart") return null;
  return (
    <ProblemToast closeLabel={tCommon("close")} onClose={clearProblem}>
      {problem === "cart_full" ? t("cartFull") : errorText(problem)}
    </ProblemToast>
  );
}
