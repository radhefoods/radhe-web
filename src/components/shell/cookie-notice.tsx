"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

const KEY = "rf.cookie-notice.v1";
const EVENT = "rf:cookie-notice";

/**
 * Runs before the first paint (see the layout): marks the page when the
 * notice was read before, so that it is never drawn for a returning
 * visitor, not even for a moment. With blocked storage the notice would
 * come back on every page: rather not.
 */
export const COOKIE_NOTICE_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(KEY)})==="1")document.documentElement.dataset.cookieNotice="read"}catch(e){document.documentElement.dataset.cookieNotice="read"}`;

function read(): boolean {
  return document.documentElement.dataset.cookieNotice === "read";
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/**
 * A notice, not a consent banner: the shop stores only what it needs to
 * work (sign-in, cart, language), for which the law asks no consent. It
 * says so once, links to the details, and stays away after "OK". If
 * analytics are ever added, this becomes a real choice.
 *
 * The notice is part of the page the server sends, so a first visit paints
 * it together with everything else instead of adding it after the scripts
 * have run. For a visitor who has read it, the style sheet hides it before
 * the first paint and React removes it afterwards.
 */
export function CookieNotice() {
  const t = useTranslations("cookieNotice");
  const hidden = useSyncExternalStore(subscribe, read, () => false);
  if (hidden) return null;

  return (
    <aside
      aria-label={t("label")}
      className="cookie-notice border-line shadow-float fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 flex flex-col gap-3 rounded-lg border bg-white p-4 text-[0.9375rem] sm:inset-x-auto sm:right-auto sm:bottom-5 sm:left-5 sm:max-w-sm"
    >
      <p>{t("text")}</p>
      <div className="flex items-center gap-4">
        <Button
          size="sm"
          onClick={() => {
            try {
              window.localStorage.setItem(KEY, "1");
            } catch {
              // Nothing to remember it with.
            }
            document.documentElement.dataset.cookieNotice = "read";
            window.dispatchEvent(new Event(EVENT));
          }}
        >
          {t("ok")}
        </Button>
        <Link
          href="/legal/cookies"
          className="rounded-xs font-semibold text-blue-700 underline underline-offset-4"
        >
          {t("more")}
        </Link>
      </div>
    </aside>
  );
}
