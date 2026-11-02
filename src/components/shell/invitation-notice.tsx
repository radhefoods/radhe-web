"use client";

import { Gift, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { buttonStyles } from "@/components/ui/button";
import { useSession } from "@/features/session/session";
import { Link, usePathname } from "@/i18n/navigation";
import { useReferralCode } from "@/lib/referral/use-referral-code";

/** The code whose notice was closed, for this tab only. */
const DISMISSED_KEY = "rf.referral-notice.v1";
const DISMISSED_EVENT = "rf:referral-notice";

function dismissedCode(): string | null {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function dismiss(code: string): void {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, code);
  } catch {
    // Without storage the notice closes until the next page.
  }
  window.dispatchEvent(new Event(DISMISSED_EVENT));
}

function subscribeDismissed(onChange: () => void): () => void {
  window.addEventListener(DISMISSED_EVENT, onChange);
  return () => window.removeEventListener(DISMISSED_EVENT, onChange);
}

/** The pages that are about the account itself: the notice would repeat them. */
const QUIET_PATHS = new Set([
  "/sign-up",
  "/sign-in",
  "/forgot-password",
  "/reset-password",
]);

/**
 * A slim line under the header while a referral code from a link is kept
 * (doc 21) and nobody is signed in: the visitor sees that the invitation
 * was noticed, which code will count, and the way to the sign-up. It can
 * be closed for the visit; it goes by itself once an account was made
 * with the code, and it is not shown to a signed-in customer, who cannot
 * be invited any more.
 */
export function InvitationNotice() {
  const t = useTranslations("invitation");
  const code = useReferralCode();
  const closed = useSyncExternalStore(
    subscribeDismissed,
    dismissedCode,
    () => null,
  );
  const pathname = usePathname();
  const session = useSession();

  if (
    code === null ||
    closed === code ||
    session.status !== "guest" ||
    QUIET_PATHS.has(pathname)
  ) {
    return null;
  }

  return (
    <aside
      aria-label={t("title")}
      data-testid="invitation-notice"
      className="border-leaf-600/12 bg-leaf-50/80 text-leaf-800 border-b backdrop-blur-sm"
    >
      <div className="container-page flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5 text-[0.9375rem]">
        <span className="text-leaf-700 grid size-9 shrink-0 place-items-center rounded-full bg-white/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.8)]">
          <Gift aria-hidden="true" className="size-4.5" />
        </span>
        <p className="min-w-0 flex-1 basis-60">
          <span className="font-bold">{t("title")}.</span>{" "}
          {t.rich("text", {
            code,
            b: (chunks) => (
              <span className="font-bold tracking-[0.08em] tabular-nums">
                {chunks}
              </span>
            ),
          })}
        </p>
        <Link
          href="/sign-up"
          className={buttonStyles({ variant: "secondary", size: "sm" })}
        >
          {t("action")}
        </Link>
        <button
          type="button"
          aria-label={t("dismiss")}
          onClick={() => dismiss(code)}
          className="text-leaf-700 hover:text-leaf-800 -mr-2 grid size-10 shrink-0 place-items-center rounded-full transition-colors hover:bg-white/70"
        >
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
    </aside>
  );
}
