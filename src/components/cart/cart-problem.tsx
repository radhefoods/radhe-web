"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useCart } from "@/features/cart/cart";
import { usePathname } from "@/i18n/navigation";
import { useErrorText } from "@/lib/api/error-text";

/** Long enough to read two lines, short enough not to be in the way. */
const VISIBLE_MS = 8000;

/**
 * Says why a product did not get into the cart (the cart is full, the
 * limit of this delivery is reached, the shop cannot be reached), wherever
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
    <div
      role="alert"
      className="shadow-float fixed inset-x-3 top-3 z-50 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 py-3 pr-2 pl-4 text-[0.9375rem] font-semibold text-red-800 sm:right-5 sm:left-auto sm:max-w-sm"
    >
      <p className="min-w-0 flex-1 py-1.5">
        {problem === "cart_full" ? t("cartFull") : errorText(problem)}
      </p>
      <button
        type="button"
        aria-label={tCommon("close")}
        onClick={clearProblem}
        className="grid size-9 shrink-0 place-items-center rounded-sm hover:bg-red-100"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}
