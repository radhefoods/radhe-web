"use client";

import { useSyncExternalStore } from "react";
import {
  storedReferralCode,
  subscribeReferralCode,
} from "@/lib/referral/referral-code";

/**
 * The code kept from a referral link (doc 21), or `null`: on the server
 * and until the page is hydrated, then live with every change.
 */
export function useReferralCode(): string | null {
  return useSyncExternalStore(
    subscribeReferralCode,
    storedReferralCode,
    () => null,
  );
}
