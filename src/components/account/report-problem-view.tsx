"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ArrowRight,
  Banknote,
  ChevronLeft,
  Clock,
  Leaf,
  MessageCircle,
  PackageMinus,
  PackageX,
  Pencil,
  Truck,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Eyebrow } from "@/components/ui/eyebrow";
import { controlStyles } from "@/components/ui/field";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ISSUE_PROBLEMS,
  ISSUE_STATUS_TONE,
  ISSUE_TEXT_MAX,
  ISSUE_TEXT_MIN,
  ISSUE_WISHES,
  daysLeft,
  issueQueryKey,
  issueValue,
  issuesQueryKey,
  orderIssuesQueryKey,
} from "@/features/issues/issues";
import { OVERVIEW_QUERY_KEY } from "@/features/account/overview";
import { orderQueryKey } from "@/features/orders/orders";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import type {
  Id,
  IssueProblem,
  IssueResolutionType,
  OrderItem,
} from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format/dates";
import { formatMoney } from "@/lib/format/money";
import {
  formatPackSize,
  formatProductName,
  productTitle,
} from "@/lib/format/product-name";
import { PhotoPicker } from "./photo-picker";

const PROBLEM_ICON: Record<IssueProblem, ReactNode> = {
  damaged: <PackageX aria-hidden="true" className="size-5" />,
  missing: <PackageMinus aria-hidden="true" className="size-5" />,
  wrong_item: <ArrowLeftRight aria-hidden="true" className="size-5" />,
  not_fresh: <Leaf aria-hidden="true" className="size-5" />,
  late: <Clock aria-hidden="true" className="size-5" />,
  other: <Pencil aria-hidden="true" className="size-5" />,
};

const WISH_ICON: Record<IssueResolutionType, ReactNode> = {
  refund: <Banknote aria-hidden="true" className="size-5" />,
  replacement: <Truck aria-hidden="true" className="size-5" />,
  none: <MessageCircle aria-hidden="true" className="size-5" />,
};

const panel = "glass-strong rounded-2xl p-5";

