"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { ProblemToast } from "@/components/shell/problem-toast";
import { SuccessToast } from "@/components/shell/success-toast";
import { useStockAlerts } from "@/features/stock-alerts/stock-alerts";
import { useErrorText } from "@/lib/api/error-text";

/** Long enough to read two lines, short enough not to be in the way. */
const PROBLEM_VISIBLE_MS = 8000;

/**
 * What "Notify me" has to say where its control has no room for it: the
 * bell of a product card (doc 26). At the top of the window, as the
 * wishlist and the cart say theirs: that the email is on its way to the
 * customer's address, or why the request was refused.
 */
export function StockAlertNotice() {
  const tCommon = useTranslations("common");
  const errorText = useErrorText();
  const { notice, clearNotice } = useStockAlerts();

  useEffect(() => {
    if (notice?.tone !== "bad") return;
    const timer = window.setTimeout(clearNotice, PROBLEM_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [notice, clearNotice]);

  if (!notice) return null;
  return notice.tone === "good" ? (
    // A second word while the first is still there starts the clock anew.
    <SuccessToast
      key={notice.text}
      closeLabel={tCommon("close")}
      onClose={clearNotice}
    >
      {notice.text}
    </SuccessToast>
  ) : (
    <ProblemToast closeLabel={tCommon("close")} onClose={clearNotice}>
      {errorText(notice.error)}
    </ProblemToast>
  );
}
