"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ISSUE_STATUS_TONE,
  issueQueryKey,
  issuesQueryKey,
  orderIssuesQueryKey,
} from "@/features/issues/issues";
import { OVERVIEW_QUERY_KEY } from "@/features/account/overview";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { isRetryable } from "@/lib/api/errors";
import type { Issue } from "@/lib/api/types";
import { formatDate } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import { productTitle } from "@/lib/format/product-name";

const sectionTitle = "font-display text-xl text-ink";
const panel = "glass-strong rounded-2xl p-5 flex flex-col gap-3";

/**
 * One problem report (doc 23): what was named, the problems, the text,
 * the photos of the submission (owner, 2026-11-02: none are added here
 * afterwards; one can still be taken off while Radhe Foods has not
 * decided), what was asked for, and the outcome. The status chip says
 * where it stands; the history of doc 23 is not shown (same brief).
 * "Take back" while nobody looked at it yet.
 */
export function IssueView({ issueNumber }: { issueNumber: string }) {
  const t = useTranslations("issues");
  const tAccount = useTranslations("account");
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  const photosFailed = useSearchParams().get("photos") === "failed";
  const query = useQuery({
    queryKey: issueQueryKey(issueNumber, locale),
    queryFn: async () => (await api.getIssue(issueNumber)).issue,
    staleTime: 0,
    retry: (failures, error) => failures < 2 && isRetryable(error),
  });
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const issue = query.data;

  function store(next: Issue) {
    client.setQueryData(issueQueryKey(issueNumber, locale), next);
    void client.invalidateQueries({ queryKey: issuesQueryKey(locale) });
    void client.invalidateQueries({
      queryKey: orderIssuesQueryKey(next.orderNumber, locale),
    });
    void client.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
  }

  async function act(call: () => Promise<{ issue: Issue }>) {
    setBusy(true);
    setError(null);
    try {
      store((await call()).issue);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  const back = (
    <Link
      href="/account/reports"
      className="text-ink-muted hover:text-ink -ml-2 flex min-h-10 items-center gap-1 self-start rounded-full py-1 pr-3 pl-1.5 text-[0.9375rem] font-semibold transition-colors duration-200 hover:bg-white/60"
    >
      <ChevronLeft aria-hidden="true" className="size-5" />
      {t("backToReports")}
    </Link>
  );

  if (query.error && !issue) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ErrorAlert
          error={query.error}
          title={tAccount("loadError")}
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  if (!issue) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        {back}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-ink text-3xl sm:text-4xl">
            {t("number", { issueNumber: issue.issueNumber })}
          </h1>
          <Chip tone={ISSUE_STATUS_TONE[issue.status]}>
            {t(`status.${issue.status}`)}
          </Chip>
        </div>
        <p className="text-ink-muted">
          {t("reportedOn", { date: formatDate(issue.reportedAt, locale) })}
          {" · "}
          <Link
            href={{
              pathname: "/account/orders/[orderNumber]",
              params: { orderNumber: issue.orderNumber },
            }}
            className="text-leaf-700 rounded-xs font-semibold underline underline-offset-4"
          >
            {t("forOrder", { orderNumber: issue.orderNumber })}
          </Link>
        </p>
      </header>

      {photosFailed && <Alert tone="warn">{t("photosFailed")}</Alert>}
      {issue.resolution && (
        <Alert tone="good" title={t("resolutionTitle")}>
          <p className="font-semibold">
            {t(`resolution.${issue.resolution.type}`)}
            {issue.resolution.amount > 0 && (
              <>
                {" · "}
                {t("credited", {
                  amount: formatMoney(issue.resolution.amount, locale),
                })}
              </>
            )}
          </p>
          {issue.resolution.note && <p>{issue.resolution.note}</p>}
        </Alert>
      )}
      {issue.status === "rejected" && (
        <Alert tone="warn" title={t("status.rejected")}>
          {issue.history.findLast((entry) => entry.status === "rejected")
            ?.note ?? null}
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <section aria-labelledby="issue-items" className={panel}>
            <h2 id="issue-items" className={sectionTitle}>
              {t("itemsTitle")}
            </h2>
            {issue.items.length === 0 ? (
              <p className="text-ink-muted">{t("summaryNone")}</p>
            ) : (
              <ul className="divide-ink/8 divide-y">
                {issue.items.map((item) => (
                  <li
                    key={item.variantId}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                  >
                    <span className="font-semibold">
                      {t("itemLine", {
                        quantity: item.quantity,
                        name: productTitle(item.name, item.packSize),
                      })}
                    </span>
                    <span className="text-ink-muted text-sm tabular-nums">
                      {formatMoney(item.quantity * item.unitPrice, locale)}
                      {item.refundedQuantity > 0 && (
                        <>
                          {" · "}
                          {t("refundedOf", {
                            refunded: item.refundedQuantity,
                            quantity: item.quantity,
                          })}
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="issue-description" className={panel}>
            <h2 id="issue-description" className={sectionTitle}>
              {t("descriptionTitle")}
            </h2>
            <ul className="flex flex-wrap gap-2">
              {issue.problems.map((problem) => (
                <li key={problem}>
                  <Chip tone="leaf" dot={false}>
                    {t(`problem.${problem}`)}
                  </Chip>
                </li>
              ))}
            </ul>
            <p className="whitespace-pre-line">{issue.description}</p>
          </section>

          {issue.images.length > 0 && (
            <section aria-labelledby="issue-photos" className={panel}>
              <h2 id="issue-photos" className={sectionTitle}>
                {t("photosTitle")}
              </h2>
              <ul className="flex flex-wrap gap-3">
                {issue.images.map((image, index) => (
                  <li key={image.id} className="relative">
                    <a
                      href={image.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.sizes.small.url}
                        alt={t("photoAlt", { index: index + 1 })}
                        className="ring-ink/8 size-24 rounded-xl object-cover ring-1"
                      />
                    </a>
                    {issue.canAddImages && (
                      <button
                        type="button"
                        aria-label={t("photoRemove", { index: index + 1 })}
                        disabled={busy}
                        onClick={() =>
                          void act(() =>
                            api.deleteIssueImage(issue.issueNumber, image.id),
                          )
                        }
                        className="bg-ink/70 hover:bg-ink absolute -top-2 -right-2 grid size-7 place-items-center rounded-full text-white transition-transform duration-150 active:scale-90"
                      >
                        <X aria-hidden="true" className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <section aria-labelledby="issue-wish" className={panel}>
            <h2 id="issue-wish" className={sectionTitle}>
              {t("wishTitle")}
            </h2>
            <p className="font-semibold">
              {t(`wish.${issue.preferredResolution}`)}
            </p>
          </section>

          {error !== null && <ErrorAlert error={error} />}
          {issue.canCancel &&
            (confirming ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">
                  {t("takeBackConfirm")}
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  loading={busy}
                  onClick={() =>
                    void act(() => api.cancelIssue(issue.issueNumber)).then(
                      () => setConfirming(false),
                    )
                  }
                >
                  {t("takeBackYes")}
                </Button>
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => setConfirming(false)}
                >
                  {t("keep")}
                </Button>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="self-start"
                onClick={() => setConfirming(true)}
              >
                {t("takeBack")}
              </Button>
            ))}
        </div>
      </div>
    </div>
  );
}
