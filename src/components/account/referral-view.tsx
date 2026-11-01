"use client";

import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/browser";
import type { Locale } from "@/i18n/routing";
import type { ReferralStatus } from "@/lib/api/types";
import { formatDate } from "@/lib/format/dates";
import { CopyLink } from "./copy-link";

export const REFERRAL_QUERY_KEY = ["account", "referral"] as const;

const STATUS_TONE: Record<ReferralStatus, ChipTone> = {
  registered: "leaf",
  qualified: "green",
  void: "mute",
};

/**
 * The referral page (doc 21): the code and the link to pass on, how many
 * signed up with it and how many ordered, and the people themselves with
 * what became of each invitation. No rewards yet: the page says so.
 */
export function ReferralView() {
  const t = useTranslations("referral");
  const tAccount = useTranslations("account");
  const locale = useLocale() as Locale;
  const query = useQuery({
    queryKey: REFERRAL_QUERY_KEY,
    queryFn: async () => (await api.getReferral()).referral,
    staleTime: 30_000,
  });
  const referral = query.data;

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-ink-muted max-w-2xl">{t("intro")}</p>
      </header>

      {query.error && !referral ? (
        <ErrorAlert
          error={query.error}
          title={tAccount("loadError")}
          onRetry={() => void query.refetch()}
        />
      ) : !referral ? (
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : (
        <>
          <section
            aria-labelledby="referral-link"
            className="glass-strong flex flex-col gap-3 rounded-2xl p-5"
          >
            <h2 id="referral-link" className="font-display text-ink text-xl">
              {t("linkLabel")}
            </h2>
            <p className="text-ink-subtle text-xs font-bold tracking-[0.1em] uppercase">
              {t("code")}
            </p>
            <p className="font-display text-ink -mt-2 text-3xl tracking-[0.14em]">
              {referral.code}
            </p>
            <CopyLink
              id="referral-link-field"
              link={referral.link}
              label={t("linkLabel")}
              copy={t("copy")}
              copied={t("copied")}
            />
            <p className="font-semibold">{t("counts", referral.counts)}</p>
            <p className="text-ink-subtle text-xs">{t("note")}</p>
          </section>

          <section
            aria-labelledby="referral-invitees"
            className="flex flex-col gap-3"
          >
            <h2
              id="referral-invitees"
              className="font-display text-ink text-xl"
            >
              {t("invitees")}
            </h2>
            {referral.invitees.length === 0 ? (
              <div className="glass flex flex-col items-center gap-3 rounded-3xl px-6 py-12 text-center">
                <span className="bg-leaf-50 text-leaf-700 grid size-14 place-items-center rounded-full">
                  <Users aria-hidden="true" className="size-6" />
                </span>
                <p className="text-ink-muted max-w-md">{t("empty")}</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {referral.invitees.map((invitee, index) => (
                  <li
                    key={`${invitee.registeredAt}-${index}`}
                    className="glass-strong flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl p-4"
                  >
                    <div className="min-w-0">
                      <p className="font-bold">
                        {invitee.name ?? t("deletedAccount")}
                      </p>
                      <p className="text-ink-muted text-sm">
                        {invitee.email && <>{invitee.email} · </>}
                        {t("registeredOn", {
                          date: formatDate(invitee.registeredAt, locale),
                        })}
                        {invitee.qualifiedAt && (
                          <>
                            {" · "}
                            {t("qualifiedOn", {
                              date: formatDate(invitee.qualifiedAt, locale),
                            })}
                          </>
                        )}
                      </p>
                    </div>
                    <Chip tone={STATUS_TONE[invitee.status]}>
                      {t(`status.${invitee.status}`)}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