/** A numbered step, as the reference draws them. */
function Step({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`report-step-${number}`} className={panel}>
      <h2
        id={`report-step-${number}`}
        className="flex flex-wrap items-center gap-3 text-lg font-bold"
      >
        <span
          aria-hidden="true"
          className="leaf-gradient grid size-7 shrink-0 place-items-center rounded-full text-sm text-white"
        >
          {number}
        </span>
        {title}
        {hint && (
          <span className="text-ink-muted text-sm font-normal">{hint}</span>
        )}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * "Report a problem" (doc 23), after the owner's reference: the days left
 * to report, four numbered steps (the items with how many units, the
 * problems, the text with the photos, the wish), a summary card with the
 * button beside them on wide screens, and the reports made before. The
 * report is created first, then the photos go up; a failed upload still
 * shows the report, with a note that photos can be added there.
 */
export function ReportProblemView({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations("issues");
  const tAccount = useTranslations("account");
  const tProduct = useTranslations("product");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const client = useQueryClient();
  const orderQuery = useQuery({
    queryKey: orderQueryKey(orderNumber, locale),
    queryFn: async () => (await api.getOrder(orderNumber)).order,
  });
  const issuesQuery = useQuery({
    queryKey: orderIssuesQueryKey(orderNumber, locale),
    queryFn: () => api.getOrderIssues(orderNumber),
    staleTime: 0,
  });

  const [quantities, setQuantities] = useState<Record<Id, number>>({});
  const [problems, setProblems] = useState<IssueProblem[]>([]);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [wish, setWish] = useState<IssueResolutionType>("refund");
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  // The moment the page opened: the days left are counted from it.
  const [now] = useState(() => Date.now());

  const order = orderQuery.data;
  const issues = issuesQuery.data;
  const orderHref = {
    pathname: "/account/orders/[orderNumber]" as const,
    params: { orderNumber },
  };
  const back = (
    <Link
      href={orderHref}
      className="text-ink-muted hover:text-ink -ml-2 flex min-h-10 items-center gap-1 self-start rounded-full py-1 pr-3 pl-1.5 text-[0.9375rem] font-semibold transition-colors duration-200 hover:bg-white/60"
    >
      <ChevronLeft aria-hidden="true" className="size-5" />
      {t("back")}
    </Link>
  );

  const loadError = orderQuery.error ?? issuesQuery.error;
  if (loadError && (!order || !issues)) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ErrorAlert error={loadError} title={tAccount("loadError")} />
      </div>
    );
  }
  if (!order || !issues) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  const rows = order.items
    .map((item) => ({
      item,
      available:
        issues.reportable.find((row) => row.variantId === item.variantId)
          ?.available ?? 0,
    }))
    .filter((row) => row.available > 0);
  const chosen = rows
    .filter((row) => (quantities[row.item.variantId] ?? 0) > 0)
    .map((row) => ({
      ...row,
      quantity: quantities[row.item.variantId],
    }));
  const value = issueValue(
    chosen.map(({ item, quantity }) => ({
      quantity,
      unitPrice: item.unitPrice,
    })),
  );
  const textOk = description.trim().length >= ISSUE_TEXT_MIN;
  const days = issues.window.until ? daysLeft(issues.window.until, now) : null;

  function setQuantity(item: OrderItem, quantity: number) {
    setQuantities((current) => ({ ...current, [item.variantId]: quantity }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (problems.length === 0 || !textOk) return;
    setBusy(true);
    setError(null);
    let issueNumber: string;
    try {
      const { issue } = await api.createIssue(orderNumber, {
        ...(chosen.length > 0 && {
          items: chosen.map(({ item, quantity }) => ({
            variantId: item.variantId,
            quantity,
          })),
        }),
        problems,
        description: description.trim(),
        preferredResolution: wish,
        locale,
      });
      issueNumber = issue.issueNumber;
      client.setQueryData(issueQueryKey(issueNumber, locale), issue);
    } catch (caught) {
      setError(caught);
      setBusy(false);
      void issuesQuery.refetch();
      return;
    }
    // The report exists: the photos follow, and a failure of theirs is
    // said on the report's page rather than lost.
    let photosFailed = false;
    if (files.length > 0) {
      try {
        const { issue } = await api.uploadIssueImages(issueNumber, files);
        client.setQueryData(issueQueryKey(issueNumber, locale), issue);
      } catch {
        photosFailed = true;
      }
    }
    void client.invalidateQueries({
      queryKey: orderIssuesQueryKey(orderNumber, locale),
    });
    void client.invalidateQueries({ queryKey: issuesQueryKey(locale) });
    void client.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
    router.replace({
      pathname: "/account/reports/[issueNumber]",
      params: { issueNumber },
      ...(photosFailed && { query: { photos: "failed" } }),
    });
  }

  if (!issues.window.possible) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("reportTitle")}
        </h1>
        <Alert tone="info">
          {issues.window.until && Date.parse(issues.window.until) < now
            ? t("windowClosed")
            : t("notPossible")}
        </Alert>
      </div>
    );
  }

  return (
    <form
      method="post"
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-5"
    >
      {back}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-ink text-3xl sm:text-4xl">
            {t("reportTitle")}
          </h1>
          {days !== null && (
            <Chip tone="leaf">
              <Clock aria-hidden="true" className="size-3.5" />
              {t("daysLeft", { days })}
            </Chip>
          )}
        </div>
        <p className="text-ink-muted max-w-2xl">{t("reportIntro")}</p>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4">
          <Step number={1} title={t("step1")} hint={t("step1Hint")}>
            <ul className="flex flex-col gap-3">
              {rows.map(({ item, available }) => {
                const quantity = quantities[item.variantId] ?? 0;
                const active = quantity > 0;
                const name = productTitle(item.name, item.packSize);
                return (
                  <li
                    key={item.variantId}
                    className={cn(
                      "ease-glass flex flex-wrap items-center gap-3 rounded-2xl border-[1.5px] p-3 transition-[background-color,border-color,box-shadow] duration-200",
                      active
                        ? "border-leaf-600 bg-leaf-50/80 shadow-[0_0_0_3px_rgb(21_122_75/0.12)]"
                        : "border-transparent bg-white/70 shadow-[0_0_0_1px_rgb(23_33_27/0.08)]",
                    )}
                  >
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className="accent-leaf-600 size-6 shrink-0"
                        checked={active}
                        aria-label={name}
                        onChange={(event) =>
                          setQuantity(item, event.target.checked ? 1 : 0)
                        }
                      />
                      {item.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt=""
                          width={56}
                          height={56}
                          loading="lazy"
                          className="ring-ink/6 size-14 shrink-0 rounded-lg bg-white object-contain p-1 ring-1"
                        />
                      )}
                      <span className="flex min-w-0 flex-col">
                        <span className="font-bold">
                          {formatProductName(item.name)}
                        </span>
                        <span className="text-ink-muted text-sm tabular-nums">
                          {formatPackSize(item.packSize)} ·{" "}
                          {formatMoney(item.unitPrice, locale)}
                        </span>
                      </span>
                    </label>
                    {/* On a phone the counter takes a line of its own. */}
                    <div className="flex w-full items-center justify-end gap-2 text-sm sm:w-auto">
                      {active ? (
                        <>
                          <span className="text-ink-muted">
                            {t("affected")}
                          </span>
                          <QuantityStepper
                            value={quantity}
                            min={1}
                            max={available}
                            removeAtMin={false}
                            size="sm"
                            className="w-28 bg-white"
                            onChange={(next) => setQuantity(item, next)}
                            labels={{
                              quantity: t("affectedNamed", { name }),
                              increase: tProduct("increase"),
                              decrease: tProduct("decrease"),
                              remove: tProduct("decrease"),
                            }}
                          />
                          <span className="text-ink-muted tabular-nums">
                            {t("of", { available })}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-muted tabular-nums">
                          {t("quantity", { count: available })}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Step>

          <Step number={2} title={t("step2")} hint={t("step2Hint")}>
            <ul className="grid gap-2 sm:grid-cols-3">
              {ISSUE_PROBLEMS.map((problem) => {
                const active = problems.includes(problem);
                return (
                  <li key={problem}>
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setProblems((current) =>
                          active
                            ? current.filter((entry) => entry !== problem)
                            : [...current, problem],
                        )
                      }
                      className={cn(
                        "ease-glass flex min-h-14 w-full items-center gap-3 rounded-2xl border-[1.5px] px-4 py-2 text-left font-semibold transition-[background-color,border-color,box-shadow] duration-200",
                        active
                          ? "border-leaf-600 bg-leaf-50/80 text-leaf-700 shadow-[0_0_0_3px_rgb(21_122_75/0.12)]"
                          : "border-transparent bg-white/70 shadow-[0_0_0_1px_rgb(23_33_27/0.08)] hover:bg-white",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-9 shrink-0 place-items-center rounded-full",
                          active
                            ? "bg-leaf-600 text-white"
                            : "bg-ink/6 text-ink",
                        )}
                      >
                        {PROBLEM_ICON[problem]}
                      </span>
                      {t(`problem.${problem}`)}
                    </button>
                  </li>
                );
              })}
            </ul>
            {attempted && problems.length === 0 && (
              <p
                role="alert"
                className="mt-2 text-sm font-semibold text-red-800"
              >
                {t("problemMissing")}
              </p>
            )}
          </Step>

          <Step number={3} title={t("step3")}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="report-description" className="sr-only">
                  {t("step3")}
                </label>
                <textarea
                  id="report-description"
                  rows={4}
                  maxLength={ISSUE_TEXT_MAX}
                  value={description}
                  aria-invalid={attempted && !textOk ? true : undefined}
                  aria-describedby="report-description-hint"
                  onChange={(event) => setDescription(event.target.value)}
                  className={cn(controlStyles, "py-3")}
                />
                <p
                  id="report-description-hint"
                  className={cn(
                    "flex justify-between text-sm",
                    attempted && !textOk
                      ? "font-semibold text-red-800"
                      : "text-ink-muted",
                  )}
                >
                  {attempted && !textOk ? (
                    <span role="alert">{t("descriptionTooShort")}</span>
                  ) : (
                    <span>{t("descriptionHint")}</span>
                  )}
                  <span className="tabular-nums">
                    {description.length} / {ISSUE_TEXT_MAX}
                  </span>
                </p>
              </div>
              <PhotoPicker
                id="report-photos"
                files={files}
                onChange={setFiles}
              />
            </div>
          </Step>

          <Step number={4} title={t("step4")}>
            <fieldset>
              <legend className="sr-only">{t("step4")}</legend>
              <ul className="grid gap-3 sm:grid-cols-3">
                {ISSUE_WISHES.map((option) => {
                  const active = wish === option;
                  return (
                    <li key={option}>
                      <label
                        className={cn(
                          "ease-glass flex h-full cursor-pointer flex-col gap-3 rounded-2xl border-[1.5px] p-4 transition-[background-color,border-color,box-shadow] duration-200",
                          active
                            ? "border-leaf-600 bg-leaf-50/80 shadow-[0_0_0_3px_rgb(21_122_75/0.12)]"
                            : "border-transparent bg-white/70 shadow-[0_0_0_1px_rgb(23_33_27/0.08)] hover:bg-white",
                        )}
                      >
                        <span className="flex items-center justify-between">
                          <span
                            className={cn(
                              "grid size-9 place-items-center rounded-full",
                              active
                                ? "bg-leaf-600 text-white"
                                : "bg-ink/6 text-ink",
                            )}
                          >
                            {WISH_ICON[option]}
                          </span>
                          <input
                            type="radio"
                            name="report-wish"
                            value={option}
                            checked={active}
                            onChange={() => setWish(option)}
                            className="accent-leaf-600 size-5"
                          />
                        </span>
                        <span className="flex flex-col">
                          <span className="font-bold">
                            {t(`wish.${option}`)}
                          </span>
                          <span className="text-ink-muted text-sm">
                            {t(`wishHint.${option}`)}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          </Step>
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-24">
          <section
            aria-labelledby="report-summary"
            className="bg-wheat-100/80 ring-wheat-800/12 flex flex-col gap-3 rounded-2xl p-5 shadow-[inset_0_1px_0_rgb(255_255_255/0.7)] ring-1"
          >
            <Eyebrow tone="leaf">{t("summaryTitle", { orderNumber })}</Eyebrow>
            <h2 id="report-summary" className="sr-only">
              {t("summaryTitle", { orderNumber })}
            </h2>
            {order.delivery.deliveredAt && (
              <p className="text-ink-muted -mt-1 text-sm">
                {t("summaryDelivered", {
                  date: formatDate(order.delivery.deliveredAt, locale),
                  city: order.deliveryAddress.city,
                })}
              </p>
            )}
            <dl className="divide-wheat-800/10 divide-y text-sm">
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-ink-muted">{t("summaryItems")}</dt>
                <dd className="text-right font-semibold">
                  {chosen.length === 0
                    ? t("summaryNone")
                    : chosen
                        .map(
                          ({ item, quantity }) =>
                            `${quantity} × ${formatProductName(item.name)}`,
                        )
                        .join(", ")}
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-ink-muted">{t("summaryProblems")}</dt>
                <dd className="text-right font-semibold">
                  {problems.length === 0
                    ? "–"
                    : problems.map((p) => t(`problem.${p}`)).join(", ")}
                </dd>
              </div>
              {chosen.length > 0 && (
                <div className="flex justify-between gap-3 py-2">
                  <dt className="text-ink-muted">{t("summaryValue")}</dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {formatMoney(value, locale)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3 py-2">
                <dt className="text-ink-muted">{t("summaryWish")}</dt>
                <dd className="text-right font-semibold">
                  {t(`wish.${wish}`)}
                </dd>
              </div>
            </dl>
            {error !== null && <ErrorAlert error={error} />}
            <Button type="submit" size="lg" block loading={busy}>
              {t("submit")}
              {!busy && <ArrowRight aria-hidden="true" className="size-4" />}
            </Button>
            <p className="text-ink-muted text-center text-xs">
              {t("submitNote")}
            </p>
          </section>

          {issues.items.length > 0 && (
            <section
              aria-labelledby="report-previous"
              className={cn(panel, "flex flex-col gap-3")}
            >
              <h2 id="report-previous" className="text-lg font-bold">
                {t("previous")}
              </h2>
              <ul className="flex flex-col gap-2">
                {issues.items.map((issue) => (
                  <li key={issue.issueNumber}>
                    <Link
                      href={{
                        pathname: "/account/reports/[issueNumber]",
                        params: { issueNumber: issue.issueNumber },
                      }}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-1.5 transition-colors duration-150 hover:bg-white/70"
                    >
                      <span className="flex flex-col">
                        <span className="font-semibold">
                          {issue.issueNumber}
                        </span>
                        <span className="text-ink-muted text-sm">
                          {issue.problems
                            .map((p) => t(`problem.${p}`))
                            .join(", ")}
                          {" · "}
                          {formatDate(issue.reportedAt, locale)}
                        </span>
                      </span>
                      <Chip tone={ISSUE_STATUS_TONE[issue.status]}>
                        {t(`status.${issue.status}`)}
                      </Chip>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </form>
  );
}
