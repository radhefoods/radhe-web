"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ErrorAlert } from "@/components/ui/error-alert";
import { env } from "@/config/env";
import { useSessionActions } from "@/features/session/session";
import { useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { hasErrorCode } from "@/lib/api/errors";
import { returnHref, type ReturnTarget } from "@/lib/navigation/return-to";

// The part of Google Identity Services the shop uses.
interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (options: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
        ux_mode?: "popup";
      }) => void;
      renderButton: (
        parent: HTMLElement,
        options: {
          type: "standard";
          theme: "outline";
          size: "large";
          shape: "rectangular";
          text: "continue_with";
          width: number;
          locale: string;
        },
      ) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

/** Loads Google's script once, and only when this component is on the page. */
function loadGoogle(): Promise<GoogleIdentity> {
  return new Promise((resolve, reject) => {
    if (window.google) return resolve(window.google);
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`,
    );
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () =>
      window.google ? resolve(window.google) : reject(new Error("no google")),
    );
    script.addEventListener("error", () => reject(new Error("blocked")));
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      document.head.append(script);
    }
  });
}

/**
 * "Continue with Google" (doc 1). Shown only when the shop has a Google
 * client id; it disappears when the API answers that Google sign-in is not
 * set up, or when Google's script cannot be loaded (blocked by the browser).
 * Google's script is loaded on the sign-in page only, nowhere else.
 */
export function GoogleSignIn({
  returnTo,
  divider,
}: {
  returnTo: ReturnTarget;
  /** The word between this button and the email form ("or"). */
  divider: string;
}) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { signedIn } = useSessionActions();
  const holder = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(Boolean(env.googleClientId));
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!env.googleClientId) return;
    let cancelled = false;
    loadGoogle()
      .then((google) => {
        if (cancelled || !holder.current) return;
        google.accounts.id.initialize({
          client_id: env.googleClientId,
          ux_mode: "popup",
          callback: async ({ credential }) => {
            if (!credential) return;
            setError(null);
            try {
              const { customer } = await api.signInWithGoogle({
                idToken: credential,
                locale,
              });
              signedIn(customer);
              router.replace(returnHref(returnTo));
            } catch (caught) {
              if (hasErrorCode(caught, "GOOGLE_NOT_CONFIGURED")) {
                setAvailable(false);
              } else {
                setError(caught);
              }
            }
          },
        });
        google.accounts.id.renderButton(holder.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "rectangular",
          text: "continue_with",
          width: Math.min(400, holder.current.clientWidth),
          locale,
        });
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, returnTo, router, signedIn]);

  if (!available) return null;
  return (
    <div className="flex flex-col gap-4">
      <div ref={holder} className="flex min-h-11 justify-center" />
      {error !== null && <ErrorAlert error={error} />}
      <p className="text-ink-muted flex items-center gap-3 text-sm">
        <span aria-hidden="true" className="bg-line h-px flex-1" />
        {divider}
        <span aria-hidden="true" className="bg-line h-px flex-1" />
      </p>
    </div>
  );
}
