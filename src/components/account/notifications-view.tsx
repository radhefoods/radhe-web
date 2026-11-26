"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BellRing, PackageX, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { ProductCard } from "@/components/catalogue/product-card";
import { Button, buttonStyles } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Skeleton } from "@/components/ui/skeleton";
import { forgetStockAlert } from "@/features/stock-alerts/list-cache";
import { useMyStockAlerts } from "@/features/stock-alerts/stock-alerts";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { api } from "@/lib/api/browser";
import { hasErrorCode } from "@/lib/api/errors";
import type { OwnStockAlert } from "@/lib/api/types";
import { formatDate } from "@/lib/format/dates";
import { productTitle } from "@/lib/format/product-name";

const GRID = "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4";

/**
 * One request: the card of the pack size as listings show it, or a quiet
 * tile for one that left the shop, and under it since when the customer
 * waits and "Cancel notification".
 */
function Request({
  alert,
  priority,
}: {
  alert: OwnStockAlert;
  priority: boolean;
}) {
  const t = useTranslations("account");
  const tAlerts = useTranslations("stockAlerts");
  const locale = useLocale() as Locale;
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const { product } = alert;
  const name = product
    ? productTitle(product.name, product.packSize)
    : t("notifications.gone");

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await api.cancelMyStockAlert(alert.id);
      await forgetStockAlert(client, locale, alert.id);
    } catch (caught) {
      // Taken back elsewhere meanwhile: it is gone either way.
      if (hasErrorCode(caught, "STOCK_ALERT_NOT_FOUND")) {
        await forgetStockAlert(client, locale, alert.id);
      } else {
        setError(caught);
        setBusy(false);
      }
    }
  }

  return (
    <li className="flex flex-col">
      {product ? (
        <ProductCard product={product} headingLevel="h2" priority={priority} />
      ) : (
        <div className="surface text-ink-muted flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-xl p-4 text-center">
          <PackageX aria-hidden="true" className="size-7" />
          <h2 className="text-ink text-[0.9375rem] font-semibold">
            {t("notifications.gone")}
          </h2>
          <p className="text-sm">{t("notifications.goneText")}</p>
        </div>
      )}
      <div className="mt-2 flex flex-col items-start gap-1 px-1.5">
        <p className="text-ink-muted text-sm">
          {t("notifications.since", {
            date: formatDate(alert.requestedAt, locale),
          })}
        </p>
        <Button
          variant="quiet"
          size="sm"
          loading={busy}
          aria-label={t("notifications.cancelNamed", { name })}
          onClick={() => void cancel()}
          className="-ml-3 text-left"
        >
          {!busy && <X aria-hidden="true" className="size-4 shrink-0" />}
          {tAlerts("cancel")}
        </Button>
        {error !== null && <ErrorAlert error={error} />}
      </div>
    </li>
  );
}

/**
 * "Notifications" in the account (doc 26): the pack sizes the customer
 * waits for, newest first, each to be taken back. A request ends by
 * itself when its email went out, so the list holds what is still open.
 */
export function NotificationsView() {
  const t = useTranslations("account");
  // The list is the customer's whether or not the emails are offered now.
  const alerts = useMyStockAlerts({ always: true });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-ink text-3xl sm:text-4xl">
          {t("notifications.title")}
        </h1>
        <p className="text-ink-muted max-w-2xl">{t("notifications.intro")}</p>
      </div>

      {alerts.error && !alerts.data ? (
        <ErrorAlert
          error={alerts.error}
          title={t("notifications.loadError")}
          onRetry={() => void alerts.refetch()}
        />
      ) : !alerts.data ? (
        <div className={GRID} aria-hidden="true">
          {[0, 1, 2].map((card) => (
            <Skeleton key={card} className="aspect-[4/5] rounded-xl" />
          ))}
        </div>
      ) : alerts.data.length === 0 ? (
        <div className="glass flex flex-col items-center gap-4 rounded-3xl px-6 py-14 text-center">
          <span className="bg-leaf-50 text-leaf-700 grid size-16 place-items-center rounded-full">
            <BellRing aria-hidden="true" className="size-7" />
          </span>
          <p className="text-ink max-w-md text-lg font-semibold">
            {t("notifications.empty")}
          </p>
          <Link href="/products" className={buttonStyles()}>
            {t("notifications.emptyCta")}
          </Link>
        </div>
      ) : (
        <ul className={GRID}>
          {alerts.data.map((alert, index) => (
            <Request key={alert.id} alert={alert} priority={index < 4} />
          ))}
        </ul>
      )}
    </div>
  );
}
