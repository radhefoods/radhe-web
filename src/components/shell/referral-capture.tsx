"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { rememberReferralCode } from "@/lib/referral/referral-code";

/**
 * Reads `?ref=<code>` from the address of any page (doc 21) and keeps the
 * code for 30 days, so that a sign-up that follows, now or on a later
 * visit, sends it as `referralCode`. Renders nothing.
 */
export function ReferralCapture() {
  const ref = useSearchParams().get("ref");
  useEffect(() => {
    if (ref) rememberReferralCode(ref);
  }, [ref]);
  return null;
}
