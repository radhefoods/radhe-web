"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { buttonStyles } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import {
  ISSUE_STATUS_TONE,
  orderIssuesQueryKey,
} from "@/features/issues/issues";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { hasErrorCode } from "@/lib/api/errors";
import type { OrderDetail } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/dates";

/**
 * On a delivered order (doc 23): the way to "Report a problem" while the
 * window is open, and the reports made before. Nothing on an API without
 * the route, and nothing while there is neither.
 */
export function OrderIssues({
  order,
  className,
}: {
  order: OrderDetail;
  className?: string;
}) {
  const t = useTranslations("issues");
  const locale = useLocale() as Locale;
  const query = useQuery({
    queryKey: orderIssuesQueryKey(order.orderNumber, locale),
    queryFn: () => api.getOrderIssues(order.orderNumber),
    retry: (failures, error) =>
      failures < 2 && !hasErrorCode(error, "NOT_FOUND"),
  });
  const issues = query.data;
  if (!issues || (!issues.window.possible && issues.items.length === 0)) {
    return null;
  }
  return (
    <section
      aria-labelledby="order-issues"
      className={cn("flex flex-col gap-3", className)}
    >
      <h2 id="order-issues" className="font-display text-ink text-xl">
        {t("orderReportsTitle")}
      </h2>
      {issues.items.length > 0 && (
        <ul className="divide-ink/8 divide-y">
          {issues.items.map((issue) => (
            <li
              key={issue.issueNumber}
              className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <Link
                  href={{
                    pathname: "/account/reports/[issueNumber]",
                    params: { issueNumber: issue.issueNumber },
                  }}
                  className="text-leaf-700 rounded-xs font-bold underline underline-offset-4"
                >
                  {t("number", { issueNumber: issue.issueNumber })}
                </Link>
                <p className="text-ink-muted text-sm">
                  {issue.problems.map((p) => t(`problem.${p}`)).join(", ")}
                  {" · "}
                  {formatDate(issue.reportedAt, locale)}
                </p>
              </div>
              <Chip tone={ISSUE_STATUS_TONE[issue.status]}>
                {t(`status.${issue.status}`)}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      {issues.window.possible && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href={{
              pathname: "/account/orders/[orderNumber]/report",
              params: { orderNumber: order.orderNumber },
            }}
            className={buttonStyles({ variant: "secondary", size: "sm" })}
          >
            {t("reportButton")}
          </Link>
          {issues.window.until && (
            <p className="text-ink-muted text-sm">
              {t("reportUntil", {
                date: formatDate(issues.window.until, locale),
              })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
