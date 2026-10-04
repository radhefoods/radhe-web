"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { controlStyles } from "@/components/ui/field";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Skeleton } from "@/components/ui/skeleton";
import { orderQueryKey, orderReturnsQueryKey } from "@/features/orders/orders";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import type { Id, ReturnReason } from "@/lib/api/types";
import { cn } from "@/lib/cn";

const REASONS: ReturnReason[] = [
  "damaged",
  "wrong_item",
  "quality",
  "not_as_described",
  "changed_mind",
  "other",
];

interface Choice {
  quantity: number;
  reason: ReturnReason | "";
  comment: string;
}

const NOTHING: Choice = { quantity: 0, reason: "", comment: "" };

/**
 * Asking to send products of a delivered order back (doc 12): how many of
 * which product, and why. Radhe Foods decides about every request; nothing
 * is refunded by sending this form.
 */
export function ReturnRequestView({ orderNumber }: { orderNumber: string }) {
  const t = useTranslations("returns");
  const tAccount = useTranslations("account");
  const tProduct = useTranslations("product");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const client = useQueryClient();

  const orderQuery = useQuery({
    queryKey: orderQueryKey(orderNumber, locale),
    queryFn: async () => (await api.getOrder(orderNumber)).order,
  });
  const returnsQuery = useQuery({
    queryKey: orderReturnsQueryKey(orderNumber, locale),
    queryFn: () => api.getOrderReturns(orderNumber),
    staleTime: 0,
  });

  const [choices, setChoices] = useState<Record<Id, Choice>>({});
  const [comment, setComment] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const order = orderQuery.data;
  const returnable = returnsQuery.data?.returnable;
  const orderHref = {
    pathname: "/account/orders/[orderNumber]" as const,
    params: { orderNumber },
  };
  const back = (
    <Link
      href={orderHref}
      className="text-ink-muted hover:text-ink -ml-1 flex min-h-11 items-center gap-1 self-start rounded-sm text-[0.9375rem] font-semibold"
    >
      <ChevronLeft aria-hidden="true" className="size-5" />
      {t("back")}
    </Link>
  );

  const loadError = orderQuery.error ?? returnsQuery.error;
  if (loadError && (!order || !returnable)) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <ErrorAlert error={loadError} title={tAccount("loadError")} />
      </div>
    );
  }
  if (!order || !returnable) {
    return (
      <div className="space-y-4" aria-hidden="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const rows = order.items
    .map((item) => ({
      item,
      available:
        returnable.find((row) => row.productId === item.productId)?.available ??
        0,
    }))
    .filter((row) => row.available > 0);
  const chosen = rows.filter(
    (row) => (choices[row.item.productId]?.quantity ?? 0) > 0,
  );
  const reasonsMissing = chosen.some(
    (row) => !choices[row.item.productId]?.reason,
  );

  const change = (productId: Id, patch: Partial<Choice>) =>
    setChoices((current) => ({
      ...current,
      [productId]: { ...(current[productId] ?? NOTHING), ...patch },
    }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    if (chosen.length === 0 || reasonsMissing) return;
    setBusy(true);
    setError(null);
    try {
      await api.createReturn(orderNumber, {
        items: chosen.map(({ item }) => {
          const choice = choices[item.productId];
          return {
            productId: item.productId,
            quantity: choice.quantity,
            reason: choice.reason as ReturnReason,
            comment: choice.comment.trim() || undefined,
          };
        }),
        comment: comment.trim() || undefined,
        locale,
      });
      await Promise.all([
        client.invalidateQueries({
          queryKey: orderReturnsQueryKey(orderNumber, locale),
        }),
        client.invalidateQueries({
          queryKey: orderQueryKey(orderNumber, locale),
        }),
      ]);
      router.replace(orderHref);
    } catch (caught) {
      setError(caught);
      // What can be returned may have changed meanwhile.
      void returnsQuery.refetch();
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {back}
      <header className="space-y-2">
        <h1 className="font-display text-4xl text-blue-900 sm:text-5xl">
          {t("formTitle")}
        </h1>
        <p className="text-ink-muted max-w-2xl">
          {t("formIntro", { orderNumber: order.orderNumber })}
        </p>
      </header>

      {rows.length === 0 ? (
        <Alert tone="info">{t("nothing")}</Alert>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          <ul className="flex flex-col gap-3">
            {rows.map(({ item, available }) => {
              const choice = choices[item.productId] ?? NOTHING;
              const name = `${item.name}, ${item.packSize.label}`;
              const active = choice.quantity > 0;
              const reasonId = `return-reason-${item.productId}`;
              const commentId = `return-comment-${item.productId}`;
              return (
                <li
                  key={item.productId}
                  className={cn(
                    "flex flex-col gap-3 rounded-lg border p-4",
                    active ? "border-blue-600 bg-blue-50" : "border-line",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold">{name}</p>
                      <p className="text-ink-muted text-sm">
                        {t("available", { count: available })}
                      </p>
                    </div>
                    <QuantityStepper
                      value={choice.quantity}
                      min={0}
                      max={available}
                      removeAtMin={false}
                      size="sm"
                      className="w-32 bg-white"
                      onChange={(quantity) =>
                        change(item.productId, { quantity })
                      }
                      labels={{
                        quantity: t("quantityNamed", { name }),
                        increase: tProduct("increase"),
                        decrease: tProduct("decrease"),
                        remove: tProduct("decrease"),
                      }}
                    />
                  </div>
                  {active && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1.5">
                        <label htmlFor={reasonId} className="text-sm font-bold">
                          {t("reasonLabel")}
                        </label>
                        <select
                          id={reasonId}
                          value={choice.reason}
                          aria-invalid={
                            attempted && !choice.reason ? true : undefined
                          }
                          onChange={(event) =>
                            change(item.productId, {
                              reason: event.target.value as ReturnReason | "",
                            })
                          }
                          className={controlStyles}
                        >
                          <option value="">{t("reasonChoose")}</option>
                          {REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {t(`reason.${reason}`)}
                            </option>
                          ))}
                        </select>
                        {attempted && !choice.reason && (
                          <p className="text-sm font-semibold text-red-600">
                            {t("reasonMissing")}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor={commentId}
                          className="text-sm font-bold"
                        >
                          {t("itemComment")}
                        </label>
                        <input
                          id={commentId}
                          type="text"
                          maxLength={500}
                          value={choice.comment}
                          onChange={(event) =>
                            change(item.productId, {
                              comment: event.target.value,
                            })
                          }
                          className={controlStyles}
                        />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="return-comment" className="text-sm font-bold">
              {t("comment")}
            </label>
            <textarea
              id="return-comment"
              rows={3}
              maxLength={1000}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              className={cn(controlStyles, "py-3")}
            />
          </div>

          {attempted && chosen.length === 0 && (
            <p role="alert" className="text-sm font-semibold text-red-600">
              {t("chooseOne")}
            </p>
          )}
          {error !== null && <ErrorAlert error={error} />}
          <Button type="submit" className="self-start" loading={busy}>
            {t("submit")}
          </Button>
        </form>
      )}
    </div>
  );
}
