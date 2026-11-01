"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Chip } from "@/components/ui/chip";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ISSUE_STATUS_TONE, issuesQueryKey } from "@/features/issues/issues";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { formatDate } from "@/lib/format/dates";

/** Every problem report of the customer, newest first (doc 23). */
export function IssuesList() {
  const t = useTranslations("issues");
  const tAccount = useTranslations("account");
  const locale = useLocale() as Locale;
  const query = useQuery({
    queryKey: issuesQueryKey(locale),
    queryFn: async () => (await api.listIssues()).items,
    staleTime: 0,
  });
  const issues = query.data;

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-2">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("listTitle")}
        </h1>
        <p className="text-ink-muted max-w-2xl">{t("listIntro")}</p>
      </header>
      {query.error && !issues ? (
        <ErrorAlert
          error={query.error}
          title={tAccount("loadError")}
          onRetry={() => void query.refetch()}
        />
      ) : !issues ? (
        <div className="space-y-3" aria-hidden="true">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : issues.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-3xl px-6 py-14 text-center">
          <span className="bg-leaf-50 text-leaf-700 grid size-16 place-items-center rounded-full">
            <ShieldCheck aria-hidden="true" className="size-7" />
          </span>
          <p className="text-ink-muted max-w-md">{t("empty")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {issues.map((issue) => (
            <li key={issue.issueNumber}>
              <article className="glass-strong hover:shadow-lift ease-glass relative flex flex-col gap-2 rounded-2xl p-4 transition-[box-shadow,transform,background-color] duration-300 hover:-translate-y-0.5 hover:bg-white/90 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-lg font-bold">
                    <Link
                      href={{
                        pathname: "/account/reports/[issueNumber]",
                        params: { issueNumber: issue.issueNumber },
                      }}
                      className="rounded-xs after:absolute after:inset-0"
                    >
                      {t("number", { issueNumber: issue.issueNumber })}
                    </Link>
                  </h2>
                  <Chip tone={ISSUE_STATUS_TONE[issue.status]}>
                    {t(`status.${issue.status}`)}
                  </Chip>
                </div>
                <p className="text-ink-muted text-sm">
                  {t("forOrder", { orderNumber: issue.orderNumber })}
                  {" · "}
                  {t("reportedOn", {
                    date: formatDate(issue.reportedAt, locale),
                  })}
                </p>
                <p className="text-[0.9375rem]">
                  {issue.problems.map((p) => t(`problem.${p}`)).join(", ")}
                  {issue.items.length > 0 && (
                    <span className="text-ink-muted">
                      {" · "}
                      {t("itemCount", { count: issue.items.length })}
                    </span>
                  )}
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
