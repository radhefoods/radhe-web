"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Coins } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { RewardsRules } from "@/components/rewards/rewards-rules";
import { useMyRewards } from "@/features/account/rewards";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import type { RewardTransaction } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/dates";

export const REWARD_HISTORY_QUERY_KEY = [
  "account",
  "rewards",
  "history",
] as const;

const PAGE = 20;

/** The history, by pages of twenty, newest first (REWARDS 5). */
function useRewardHistory() {
  return useInfiniteQuery({
    queryKey: REWARD_HISTORY_QUERY_KEY,
    queryFn: ({ pageParam }) =>
      api.listRewardTransactions({ page: pageParam, limit: PAGE }),
    initialPageParam: 1,
    getNextPageParam: (page) =>
      page.page < page.totalPages ? page.page + 1 : undefined,
    staleTime: 0,
  });
}

const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", de: "de-DE" };

/** "+100" / "−56", in the language's digits. */
function signed(coins: number, locale: Locale): string {
  const number = new Intl.NumberFormat(INTL_LOCALE[locale]).format(
    Math.abs(coins),
  );
  return coins < 0 ? `−${number}` : `+${number}`;
}

/** One movement: what it was, when, and the coins with their sign. */
function HistoryRow({ row }: { row: RewardTransaction }) {
  const t = useTranslations("rewards");
  const locale = useLocale() as Locale;
  const label = t(`type.${row.type}`, { orderNumber: row.orderNumber ?? "" });
  return (
    <li className="glass-strong flex items-center justify-between gap-4 rounded-2xl p-4">
      <div className="min-w-0">
        <p className="font-bold">
          {row.orderNumber ? (
            <Link
              href={{
                pathname: "/account/orders/[orderNumber]",
                params: { orderNumber: row.orderNumber },
              }}
              className="rounded-xs underline-offset-4 hover:underline"
            >
              {label}
            </Link>
          ) : (
            label
          )}
        </p>
        <p className="text-ink-muted mt-0.5 flex flex-wrap items-center gap-2 text-sm">
          {formatDate(row.at, locale)}
          {row.state === "reserved" && <Chip tone="wheat">{t("held")}</Chip>}
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 text-lg font-bold tabular-nums",
          row.coins > 0 ? "text-leaf-700" : "text-ink",
        )}
      >
        {signed(row.coins, locale)}
      </p>
    </li>
  );
}

const sectionTitle = "font-display text-ink text-xl";

/**
 * The coins page of the account (REWARDS 8): the balance large with what
 * was earned and redeemed in all, the expiry date when set, the rules in
 * words from the program, and the history with a label per movement.
 * Everything comes from `GET /v1/store/me/rewards` and the history route;
 * nothing is computed here.
 */
export function RewardsView() {
  const t = useTranslations("rewards");
  const locale = useLocale() as Locale;
  const query = useMyRewards();
  const history = useRewardHistory();
  const mine = query.data;
  const rows = history.data?.pages.flatMap((page) => page.items) ?? [];
  const stat = "flex flex-col gap-0.5";
  const statLabel =
    "text-ink-subtle text-xs font-bold tracking-[0.1em] uppercase";
  const statValue = "font-display text-ink text-2xl tabular-nums";

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-ink-muted max-w-2xl">{t("intro")}</p>
      </header>

      {query.error && !mine ? (
        <ErrorAlert
          error={query.error}
          title={t("loadError")}
          onRetry={() => void query.refetch()}
        />
      ) : !mine ? (
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      ) : (
        <>
          <section
            aria-labelledby="rewards-balance"
            className="glass-strong flex flex-col gap-5 rounded-3xl p-5 sm:flex-row sm:items-center sm:gap-8 sm:p-7"
          >
            <div className="flex items-center gap-4">
              <span
                aria-hidden="true"
                className="leaf-gradient shadow-leaf grid size-16 shrink-0 place-items-center rounded-full text-white sm:size-20"
              >
                <Coins className="size-8" />
              </span>
              <div>
                <h2 id="rewards-balance" className={statLabel}>
                  {t("balance")}
                </h2>
                <p className="font-display text-ink text-[2.75rem] leading-none tabular-nums sm:text-[3.25rem]">
                  {new Intl.NumberFormat(INTL_LOCALE[locale]).format(
                    mine.account.available,
                  )}
                  <span className="text-ink-muted ml-2 text-lg">
                    {t("balanceUnit")}
                  </span>
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:ml-auto sm:flex sm:gap-8">
              <div className={stat}>
                <dt className={statLabel}>{t("earnedTotal")}</dt>
                <dd className={statValue}>{mine.account.earnedTotal}</dd>
              </div>
              <div className={stat}>
                <dt className={statLabel}>{t("redeemedTotal")}</dt>
                <dd className={statValue}>{mine.account.redeemedTotal}</dd>
              </div>
              {mine.account.reserved > 0 && (
                <div className={stat}>
                  <dt className={statLabel}>{t("reserved")}</dt>
                  <dd className={statValue}>{mine.account.reserved}</dd>
                </div>
              )}
            </dl>
          </section>

          <div className="text-ink-muted flex flex-col gap-1.5 text-sm empty:hidden">
            {!mine.program.enabled && (
              <p className="text-wheat-800 font-semibold">{t("paused")}</p>
            )}
            {mine.account.expiresAt && (
              <p className="text-wheat-800 font-semibold">
                {t("expires", {
                  date: formatDate(mine.account.expiresAt, locale),
                })}
              </p>
            )}
            {mine.account.balance < 0 && (
              <p>{t("negative", { coins: -mine.account.balance })}</p>
            )}
            {mine.program.enabled &&
              mine.reason === "below_min_coins" &&
              mine.program.redemption?.minCoins && (
                <p>
                  {t("minCoinsHint", {
                    coins: mine.program.redemption.minCoins,
                  })}
                </p>
              )}
            {mine.canRedeem && <p>{t("redeemHint")}</p>}
          </div>

          {mine.program.enabled && (
            <section
              aria-labelledby="rewards-rules"
              className="flex flex-col gap-3"
            >
              <h2 id="rewards-rules" className={sectionTitle}>
                {t("rulesTitle")}
              </h2>
              <RewardsRules program={mine.program} />
            </section>
          )}

          <section
            aria-labelledby="rewards-history"
            className="flex flex-col gap-3"
          >
            <h2 id="rewards-history" className={sectionTitle}>
              {t("historyTitle")}
            </h2>
            {history.error && rows.length === 0 ? (
              <ErrorAlert
                error={history.error}
                title={t("loadError")}
                onRetry={() => void history.refetch()}
              />
            ) : history.isPending ? (
              <div className="space-y-3" aria-hidden="true">
                <Skeleton className="h-20 rounded-2xl" />
                <Skeleton className="h-20 rounded-2xl" />
              </div>
            ) : rows.length === 0 ? (
              <div className="glass flex flex-col items-center gap-3 rounded-3xl px-6 py-12 text-center">
                <span className="bg-leaf-50 text-leaf-700 grid size-14 place-items-center rounded-full">
                  <Coins aria-hidden="true" className="size-6" />
                </span>
                <p className="text-ink-muted max-w-md">{t("historyEmpty")}</p>
              </div>
            ) : (
              <>
                <ul className="flex flex-col gap-3">
                  {rows.map((row) => (
                    <HistoryRow key={row.id} row={row} />
                  ))}
                </ul>
                {history.hasNextPage && (
                  <Button
                    variant="secondary"
                    className="self-center"
                    loading={history.isFetchingNextPage}
                    onClick={() => void history.fetchNextPage()}
                  >
                    {t("loadMore")}
                  </Button>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
